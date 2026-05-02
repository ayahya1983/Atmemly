import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().regex(/^\d+$/),
  DATABASE_URL: z.string().min(10, "DATABASE_URL is required"),
  SESSION_SECRET: z.string().min(8, "SESSION_SECRET is required (min 8 chars)").optional(),
  JWT_SECRET: z.string().optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).optional(),
});

export type AppEnv = z.infer<typeof EnvSchema>;

export function validateEnv(): AppEnv {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid environment configuration — ${issues}`);
  }
  if (
    parsed.data.NODE_ENV === "production" &&
    !parsed.data.SESSION_SECRET &&
    !parsed.data.JWT_SECRET
  ) {
    throw new Error(
      "Production requires SESSION_SECRET (or JWT_SECRET) to be set explicitly.",
    );
  }
  return parsed.data;
}
