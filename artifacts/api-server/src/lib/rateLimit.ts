import type { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Tiny in-memory sliding-window rate limiter. Sufficient for a single-instance
 * dev/MVP deployment; swap for Redis for multi-instance production.
 */
interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();

export function rateLimit(opts: {
  windowMs: number;
  max: number;
  keyPrefix?: string;
  message?: string;
}): RequestHandler {
  const prefix = opts.keyPrefix ?? "rl";
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip =
      req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      "unknown";
    const key = `${prefix}:${ip}`;
    const now = Date.now();
    const cutoff = now - opts.windowMs;
    const bucket = buckets.get(key) ?? { hits: [] };
    bucket.hits = bucket.hits.filter((t) => t > cutoff);
    if (bucket.hits.length >= opts.max) {
      res.setHeader("Retry-After", String(Math.ceil(opts.windowMs / 1000)));
      res
        .status(429)
        .json({ error: opts.message ?? "Too many requests, please try again later." });
      return;
    }
    bucket.hits.push(now);
    buckets.set(key, bucket);
    next();
  };
}

export function rateLimitStats(): { keys: number } {
  return { keys: buckets.size };
}
