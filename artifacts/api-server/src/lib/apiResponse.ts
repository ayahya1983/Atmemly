import type { Response } from "express";

export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  hasMore: boolean;
}

export interface ApiMeta {
  pagination?: PaginationMeta;
  [key: string]: unknown;
}

export interface ApiEnvelope<T> {
  data: T;
  meta?: ApiMeta;
}

export interface ApiErrorEnvelope {
  error: { code: string; message: string; details?: unknown };
}

export function respond<T>(res: Response, data: T, meta?: ApiMeta): void {
  const body: ApiEnvelope<T> = meta ? { data, meta } : { data };
  res.json(body);
}

export function respondError(
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown,
): void {
  const body: ApiErrorEnvelope = { error: { code, message, ...(details ? { details } : {}) } };
  res.status(status).json(body);
}

export function paginate(page: number, perPage: number, total: number): PaginationMeta {
  return { page, perPage, total, hasMore: page * perPage < total };
}

export function parsePagination(query: Record<string, unknown>): { page: number; perPage: number; offset: number } {
  const page = Math.max(1, Math.min(10000, Number(query["page"] ?? 1) || 1));
  const perPage = Math.max(1, Math.min(100, Number(query["perPage"] ?? 20) || 20));
  return { page, perPage, offset: (page - 1) * perPage };
}
