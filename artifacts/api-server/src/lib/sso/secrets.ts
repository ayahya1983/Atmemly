/**
 * Resolve a provider's client secret from `clientSecretRef`.
 *
 * Allowed reference formats:
 *  - "env:NAME"  → process.env.NAME
 *  - bare string → also treated as an env var name (backwards-compatible)
 *
 * The actual secret VALUE is never persisted in the database and never
 * returned in API responses. The DB only stores the reference.
 */
export function resolveClientSecret(ref: string | null | undefined): string | null {
  if (!ref) return null;
  const trimmed = ref.trim();
  if (!trimmed) return null;
  let envName = trimmed;
  if (trimmed.startsWith("env:")) {
    envName = trimmed.slice(4).trim();
  }
  if (!envName) return null;
  const v = process.env[envName];
  return v && v.length > 0 ? v : null;
}

export function isSecretConfigured(ref: string | null | undefined): boolean {
  return !!resolveClientSecret(ref);
}
