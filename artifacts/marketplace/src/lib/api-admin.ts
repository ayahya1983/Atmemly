import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";

const BASE = `${import.meta.env.BASE_URL}api`.replace(/\/+/g, "/");

function authHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export class AdminApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...authHeader(),
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let parsed: unknown = null;
    try { parsed = await res.json(); } catch { /* ignore */ }
    const detail =
      (parsed as any)?.message ||
      (parsed as any)?.error ||
      `${res.status} ${res.statusText}`;
    throw new AdminApiError(res.status, detail, parsed);
  }
  if (res.status === 204) return null as T;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return (await res.json()) as T;
  return (await res.text()) as T;
}

export const adminApi = {
  get: <T = unknown>(path: string) => request<T>("GET", path),
  post: <T = unknown>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  patch: <T = unknown>(path: string, body?: unknown) => request<T>("PATCH", path, body ?? {}),
  put: <T = unknown>(path: string, body?: unknown) => request<T>("PUT", path, body ?? {}),
  del: <T = unknown>(path: string) => request<T>("DELETE", path),
};

export function useAdminGet<T = unknown>(
  key: readonly unknown[],
  path: string,
  opts?: Partial<UseQueryOptions<T>>,
) {
  return useQuery<T>({
    queryKey: key,
    queryFn: () => adminApi.get<T>(path),
    staleTime: 15_000,
    ...opts,
  });
}

export function useAdminMutation<TInput = unknown, TOutput = unknown>(
  fn: (input: TInput) => Promise<TOutput>,
  invalidateKeys?: ReadonlyArray<readonly unknown[]>,
) {
  const qc = useQueryClient();
  return useMutation<TOutput, AdminApiError, TInput>({
    mutationFn: fn,
    onSuccess: () => {
      invalidateKeys?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
    },
  });
}

export function downloadCsv(path: string, filename: string): Promise<void> {
  return fetch(`${BASE}${path}`, {
    headers: { Accept: "text/csv", ...authHeader() },
  })
    .then(async (res) => {
      if (!res.ok) throw new AdminApiError(res.status, `${res.status} ${res.statusText}`, null);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
}
