// Re-export of marketplace public api but using absolute /api base for the admin app.
import { useQuery } from "@tanstack/react-query";

const BASE = "/api";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export function usePublic<T>(key: readonly unknown[], path: string) {
  return useQuery({ queryKey: key, queryFn: () => getJson<T>(path), staleTime: 60_000 });
}
