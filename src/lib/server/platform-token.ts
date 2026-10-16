import "server-only";
import { createPrivateKey, type KeyObject, randomUUID, sign } from "node:crypto";
import { base64url, parseKeyEnv, signingInput, TOKEN_HEADER, tokenClaims } from "./token-claims";

/**
 * Signs the frontend's platform tokens (spec 05 §1). Server-only: the key and
 * this module must never reach a client bundle.
 */

/** Holds the Ed25519 private key, PKCS#8 DER base64. Server-only, never NEXT_PUBLIC_. */
export const SIGNING_KEY_ENV = "PAPER_TRAIL_FRONTEND_SIGNING_KEY_PRIVATE";

export type SigningKey =
  | { readonly ok: true; readonly key: KeyObject }
  | { readonly ok: false; readonly reason: "missing" | "malformed" };

/** Load the signing key from its env value. Never throws: a bad value is reported, not raised. */
export function loadSigningKey(raw: string | undefined): SigningKey {
  const parsed = parseKeyEnv(raw);
  if (parsed.kind !== "der") return { ok: false, reason: parsed.kind };
  let key: KeyObject;
  try {
    key = createPrivateKey({ key: Buffer.from(parsed.der), format: "der", type: "pkcs8" });
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (key.asymmetricKeyType !== "ed25519") return { ok: false, reason: "malformed" };
  return { ok: true, key };
}

/** A compact EdDSA JWS for one upstream request: fresh `jti`, 60-second life. */
export function mintPlatformToken(
  key: KeyObject,
  nowMs: number = Date.now(),
  jti: string = randomUUID(),
): string {
  const input = signingInput(TOKEN_HEADER, tokenClaims(nowMs, jti));
  const signature = sign(null, Buffer.from(input, "ascii"), key);
  return `${input}.${base64url(signature)}`;
}
