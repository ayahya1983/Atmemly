import type { NextFunction, Request, Response } from "express";

interface State {
  startedAt: number;
  requestsTotal: number;
  byStatusClass: Record<string, number>;
  errors5xx: number;
  slowRequests: number;
  durations: number[];
  cap: number;
}

const state: State = {
  startedAt: Date.now(),
  requestsTotal: 0,
  byStatusClass: { "1xx": 0, "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 },
  errors5xx: 0,
  slowRequests: 0,
  durations: [],
  cap: 1000,
};

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const ns = Number(process.hrtime.bigint() - start);
    const ms = ns / 1e6;
    state.requestsTotal++;
    const cls = `${Math.floor(res.statusCode / 100)}xx`;
    state.byStatusClass[cls] = (state.byStatusClass[cls] ?? 0) + 1;
    if (res.statusCode >= 500) state.errors5xx++;
    if (ms > 1000) {
      state.slowRequests++;
      req.log?.warn?.({ url: req.originalUrl, method: req.method, ms: Math.round(ms) }, "slow request");
    }
    state.durations.push(ms);
    if (state.durations.length > state.cap) state.durations.shift();
  });
  next();
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length) - 1));
  return Math.round(sorted[idx]! * 100) / 100;
}

export function getMetricsSnapshot() {
  const mem = process.memoryUsage();
  return {
    uptimeSec: Math.round((Date.now() - state.startedAt) / 1000),
    nodeVersion: process.version,
    memoryMB: {
      rss: Math.round(mem.rss / 1024 / 1024),
      heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
    },
    requests: {
      total: state.requestsTotal,
      byStatusClass: state.byStatusClass,
      errors5xx: state.errors5xx,
      slowRequestsOver1s: state.slowRequests,
    },
    latencyMs: {
      sampleSize: state.durations.length,
      p50: percentile(state.durations, 50),
      p95: percentile(state.durations, 95),
      p99: percentile(state.durations, 99),
    },
  };
}
