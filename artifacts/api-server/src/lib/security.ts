import type { RequestHandler } from "express";

/**
 * Lightweight security headers (helmet-equivalent subset, no extra dep).
 * Skips CSP for now since the marketplace web is on a different origin via the proxy.
 */
export function securityHeaders(): RequestHandler {
  return (_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-DNS-Prefetch-Control", "off");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Cross-Origin-Resource-Policy", "same-site");
    if (process.env.NODE_ENV === "production") {
      res.setHeader(
        "Strict-Transport-Security",
        "max-age=15552000; includeSubDomains",
      );
    }
    next();
  };
}
