type Entry<V> = { value: V; expiresAt: number };

const store = new Map<string, Entry<unknown>>();

export function cacheGet<V>(key: string): V | undefined {
  const e = store.get(key) as Entry<V> | undefined;
  if (!e) return undefined;
  if (e.expiresAt < Date.now()) {
    store.delete(key);
    return undefined;
  }
  return e.value;
}

export function cacheSet<V>(key: string, value: V, ttlMs: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function cacheDelete(key: string): void {
  store.delete(key);
}

export function cacheDeletePrefix(prefix: string): void {
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}

export async function cached<V>(
  key: string,
  ttlMs: number,
  loader: () => Promise<V>,
): Promise<V> {
  const hit = cacheGet<V>(key);
  if (hit !== undefined) return hit;
  const value = await loader();
  cacheSet(key, value, ttlMs);
  return value;
}

export function cacheStats(): { size: number; keys: string[] } {
  return { size: store.size, keys: Array.from(store.keys()) };
}
