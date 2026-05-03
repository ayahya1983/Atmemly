import { z } from "zod";

// ATMEMLY architecture audit (May 2026) — Zod-validated env. Strict in
// production: any missing required secret throws at boot rather than
// silently degrading at first auth attempt.
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().regex(/^\d+$/),
  DATABASE_URL: z.string().min(10, "DATABASE_URL is required"),
  SESSION_SECRET: z.string().min(8, "SESSION_SECRET is required (min 8 chars)").optional(),
  JWT_SECRET: z.string().min(8, "JWT_SECRET must be at least 8 chars").optional(),
  REFRESH_TOKEN_SECRET: z.string().min(8).optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).optional(),
  // CORS allow-list (comma-separated origins). When unset, cors() accepts all
  // origins — fine for dev, but production should pin this explicitly.
  CORS_ORIGINS: z.string().optional(),
  // Optional gateway secrets — validated for shape if set, never required.
  STRIPE_SECRET_KEY: z
    .string()
    .regex(/^sk_(test|live)_[A-Za-z0-9_]+$/, "STRIPE_SECRET_KEY must look like sk_test_… or sk_live_…")
    .optional(),
  STRIPE_WEBHOOK_SECRET: z
    .string()
    .regex(/^whsec_[A-Za-z0-9]+$/, "STRIPE_WEBHOOK_SECRET must look like whsec_…")
    .optional(),
  // File storage backend. `local` writes to ./uploads on disk (default for
  // dev); `s3` writes to the bucket named by S3_BUCKET in AWS_REGION.
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  S3_BUCKET: z.string().min(1).optional(),
  AWS_REGION: z.string().min(1).optional(),
  S3_KEY_PREFIX: z.string().optional(),
})
.superRefine((v, ctx) => {
  if (v.STORAGE_DRIVER === "s3") {
    if (!v.S3_BUCKET) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["S3_BUCKET"],
        message: "S3_BUCKET is required when STORAGE_DRIVER=s3",
      });
    }
    if (!v.AWS_REGION) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["AWS_REGION"],
        message: "AWS_REGION is required when STORAGE_DRIVER=s3",
      });
    }
  }
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
  // In production, refuse to boot with an unsafe default JWT secret.
  if (
    parsed.data.NODE_ENV === "production" &&
    (parsed.data.JWT_SECRET === "dev-secret" || parsed.data.SESSION_SECRET === "dev-secret")
  ) {
    throw new Error("Refusing to boot in production with the dev-secret placeholder.");
  }
  return parsed.data;
}
