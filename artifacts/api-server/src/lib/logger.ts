import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  // ATMEMLY architecture audit (May 2026) — redact secrets and PII from logs.
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      'req.headers["x-api-key"]',
      'req.headers["x-webhook-signature"]',
      "res.headers['set-cookie']",
      "*.password",
      "*.passwordHash",
      "*.token",
      "*.tokenHash",
      "*.apiKey",
      "*.secret",
      "*.clientSecret",
      "*.cardNumber",
      "*.cvv",
    ],
    censor: "[REDACTED]",
  },
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
