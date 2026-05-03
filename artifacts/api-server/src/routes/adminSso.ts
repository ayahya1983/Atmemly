import { Router, type IRouter } from "express";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import {
  db,
  identityProvidersTable,
  loginAuditLogsTable,
  platformSettingsTable,
  type IdentityProvider,
} from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { effectiveAdminRole } from "../lib/permissions";
import {
  AdminCreateSsoProviderBody,
  AdminUpdateSsoProviderBody,
  AdminUpdateSsoSettingsBody,
} from "@workspace/api-zod";
import { discover } from "../lib/sso/oidc";
import { loadSsoSettings, SSO_DEFAULT_SETTINGS, SSO_SETTINGS_KEY } from "../lib/sso/settings";
import { encryptSecret, isSecretConfigured, secretSource } from "../lib/sso/secrets";
import { ssoAudit } from "../lib/sso/audit";

const router: IRouter = Router();

// Strict SUPER_ADMIN gate: only users whose effective admin role is
// `super_admin` may manage the SSO subsystem (provider CRUD, settings,
// audit). Other admin sub-roles are explicitly denied.
function requireSuperAdmin(
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction,
): void {
  if (!req.user) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  if (req.user.role !== "admin" || effectiveAdminRole(req.user) !== "super_admin") {
    res.status(403).json({ error: "forbidden", message: "super_admin required" });
    return;
  }
  next();
}

function adminProvider(p: IdentityProvider) {
  return {
    id: p.id,
    slug: p.slug,
    type: p.type,
    displayName: p.displayName,
    displayNameAr: p.displayNameAr,
    enabled: p.enabled,
    isDefault: p.isDefault,
    issuerUrl: p.issuerUrl,
    clientId: p.clientId,
    // The raw secret (and its DB ciphertext) are write-only; admins only
    // see whether a secret is set and where it currently lives.
    secretConfigured: isSecretConfigured(p),
    secretSource: secretSource(p),
    scopes: p.scopes,
    autoProvision: p.autoProvision,
    defaultRole: p.defaultRole,
    allowedDomains: p.allowedDomains,
    roleMappingJson: p.roleMappingJson as Record<string, unknown>,
    metadata: p.metadata,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

router.use("/admin/sso", requireAuth, requireSuperAdmin);

router.get("/admin/sso/providers", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(identityProvidersTable)
    .orderBy(identityProvidersTable.id);
  res.json(rows.map(adminProvider));
});

router.post("/admin/sso/providers", async (req, res): Promise<void> => {
  const parsed = AdminCreateSsoProviderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const v = parsed.data;
  // Single-default invariant: only one provider may be the default at a time.
  if (v.isDefault) {
    await db
      .update(identityProvidersTable)
      .set({ isDefault: false })
      .where(eq(identityProvidersTable.isDefault, true));
  }
  // Admins may either supply an env-var pointer (`clientSecretRef`) or
  // paste the raw secret (`clientSecretValue`). The raw value is encrypted
  // at rest with AES-256-GCM and stored in `clientSecretEnc`. The two
  // sources are mutually exclusive: pasting a value clears any env ref.
  const rawSecret = v.clientSecretValue?.trim();
  let secretRefValue: string | null = v.clientSecretRef ?? null;
  let secretEncValue: string | null = null;
  if (rawSecret) {
    try {
      secretEncValue = encryptSecret(rawSecret);
      secretRefValue = null;
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Secret encryption failed",
      });
      return;
    }
  }
  const [created] = await db
    .insert(identityProvidersTable)
    .values({
      slug: v.slug,
      type: v.type,
      displayName: v.displayName,
      displayNameAr: v.displayNameAr ?? null,
      enabled: v.enabled ?? false,
      isDefault: v.isDefault ?? false,
      issuerUrl: v.issuerUrl ?? null,
      clientId: v.clientId ?? null,
      clientSecretRef: secretRefValue,
      clientSecretEnc: secretEncValue,
      scopes: v.scopes ?? "openid email profile",
      autoProvision: v.autoProvision ?? false,
      defaultRole: v.defaultRole ?? "client",
      allowedDomains: v.allowedDomains ?? [],
      roleMappingJson: (v.roleMappingJson ?? {}) as unknown,
      metadata: (v.metadata ?? {}) as Record<string, unknown>,
      createdById: req.user?.id ?? null,
    })
    .returning();
  if (!created) {
    res.status(500).json({ error: "Failed to create provider" });
    return;
  }
  await ssoAudit({
    req,
    action: "admin.sso.provider.create",
    outcome: "provider_change",
    providerId: created.id,
    providerSlug: created.slug,
    userId: req.user?.id ?? null,
  });
  res.json(adminProvider(created));
});

router.patch("/admin/sso/providers/:id", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const parsed = AdminUpdateSsoProviderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const v = parsed.data;
  const update: Partial<typeof identityProvidersTable.$inferInsert> = { updatedAt: new Date() };
  if (v.slug !== undefined) update.slug = v.slug;
  if (v.type !== undefined) update.type = v.type;
  if (v.displayName !== undefined) update.displayName = v.displayName;
  if (v.displayNameAr !== undefined) update.displayNameAr = v.displayNameAr ?? null;
  if (v.enabled !== undefined) update.enabled = v.enabled;
  if (v.isDefault !== undefined) {
    update.isDefault = v.isDefault;
    // Single-default invariant: clear isDefault on all other providers when
    // this one is being promoted to default.
    if (v.isDefault) {
      await db
        .update(identityProvidersTable)
        .set({ isDefault: false })
        .where(and(eq(identityProvidersTable.isDefault, true), sql`${identityProvidersTable.id} <> ${id}`));
    }
  }
  if (v.issuerUrl !== undefined) update.issuerUrl = v.issuerUrl ?? null;
  if (v.clientId !== undefined) update.clientId = v.clientId ?? null;
  // Secret rotation. Mutually exclusive — pasting a raw value wins over
  // (and clears) any env-var ref, and supplying a fresh ref clears any
  // previously-stored ciphertext. Omitting both fields leaves the existing
  // secret untouched.
  const rawSecret = v.clientSecretValue?.trim();
  if (rawSecret) {
    try {
      update.clientSecretEnc = encryptSecret(rawSecret);
      update.clientSecretRef = null;
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Secret encryption failed",
      });
      return;
    }
  } else if (v.clientSecretRef !== undefined) {
    update.clientSecretRef = v.clientSecretRef ?? null;
    update.clientSecretEnc = null;
  }
  if (v.scopes !== undefined) update.scopes = v.scopes ?? "openid email profile";
  if (v.autoProvision !== undefined) update.autoProvision = v.autoProvision;
  if (v.defaultRole !== undefined) update.defaultRole = v.defaultRole ?? "client";
  if (v.allowedDomains !== undefined) update.allowedDomains = v.allowedDomains;
  if (v.roleMappingJson !== undefined) update.roleMappingJson = v.roleMappingJson as unknown;
  if (v.metadata !== undefined) update.metadata = v.metadata as Record<string, unknown>;
  const [updated] = await db
    .update(identityProvidersTable)
    .set(update)
    .where(eq(identityProvidersTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Provider not found" });
    return;
  }
  await ssoAudit({
    req,
    action: "admin.sso.provider.update",
    outcome: "provider_change",
    providerId: updated.id,
    providerSlug: updated.slug,
    userId: req.user?.id ?? null,
  });
  res.json(adminProvider(updated));
});

router.delete("/admin/sso/providers/:id", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [removed] = await db
    .delete(identityProvidersTable)
    .where(eq(identityProvidersTable.id, id))
    .returning();
  if (!removed) {
    res.status(404).json({ error: "Provider not found" });
    return;
  }
  await ssoAudit({
    req,
    action: "admin.sso.provider.delete",
    outcome: "provider_change",
    providerId: removed.id,
    providerSlug: removed.slug,
    userId: req.user?.id ?? null,
  });
  res.json({ ok: true, message: "Provider deleted" });
});

router.post("/admin/sso/providers/:id/enable", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  const [updated] = await db
    .update(identityProvidersTable)
    .set({ enabled: true, updatedAt: new Date() })
    .where(eq(identityProvidersTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Provider not found" });
    return;
  }
  await ssoAudit({
    req,
    action: "admin.sso.provider.enable",
    outcome: "provider_change",
    providerId: updated.id,
    providerSlug: updated.slug,
    userId: req.user?.id ?? null,
  });
  res.json(adminProvider(updated));
});

router.post("/admin/sso/providers/:id/disable", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  const [updated] = await db
    .update(identityProvidersTable)
    .set({ enabled: false, updatedAt: new Date() })
    .where(eq(identityProvidersTable.id, id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Provider not found" });
    return;
  }
  await ssoAudit({
    req,
    action: "admin.sso.provider.disable",
    outcome: "provider_change",
    providerId: updated.id,
    providerSlug: updated.slug,
    userId: req.user?.id ?? null,
  });
  res.json(adminProvider(updated));
});

router.post("/admin/sso/providers/:id/test", async (req, res): Promise<void> => {
  const id = Number(req.params["id"]);
  const [provider] = await db
    .select()
    .from(identityProvidersTable)
    .where(eq(identityProvidersTable.id, id));
  if (!provider) {
    res.status(404).json({ error: "Provider not found" });
    return;
  }
  if (!provider.issuerUrl) {
    res.json({ ok: false, error: "issuerUrl not configured" });
    return;
  }
  try {
    const doc = await discover(provider.issuerUrl);
    const jwksRes = await fetch(doc.jwks_uri, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    let keys = 0;
    if (jwksRes.ok) {
      const j = (await jwksRes.json()) as { keys?: unknown[] };
      keys = Array.isArray(j.keys) ? j.keys.length : 0;
    }
    res.json({
      ok: true,
      issuer: doc.issuer,
      authorizationEndpoint: doc.authorization_endpoint,
      tokenEndpoint: doc.token_endpoint,
      jwksUri: doc.jwks_uri,
      jwksKeys: keys,
    });
  } catch (err) {
    res.json({
      ok: false,
      error: err instanceof Error ? err.message : "discovery failed",
    });
  }
});

router.get("/admin/sso/audit", async (req, res): Promise<void> => {
  const limit = Math.min(Number(req.query["limit"] ?? 200), 1000);
  const conds = [];
  if (req.query["providerId"]) {
    const pid = Number(req.query["providerId"]);
    if (Number.isFinite(pid)) conds.push(eq(loginAuditLogsTable.providerId, pid));
  }
  if (req.query["userId"]) {
    const uid = Number(req.query["userId"]);
    if (Number.isFinite(uid)) conds.push(eq(loginAuditLogsTable.userId, uid));
  }
  if (typeof req.query["outcome"] === "string") {
    conds.push(eq(loginAuditLogsTable.outcome, req.query["outcome"]));
  }
  if (typeof req.query["from"] === "string") {
    const d = new Date(req.query["from"]);
    if (!isNaN(d.getTime())) conds.push(gte(loginAuditLogsTable.createdAt, d));
  }
  if (typeof req.query["to"] === "string") {
    const d = new Date(req.query["to"]);
    if (!isNaN(d.getTime())) conds.push(lte(loginAuditLogsTable.createdAt, d));
  }
  const where = conds.length ? and(...conds) : undefined;
  const rows = await db
    .select()
    .from(loginAuditLogsTable)
    .where(where)
    .orderBy(desc(loginAuditLogsTable.createdAt))
    .limit(limit);
  res.json(rows);
});

router.get("/admin/sso/settings", async (_req, res): Promise<void> => {
  res.json(await loadSsoSettings());
});

router.put("/admin/sso/settings", async (req, res): Promise<void> => {
  const parsed = AdminUpdateSsoSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  await db
    .insert(platformSettingsTable)
    .values({
      key: SSO_SETTINGS_KEY,
      value: parsed.data,
      isPublic: 0,
      updatedById: req.user?.id ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: platformSettingsTable.key,
      set: { value: parsed.data, updatedById: req.user?.id ?? null, updatedAt: new Date() },
    });
  await ssoAudit({
    req,
    action: "admin.sso.settings.update",
    outcome: "provider_change",
    userId: req.user?.id ?? null,
  });
  res.json({ ...SSO_DEFAULT_SETTINGS, ...parsed.data });
});

export default router;
