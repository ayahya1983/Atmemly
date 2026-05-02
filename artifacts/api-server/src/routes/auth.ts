import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  usersTable,
  freelancerProfilesTable,
  clientProfilesTable,
} from "@workspace/db";
import {
  RegisterBody,
  LoginBody,
  GetMeResponse,
  RegisterResponse,
  LoginResponse,
} from "@workspace/api-zod";
import { hashPassword, verifyPassword, signToken, requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
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
      status: "active",
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
  const token = signToken(user.id);
  res.json(
    RegisterResponse.parse({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
    }),
  );
});

router.post("/auth/login", async (req, res): Promise<void> => {
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
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  if (user.status !== "active") {
    res.status(403).json({ error: "Account suspended" });
    return;
  }
  const token = signToken(user.id);
  res.json(
    LoginResponse.parse({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        status: user.status,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
    }),
  );
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  const u = req.user!;
  res.json(
    GetMeResponse.parse({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      status: u.status,
      avatarUrl: u.avatarUrl,
      createdAt: u.createdAt,
    }),
  );
});

export default router;
