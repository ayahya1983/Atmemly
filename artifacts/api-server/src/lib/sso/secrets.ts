import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

/**
 * SSO client-secret resolution.
 *
 * A provider may have its client secret supplied in one of two ways:
 *
 *  1. **Env-var reference** (`clientSecretRef`): a pointer like
 *     `env:GOOGLE_CLIENT_SECRET` (or a bare env var name for
 *     backwards compatibility). The actual value lives in the API
 *     server's environment and is never persisted in the database.
 *
 *  2. **Encrypted DB value** (`clientSecretEnc`): the admin pasted
 *     the raw secret in the SSO provider form and we encrypted it
 *     with AES-256-GCM (app-level AEAD) before storing it. Plaintext
 *     is never written to disk and never returned in API responses.
 *
 * `clientSecretEnc` takes precedence over `clientSecretRef` when both
 * happen to be set — admins picking the "paste raw value" mode always
 * win over a stale env reference.
 */

export const ENC_PREFIX = "v1:";

type SecretSource = {
  clientSecretRef: string | null | undefined;
  clientSecretEnc?: string | null | undefined;
};

function encryptionKey(): Buffer {
  const k =
    process.env["SSO_SECRET_ENC_KEY"] ??
    process.env["SESSION_SECRET"] ??
    process.env["JWT_SECRET"];
  if (!k || k.length < 8) {
    throw new Error(
      "SSO secret encryption key is not configured (set SSO_SECRET_ENC_KEY or SESSION_SECRET).",
    );
  }
  // Derive a stable 32-byte key from whatever entropy the operator gave us.
  return createHash("sha256").update(k).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ENC_PREFIX + Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decryptSecret(blob: string): string | null {
  if (!blob.startsWith(ENC_PREFIX)) return null;
  try {
    const buf = Buffer.from(blob.slice(ENC_PREFIX.length), "base64");
    if (buf.length < 12 + 16 + 1) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ct = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAuthTag(tag);
    const out = Buffer.concat([decipher.update(ct), decipher.final()]);
    return out.toString("utf8");
  } catch {
    return null;
  }
}

export function resolveClientSecret(source: SecretSource): string | null {
  const enc = source.clientSecretEnc?.trim();
  if (enc) {
    const v = decryptSecret(enc);
    if (v && v.length > 0) return v;
  }
  const ref = source.clientSecretRef?.trim();
  if (!ref) return null;
  let envName = ref;
  if (ref.startsWith("env:")) envName = ref.slice(4).trim();
  if (!envName) return null;
  const v = process.env[envName];
  return v && v.length > 0 ? v : null;
}

export function isSecretConfigured(source: SecretSource): boolean {
  return !!resolveClientSecret(source);
}

/**
 * Where does the secret currently live? Used by the admin UI to render
 * "stored in DB" vs "from env var" affordances. Returns `null` when no
 * secret is set at all.
 */
export function secretSource(
  source: SecretSource,
): "db" | "env" | null {
  if (source.clientSecretEnc && source.clientSecretEnc.trim()) {
    return decryptSecret(source.clientSecretEnc.trim()) ? "db" : null;
  }
  const ref = source.clientSecretRef?.trim();
  if (!ref) return null;
  let envName = ref;
  if (ref.startsWith("env:")) envName = ref.slice(4).trim();
  if (!envName) return null;
  const v = process.env[envName];
  return v && v.length > 0 ? "env" : null;
}
