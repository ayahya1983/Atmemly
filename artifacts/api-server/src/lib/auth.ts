import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db, usersTable, type User } from "@workspace/db";
import type { Request, Response, NextFunction } from "express";

const JWT_SECRET =
  process.env["SESSION_SECRET"] ?? process.env["JWT_SECRET"] ?? "dev-insecure-secret-change-me";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signToken(userId: number): string {
  return jwt.sign({ uid: userId }, JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): { uid: number } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { uid: number };
    return decoded;
  } catch {
    return null;
  }
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

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (req.user.status !== "active") {
    res.status(403).json({ error: "Account suspended" });
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
