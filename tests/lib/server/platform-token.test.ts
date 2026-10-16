// @vitest-environment node
import { describe, expect, it } from "vitest";
import { loadSigningKey, mintPlatformToken, SIGNING_KEY_ENV } from "@/lib/server/platform-token";
import { decodePart, ed25519Pair, rsaPrivateB64, verifiesWith, x25519PrivateB64 } from "./keys";

const pair = ed25519Pair();

function keyOf(raw: string) {
  const loaded = loadSigningKey(raw);
  if (!loaded.ok) throw new Error(`test key did not load: ${loaded.reason}`);
  return loaded.key;
}

describe("loadSigningKey", () => {
  it("names the deployed variable", () => {
    expect(SIGNING_KEY_ENV).toBe("PAPER_TRAIL_FRONTEND_SIGNING_KEY_PRIVATE");
  });

  it("P7 loads an Ed25519 PKCS#8 DER base64 key", () => {
    const loaded = loadSigningKey(pair.privateB64);
    expect(loaded.ok).toBe(true);
    if (loaded.ok) expect(loaded.key.asymmetricKeyType).toBe("ed25519");
  });

  it("P7 loads the key wrapped in a BOM and a trailing CRLF", () => {
    expect(loadSigningKey(`﻿${pair.privateB64}\r\n`).ok).toBe(true);
  });

  it.each([
    ["unset", undefined],
    ["empty", ""],
    ["whitespace", "  \n"],
  ])("F1 %s → missing", (_label, raw) => {
    expect(loadSigningKey(raw)).toEqual({ ok: false, reason: "missing" });
  });

  it.each([
    ["not base64", "not a key!"],
    ["base64 of junk bytes", Buffer.from("definitely not DER").toString("base64")],
    ["the SPKI public key", pair.publicB64],
    ["an RSA private key", rsaPrivateB64()],
    ["an X25519 private key", x25519PrivateB64()],
  ])("F2 %s → malformed", (_label, raw) => {
    expect(loadSigningKey(raw)).toEqual({ ok: false, reason: "malformed" });
  });
});

describe("mintPlatformToken", () => {
  const key = keyOf(pair.privateB64);

  it("P5 is a compact JWS whose signature verifies against the backend-format public key", () => {
    const token = mintPlatformToken(key, 1_760_000_000_000, "11111111-2222-4333-8444-555555555555");
    const parts = token.split(".");
    expect(parts).toHaveLength(3);
    expect(verifiesWith(token, pair.publicB64)).toBe(true);
    expect(decodePart(parts[0])).toEqual({
      alg: "EdDSA",
      typ: "JWT",
      kid: "paper-trail-frontend-2026-10",
    });
    expect(decodePart(parts[1])).toEqual({
      sub: "paper-trail-frontend",
      role: "frontend",
      service: "paper-trail",
      iat: 1_760_000_000,
      exp: 1_760_000_060,
      jti: "11111111-2222-4333-8444-555555555555",
    });
  });

  it("P6 every mint has a fresh uuid jti and lives exactly 60 seconds from now", () => {
    const before = Math.floor(Date.now() / 1000);
    const a = decodePart(mintPlatformToken(key).split(".")[1]) as Record<string, number | string>;
    const b = decodePart(mintPlatformToken(key).split(".")[1]) as Record<string, number | string>;
    const after = Math.floor(Date.now() / 1000);
    expect(a.jti).not.toBe(b.jti);
    expect(a.jti).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    for (const claims of [a, b]) {
      expect(claims.iat).toBeGreaterThanOrEqual(before);
      expect(claims.iat).toBeLessThanOrEqual(after);
      expect(Number(claims.exp) - Number(claims.iat)).toBe(60);
    }
  });

  it("F3 does not verify against another key", () => {
    const token = mintPlatformToken(key);
    expect(verifiesWith(token, ed25519Pair().publicB64)).toBe(false);
  });

  it("F3 does not verify once its claims are altered", () => {
    const [h, , s] = mintPlatformToken(key).split(".");
    const forged = Buffer.from(
      JSON.stringify({
        sub: "paper-trail-frontend",
        role: "admin",
        service: "paper-trail",
        iat: 0,
        exp: 9_999_999_999,
        jti: "x",
      }),
    ).toString("base64url");
    expect(verifiesWith(`${h}.${forged}.${s}`, pair.publicB64)).toBe(false);
  });
});
