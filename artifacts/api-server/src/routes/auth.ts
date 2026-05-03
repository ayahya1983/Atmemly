import { Router, type IRouter } from "express";
import { and, eq, gt, isNull } from "drizzle-orm";
import {
  db,
  usersTable,
  freelancerProfilesTable,
  clientProfilesTable,
  emailVerificationTokensTable,
  passwordResetTokensTable,
} from "@workspace/db";
import {
  RegisterBody,
  LoginBody,
  GetMeResponse,
  RegisterResponse,
  LoginResponse,
  RefreshTokenBody,
  RefreshTokenResponse,
  LogoutBody,
  LogoutResponse,
  ForgotPasswordBody,
  ForgotPasswordResponse,
  ResetPasswordBody,
  ResetPasswordResponse,
  VerifyEmailBody,
  VerifyEmailResponse,
  ResendVerificationResponse,
  ChangePasswordBody,
  ChangePasswordResponse,
} from "@workspace/api-zod";
import {
  hashPassword,
  verifyPassword,
  signToken,
  requireAuth,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllRefreshTokensForUser,
  generateOpaqueToken,
  hashOpaqueToken,
  clientIp,
  clientUa,
  ACTIVE_OR_PENDING,
  BLOCKED_STATUSES,
} from "../lib/auth";
import { audit } from "../lib/audit";
import { rateLimit } from "../lib/rateLimit";

const router: IRouter = Router();

// Phase 3 — rate limits to slow brute force / abuse on the auth surface.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyPrefix: "auth:login",
  message: "Too many login attempts. Please try again in a few minutes.",
});
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyPrefix: "auth:register",
  message: "Too many sign-ups from this IP. Try again later.",
});
const forgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  keyPrefix: "auth:forgot",
  message: "Too many password reset requests. Try again later.",
});
const refreshLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 60,
  keyPrefix: "auth:refresh",
});

const isDev = process.env["NODE_ENV"] !== "production";

function meFromUser(u: typeof usersTable.$inferSelect, verificationStatus = "not_submitted") {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    adminRole: u.adminRole ?? null,
    status: u.status,
    avatarUrl: u.avatarUrl,
    createdAt: u.createdAt,
    emailVerifiedAt: u.emailVerifiedAt,
    lastLoginAt: u.lastLoginAt,
    phone: u.phone,
    country: u.country,
    city: u.city,
    verificationStatus,
  };
}

async function loadVerificationStatus(userId: number, role: string): Promise<string> {
  if (role === "freelancer") {
    const [fp] = await db
      .select({ s: freelancerProfilesTable.verificationStatus })
      .from(freelancerProfilesTable)
      .where(eq(freelancerProfilesTable.userId, userId));
    return fp?.s ?? "not_submitted";
  }
  if (role === "client") {
    const [cp] = await db
      .select({ s: clientProfilesTable.verificationStatus })
      .from(clientProfilesTable)
      .where(eq(clientProfilesTable.userId, userId));
    return cp?.s ?? "not_submitted";
  }
  return "not_submitted";
}

router.post("/auth/register", registerLimiter, async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email, password, fullName, role, companyName } = parsed.data;
  if (!["client", "freelancer"].includes(role)) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (existing.length > 0) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }
  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(usersTable)
    .values({
      email: email.toLowerCase(),
      passwordHash,
      fullName,
      role,
      status: "pending_email_verification",
    })
    .returning();
  if (!user) {
    res.status(500).json({ error: "Failed to create user" });
    return;
  }
  if (role === "freelancer") {
    await db.insert(freelancerProfilesTable).values({ userId: user.id });
  } else {
    await db.insert(clientProfilesTable).values({
      userId: user.id,
      companyName: companyName ?? "",
    });
  }

  // create email verification token
  const verifyTokenPlain = generateOpaqueToken(32);
  await db.insert(emailVerificationTokensTable).values({
    userId: user.id,
    tokenHash: hashOpaqueToken(verifyTokenPlain),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 days
  });

  const token = signToken(user.id);
  const refresh = await issueRefreshToken(user.id, req);
  await audit(req, "user.register", "user", user.id, { role });

  res.json(
    RegisterResponse.parse({
      token,
      refreshToken: refresh.token,
      emailVerificationDevToken: isDev ? verifyTokenPlain : null,
      user: meFromUser(user),
    }),
  );
});

router.post("/auth/login", loginLimiter, async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, parsed.data.email.toLowerCase()));
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) {
    await audit(req, "user.login_failed", "user", user.id, { reason: "bad_password" });
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  if (BLOCKED_STATUSES.has(user.status)) {
    await audit(req, "user.login_blocked", "user", user.id, { status: user.status });
    res.status(403).json({ error: `Account ${user.status}` });
    return;
  }
  if (!ACTIVE_OR_PENDING.has(user.status)) {
    res.status(403).json({ error: "Account inactive" });
    return;
  }
  const token = signToken(user.id);
  const refresh = await issueRefreshToken(user.id, req);
  const [updated] = await db
    .update(usersTable)
    .set({
      lastLoginAt: new Date(),
      lastLoginIp: clientIp(req) || null,
      lastLoginUa: clientUa(req) || null,
    })
    .where(eq(usersTable.id, user.id))
    .returning();
  await audit(req, "user.login", "user", user.id);
  const verificationStatus = await loadVerificationStatus(user.id, user.role);
  res.json(
    LoginResponse.parse({
      token,
      refreshToken: refresh.token,
      emailVerificationDevToken: null,
      user: meFromUser(updated ?? user, verificationStatus),
    }),
  );
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const u = req.user!;
  const verificationStatus = await loadVerificationStatus(u.id, u.role);
  res.json(GetMeResponse.parse(meFromUser(u, verificationStatus)));
});

router.post("/auth/refresh", refreshLimiter, async (req, res): Promise<void> => {
  const parsed = RefreshTokenBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const result = await rotateRefreshToken(parsed.data.refreshToken, req);
  if (!result) {
    res.status(401).json({ error: "Invalid refresh token" });
    return;
  }
  await audit(req, "user.token_refreshed", "user", result.user.id);
  const verificationStatus = await loadVerificationStatus(result.user.id, result.user.role);
  res.json(
    RefreshTokenResponse.parse({
      token: result.accessToken,
      refreshToken: result.newToken,
      emailVerificationDevToken: null,
      user: meFromUser(result.user, verificationStatus),
    }),
  );
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const parsed = LogoutBody.safeParse(req.body ?? {});
  if (parsed.success && parsed.data.refreshToken) {
    await revokeRefreshToken(parsed.data.refreshToken);
  }
  if (req.user) {
    await audit(req, "user.logout", "user", req.user.id);
  }
  res.json(LogoutResponse.parse({ ok: true, message: null }));
});

router.post("/auth/forgot-password", forgotLimiter, async (req, res): Promise<void> => {
  const parsed = ForgotPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, parsed.data.email.toLowerCase()));
  let devToken: string | null = null;
  if (user && !BLOCKED_STATUSES.has(user.status)) {
    const plain = generateOpaqueToken(32);
    await db.insert(passwordResetTokensTable).values({
      userId: user.id,
      tokenHash: hashOpaqueToken(plain),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60), // 1 hour
    });
    if (isDev) devToken = plain;
    await audit(req, "user.forgot_password_requested", "user", user.id);
  }
  res.json(ForgotPasswordResponse.parse({ ok: true, devToken }));
});

router.post("/auth/reset-password", forgotLimiter, async (req, res): Promise<void> => {
  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tokenHash = hashOpaqueToken(parsed.data.token);
  const [row] = await db
    .select()
    .from(passwordResetTokensTable)
    .where(
      and(
        eq(passwordResetTokensTable.tokenHash, tokenHash),
        isNull(passwordResetTokensTable.usedAt),
        gt(passwordResetTokensTable.expiresAt, new Date()),
      ),
    );
  if (!row) {
    res.status(400).json({ error: "Invalid or expired token" });
    return;
  }
  if (parsed.data.newPassword.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }
  const passwordHash = await hashPassword(parsed.data.newPassword);
  await db
    .update(usersTable)
    .set({ passwordHash })
    .where(eq(usersTable.id, row.userId));
  await db
    .update(passwordResetTokensTable)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokensTable.id, row.id));
  await revokeAllRefreshTokensForUser(row.userId);
  await audit(req, "user.password_reset", "user", row.userId);
  res.json(ResetPasswordResponse.parse({ ok: true, message: "Password reset" }));
});

router.post("/auth/verify-email", async (req, res): Promise<void> => {
  const parsed = VerifyEmailBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const tokenHash = hashOpaqueToken(parsed.data.token);
  const [row] = await db
    .select()
    .from(emailVerificationTokensTable)
    .where(
      and(
        eq(emailVerificationTokensTable.tokenHash, tokenHash),
        isNull(emailVerificationTokensTable.usedAt),
        gt(emailVerificationTokensTable.expiresAt, new Date()),
      ),
    );
  if (!row) {
    res.status(400).json({ error: "Invalid or expired token" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, row.userId));
  if (!user) {
    res.status(400).json({ error: "User not found" });
    return;
  }
  await db
    .update(usersTable)
    .set({
      emailVerifiedAt: new Date(),
      status: user.status === "pending_email_verification" ? "active" : user.status,
    })
    .where(eq(usersTable.id, row.userId));
  await db
    .update(emailVerificationTokensTable)
    .set({ usedAt: new Date() })
    .where(eq(emailVerificationTokensTable.id, row.id));
  await audit(req, "user.email_verified", "user", row.userId);
  res.json(VerifyEmailResponse.parse({ ok: true, message: "Email verified" }));
});

router.post("/auth/resend-verification", async (req, res): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (req.user.emailVerifiedAt) {
    res.json(ResendVerificationResponse.parse({ ok: true, devToken: null }));
    return;
  }
  const plain = generateOpaqueToken(32);
  await db.insert(emailVerificationTokensTable).values({
    userId: req.user.id,
    tokenHash: hashOpaqueToken(plain),
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
  });
  await audit(req, "user.email_verification_resent", "user", req.user.id);
  res.json(ResendVerificationResponse.parse({ ok: true, devToken: isDev ? plain : null }));
});

router.post("/auth/change-password", requireAuth, async (req, res): Promise<void> => {
  const parsed = ChangePasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const ok = await verifyPassword(parsed.data.currentPassword, req.user!.passwordHash);
  if (!ok) {
    await audit(req, "user.change_password_failed", "user", req.user!.id);
    res.status(400).json({ error: "Current password incorrect" });
    return;
  }
  if (parsed.data.newPassword.length < 8) {
    res.status(400).json({ error: "New password must be at least 8 characters" });
    return;
  }
  const passwordHash = await hashPassword(parsed.data.newPassword);
  await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.id, req.user!.id));
  await revokeAllRefreshTokensForUser(req.user!.id);
  await audit(req, "user.password_changed", "user", req.user!.id);
  res.json(ChangePasswordResponse.parse({ ok: true, message: "Password changed" }));
});

export default router;
