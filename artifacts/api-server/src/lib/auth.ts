import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { db, usersTable, refreshTokensTable, type User } from "@workspace/db";
import type { Request, Response, NextFunction } from "express";

const JWT_SECRET =
  process.env["SESSION_SECRET"] ?? process.env["JWT_SECRET"] ?? "dev-insecure-secret-change-me";

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export const ACTIVE_OR_PENDING = new Set(["active", "pending_email_verification"]);
export const BLOCKED_STATUSES = new Set(["suspended", "banned", "deleted"]);

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signToken(userId: number, ttlSeconds: number = ACCESS_TOKEN_TTL_SECONDS): string {
  return jwt.sign({ uid: userId }, JWT_SECRET, { expiresIn: ttlSeconds });
}

export function verifyToken(token: string): { uid: number } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { uid: number };
    return decoded;
  } catch {
    return null;
  }
}

export function generateOpaqueToken(byteLength = 32): string {
  return randomBytes(byteLength).toString("base64url");
}

export function hashOpaqueToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function clientIp(req: Request): string {
  const fwd = req.header("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.ip ?? req.socket?.remoteAddress ?? "";
}

export function clientUa(req: Request): string {
  return (req.header("user-agent") ?? "").slice(0, 500);
}

export async function issueRefreshToken(
  userId: number,
  req: Request,
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateOpaqueToken(48);
  const tokenHash = hashOpaqueToken(token);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
  await db.insert(refreshTokensTable).values({
    userId,
    tokenHash,
    ip: clientIp(req) || null,
    userAgent: clientUa(req) || null,
    expiresAt,
  });
  return { token, expiresAt };
}

export async function rotateRefreshToken(
  presented: string,
  req: Request,
): Promise<{ user: User; newToken: string; accessToken: string } | null> {
  const tokenHash = hashOpaqueToken(presented);
  const [row] = await db
    .select()
    .from(refreshTokensTable)
    .where(eq(refreshTokensTable.tokenHash, tokenHash));
  if (!row) return null;
  if (row.revokedAt) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, row.userId));
  if (!user) return null;
  if (BLOCKED_STATUSES.has(user.status)) return null;
  // revoke old, issue new
  await db
    .update(refreshTokensTable)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokensTable.id, row.id));
  const fresh = await issueRefreshToken(user.id, req);
  const accessToken = signToken(user.id);
  return { user, newToken: fresh.token, accessToken };
}

export async function revokeRefreshToken(presented: string): Promise<void> {
  const tokenHash = hashOpaqueToken(presented);
  await db
    .update(refreshTokensTable)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokensTable.tokenHash, tokenHash));
}

export async function revokeAllRefreshTokensForUser(userId: number): Promise<void> {
  await db
    .update(refreshTokensTable)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokensTable.userId, userId));
}

export async function loadUser(req: Request): Promise<User | null> {
  const header = req.header("authorization") || req.header("Authorization");
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice(7);
  const payload = verifyToken(token);
  if (!payload) return null;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.uid));
  return user ?? null;
}

export async function attachUser(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const user = await loadUser(req);
  if (user) req.user = user;
  next();
}

/**
 * Allows authenticated users whose status is `active` or `pending_email_verification`.
 * Blocks suspended/banned/deleted accounts. This is the default for most endpoints to
 * preserve backward compatibility with the existing frontend that does not yet have an
 * email-verification UI flow.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (BLOCKED_STATUSES.has(req.user.status)) {
    res.status(403).json({ error: "Account is " + req.user.status });
    return;
  }
  next();
}

/**
 * Stricter middleware: only fully-verified active accounts allowed.
 */
export function requireActiveAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (req.user.status !== "active") {
    res.status(403).json({ error: "Account not active" });
    return;
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}
