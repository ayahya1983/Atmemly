import { useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";
import {
  useAdminListSsoProviders,
  useAdminCreateSsoProvider,
  useAdminUpdateSsoProvider,
  getAdminListSsoProvidersQueryKey,
  SsoProviderUpsertBodyType,
  type SsoProviderUpsertBody,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/admin";
import { ArrowLeft, Save } from "lucide-react";
import { BRAND } from "@workspace/branding";

const PROVIDER_TYPES = ["google", "microsoft", "linkedin", "keycloak", "oidc"] as const;

type ProviderType = (typeof SsoProviderUpsertBodyType)[keyof typeof SsoProviderUpsertBodyType];

interface FormState {
  slug: string;
  type: ProviderType;
  displayName: string;
  displayNameAr: string;
  enabled: boolean;
  isDefault: boolean;
  issuerUrl: string;
  clientId: string;
  /** Write-only: only sent on save when non-empty. Never returned by the API. */
  clientSecretRef: string;
  /** True when the existing record already has a secret configured. */
  hasSecret: boolean;
  scopes: string;
  autoProvision: boolean;
  defaultRole: string;
  allowedDomains: string;
  roleMappingJson: string;
}

const empty: FormState = {
  slug: "",
  type: "oidc",
  displayName: "",
  displayNameAr: "",
  enabled: false,
  isDefault: false,
  issuerUrl: "",
  clientId: "",
  clientSecretRef: "",
  hasSecret: false,
  scopes: "openid email profile",
  autoProvision: false,
  defaultRole: "client",
  allowedDomains: "",
  roleMappingJson: '{\n  "rules": [],\n  "default": { "role": "client" }\n}',
};

export default function AdminSsoProviderEdit() {
  const [, params] = useRoute("/sso/providers/:id");
  const [, setLocation] = useLocation();
  const id = params?.id ? Number(params.id) : null;
  const isNew = id === null;
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: list } = useAdminListSsoProviders();
  const createMut = useAdminCreateSsoProvider();
  const updateMut = useAdminUpdateSsoProvider();

  const [form, setForm] = useState<FormState>(empty);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNew || !list) return;
    const p = list.find((x) => x.id === id);
    if (!p) return;
    setForm({
      slug: p.slug,
      type: p.type as ProviderType,
      displayName: p.displayName,
      displayNameAr: p.displayNameAr ?? "",
      enabled: p.enabled,
      isDefault: p.isDefault,
      issuerUrl: p.issuerUrl ?? "",
      clientId: p.clientId ?? "",
      clientSecretRef: "",
      hasSecret: p.secretConfigured,
      scopes: p.scopes,
      autoProvision: p.autoProvision,
      defaultRole: p.defaultRole,
      allowedDomains: (p.allowedDomains ?? []).join(", "),
      roleMappingJson: JSON.stringify(p.roleMappingJson ?? {}, null, 2),
    });
  }, [id, isNew, list]);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const onSave = async () => {
    setError(null);
    let parsed: unknown = {};
    try {
      parsed = form.roleMappingJson.trim() ? JSON.parse(form.roleMappingJson) : {};
    } catch {
      setError("Role mapping is not valid JSON");
      return;
    }
    const payload = {
      slug: form.slug.trim(),
      type: form.type,
      displayName: form.displayName.trim(),
      displayNameAr: form.displayNameAr.trim() || null,
      enabled: form.enabled,
      isDefault: form.isDefault,
      issuerUrl: form.issuerUrl.trim() || null,
      clientId: form.clientId.trim() || null,
      // Only include the secret reference when the admin entered a new value.
      // Omitting the field leaves the existing reference untouched on update.
      ...(form.clientSecretRef.trim()
        ? { clientSecretRef: form.clientSecretRef.trim() }
        : {}),
      scopes: form.scopes.trim() || "openid email profile",
      autoProvision: form.autoProvision,
      defaultRole: form.defaultRole,
      allowedDomains: form.allowedDomains
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      roleMappingJson: parsed as Record<string, unknown>,
      metadata: {} as Record<string, unknown>,
    } satisfies SsoProviderUpsertBody;
    try {
      if (isNew) {
        await createMut.mutateAsync({ data: payload });
        toast({ title: `${BRAND.name} SSO provider created` });
      } else {
        await updateMut.mutateAsync({ id: id!, data: payload });
        toast({ title: `${BRAND.name} SSO provider updated` });
      }
      await qc.invalidateQueries({ queryKey: getAdminListSsoProvidersQueryKey() });
      setLocation("/sso/providers");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  };

  return (
    <div className="container mx-auto py-8 max-w-3xl space-y-6">
      <PageHeader
        title={isNew ? "New SSO provider" : `Edit SSO provider`}
        description={`Provider-agnostic OIDC. ${BRAND.name} discovers endpoints from the issuer URL.`}
        actions={
          <Button variant="outline" onClick={() => setLocation("/sso/providers")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
          <CardDescription>Public details shown on {BRAND.name} login pages.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Slug</Label>
            <Input
              placeholder={`${BRAND.domain.split(".")[0]}-google`}
              value={form.slug}
              onChange={(e) => update("slug", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={form.type} onValueChange={(v) => update("type", v as ProviderType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROVIDER_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Display name</Label>
            <Input
              placeholder="Sign in with Google"
              value={form.displayName}
              onChange={(e) => update("displayName", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Display name (Arabic)</Label>
            <Input
              dir="rtl"
              placeholder="تسجيل الدخول عبر Google"
              value={form.displayNameAr}
              onChange={(e) => update("displayNameAr", e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={form.enabled} onCheckedChange={(v) => update("enabled", v)} />
            <Label>Enabled</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={form.isDefault} onCheckedChange={(v) => update("isDefault", v)} />
            <Label>Show first</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>OIDC connection</CardTitle>
          <CardDescription>
            Issuer URL must serve <code>/.well-known/openid-configuration</code>. The client secret
            value is read from an environment variable on the {BRAND.name} API server — only the
            reference is stored.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="space-y-2">
            <Label>Issuer URL</Label>
            <Input
              placeholder="https://accounts.google.com"
              value={form.issuerUrl}
              onChange={(e) => update("issuerUrl", e.target.value)}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Client ID</Label>
              <Input
                value={form.clientId}
                onChange={(e) => update("clientId", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Client secret reference
                {form.hasSecret ? (
                  <span
                    className="text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 bg-green-100 text-green-800"
                    data-testid="badge-secret-configured"
                  >
                    Configured
                  </span>
                ) : (
                  <span
                    className="text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 bg-amber-100 text-amber-800"
                    data-testid="badge-secret-missing"
                  >
                    Not set
                  </span>
                )}
              </Label>
              <Input
                type="password"
                autoComplete="new-password"
                placeholder={
                  form.hasSecret
                    ? "•••••••• (leave blank to keep)"
                    : "env:GOOGLE_CLIENT_SECRET"
                }
                value={form.clientSecretRef}
                onChange={(e) => update("clientSecretRef", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Write-only. Enter a new env-var reference (e.g.{" "}
                <code>env:GOOGLE_CLIENT_SECRET</code>) to rotate. The current value is never
                shown.
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Scopes</Label>
            <Input
              value={form.scopes}
              onChange={(e) => update("scopes", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Provisioning &amp; role mapping</CardTitle>
          <CardDescription>
            Decide how {BRAND.name} treats new accounts coming from this provider.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex items-center gap-3">
            <Switch
              checked={form.autoProvision}
              onCheckedChange={(v) => update("autoProvision", v)}
            />
            <Label>Auto-create {BRAND.name} accounts on first sign-in</Label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Default role</Label>
              <Select
                value={form.defaultRole}
                onValueChange={(v) => update("defaultRole", v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">client</SelectItem>
                  <SelectItem value="freelancer">freelancer</SelectItem>
                  <SelectItem value="admin">admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Allowed email domains (comma-separated)</Label>
              <Input
                placeholder={`${BRAND.domain}, partner.com`}
                value={form.allowedDomains}
                onChange={(e) => update("allowedDomains", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Role mapping (JSON)</Label>
            <Textarea
              rows={10}
              className="font-mono text-xs"
              value={form.roleMappingJson}
              onChange={(e) => update("roleMappingJson", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Example: {`{"rules":[{"claim":"email","matches":"*@${BRAND.domain}","role":"admin","adminRole":"super_admin"}],"default":{"role":"client"}}`}
            </p>
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-destructive text-sm">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setLocation("/sso/providers")}>
          Cancel
        </Button>
        <Button onClick={onSave} disabled={createMut.isPending || updateMut.isPending}>
          <Save className="w-4 h-4 mr-2" />
          {isNew ? "Create provider" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
