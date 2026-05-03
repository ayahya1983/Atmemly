import jwt from "jsonwebtoken";

/**
 * Short-lived signed token returned to the frontend when an SSO callback
 * succeeds against a provider but the resolved email matches an existing
 * verified ATMEMLY account that does NOT yet have this provider linked.
 *
 * The frontend must POST it back to /auth/sso/link with the user's
 * password to confirm ownership before we link the identity and issue a
 * normal session.
 */
const SECRET =
  process.env["SESSION_SECRET"] ?? process.env["JWT_SECRET"] ?? "dev-insecure-secret-change-me";

const TTL_SECONDS = 10 * 60; // 10 minutes

export interface LinkChallengePayload {
  uid: number;
  pid: number;
  ext: string;
  email: string;
  name?: string;
  raw?: Record<string, unknown>;
}

export function issueLinkChallenge(payload: LinkChallengePayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: TTL_SECONDS, audience: "sso-link" });
}

export function verifyLinkChallenge(token: string): LinkChallengePayload | null {
  try {
    const decoded = jwt.verify(token, SECRET, { audience: "sso-link" }) as LinkChallengePayload;
    return decoded;
  } catch {
    return null;
  }
}
