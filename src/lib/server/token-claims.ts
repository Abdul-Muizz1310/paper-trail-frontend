import "server-only";

/**
 * The pure half of the platform token (spec 05 §1): the header, the claims
 * for a given instant, the signing input and the parse of the key's env
 * value. No key material and no `node:crypto` here; signing lives in
 * `platform-token.ts`.
 */

export const TOKEN_KEY_ID = "paper-trail-frontend-2026-10";
/** Platform contract v2: this frontend's issuer id; the backend ties it to this key. */
export const TOKEN_ISSUER = "paper-trail-frontend";
/** Platform contract v2: exactly one audience, the backend's service id (never an array). */
export const TOKEN_AUDIENCE = "paper-trail";
export const TOKEN_SUBJECT = "paper-trail-frontend";
export const TOKEN_ROLE = "frontend";
/** bastion's service id for paper-trail; the backend accepts a frontend token only for itself. */
export const TOKEN_SERVICE = "paper-trail";
export const TOKEN_TTL_SECONDS = 60;

export type PlatformTokenHeader = {
  readonly alg: "EdDSA";
  readonly typ: "JWT";
  readonly kid: typeof TOKEN_KEY_ID;
};

export type PlatformTokenClaims = {
  readonly iss: typeof TOKEN_ISSUER;
  readonly aud: typeof TOKEN_AUDIENCE;
  readonly sub: typeof TOKEN_SUBJECT;
  readonly role: typeof TOKEN_ROLE;
  readonly service: typeof TOKEN_SERVICE;
  readonly iat: number;
  readonly exp: number;
  readonly jti: string;
};

export const TOKEN_HEADER: PlatformTokenHeader = Object.freeze({
  alg: "EdDSA",
  typ: "JWT",
  kid: TOKEN_KEY_ID,
});

/** RFC 4648 §5 base64url without padding, as JWS requires (RFC 7515 §2). */
export function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

/** The claims of a token minted at `nowMs`: whole-second `iat`, a 60-second life. */
export function tokenClaims(nowMs: number, jti: string): PlatformTokenClaims {
  const iat = Math.floor(nowMs / 1000);
  return {
    iss: TOKEN_ISSUER,
    aud: TOKEN_AUDIENCE,
    sub: TOKEN_SUBJECT,
    role: TOKEN_ROLE,
    service: TOKEN_SERVICE,
    iat,
    exp: iat + TOKEN_TTL_SECONDS,
    jti,
  };
}

function encodeJson(value: unknown): string {
  return base64url(new TextEncoder().encode(JSON.stringify(value)));
}

/** `base64url(header) "." base64url(claims)`: the bytes the signature covers. */
export function signingInput(header: PlatformTokenHeader, claims: PlatformTokenClaims): string {
  return `${encodeJson(header)}.${encodeJson(claims)}`;
}

export type ParsedKeyEnv =
  | { readonly kind: "missing" }
  | { readonly kind: "malformed" }
  | { readonly kind: "der"; readonly der: Uint8Array };

// Standard alphabet, groups of four, padding only at the very end.
const STRICT_BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

/**
 * Parse the private key's env value to DER bytes. A byte-order mark and edge
 * whitespace (a trailing newline or CRLF from a shell) are stripped first;
 * what remains must be strict base64 or it is malformed. Whether the bytes are
 * an Ed25519 PKCS#8 key is `platform-token.ts`'s question.
 */
export function parseKeyEnv(raw: string | undefined): ParsedKeyEnv {
  const value = (raw ?? "").replace(/^﻿/, "").trim();
  if (value === "") return { kind: "missing" };
  if (!STRICT_BASE64.test(value)) return { kind: "malformed" };
  return { kind: "der", der: new Uint8Array(Buffer.from(value, "base64")) };
}
