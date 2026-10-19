// @vitest-environment node
import { createPublicKey, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { loadSigningKey, mintPlatformToken } from "@/lib/server/platform-token";
import { base64url } from "@/lib/server/token-claims";
import { checkToken } from "../../e2e/fixtures/mock-backend";
import { ed25519Pair } from "./keys";

/**
 * F13 (spec 05): the E2E mock backend checks a frontend token the way the
 * contract-v2 backend does, so the composed spec (proxy.spec.ts P17) proves
 * the proxy's tokens would pass the real one.
 */
const pair = ed25519Pair();
const loaded = loadSigningKey(pair.privateB64);
if (!loaded.ok) throw new Error("test key did not load");
const privateKey = loaded.key;
const publicKey = createPublicKey({
  key: Buffer.from(pair.publicB64, "base64"),
  format: "der",
  type: "spki",
});
const NOW_MS = 1_760_000_000_000;
const NOW_S = NOW_MS / 1000;

function withClaims(overrides: Record<string, unknown>): string {
  const [h, c] = mintPlatformToken(privateKey, NOW_MS, "j").split(".");
  const claims = { ...JSON.parse(Buffer.from(c, "base64url").toString()), ...overrides };
  for (const [name, value] of Object.entries(overrides)) {
    if (value === undefined) delete claims[name];
  }
  const body = base64url(new TextEncoder().encode(JSON.stringify(claims)));
  const signature = sign(null, Buffer.from(`${h}.${body}`, "ascii"), privateKey);
  return `${h}.${body}.${base64url(signature)}`;
}

describe("mock backend token check (contract v2)", () => {
  it("accepts a token the proxy mints", () => {
    expect(checkToken(mintPlatformToken(privateKey, NOW_MS, "j"), publicKey, NOW_S).valid).toBe(
      true,
    );
  });

  it.each([
    ["aud of another service", { aud: "magpie" }, "aud"],
    ["aud as a list", { aud: ["paper-trail"] }, "aud"],
    ["no aud", { aud: undefined }, "aud"],
    ["iss bastion", { iss: "bastion" }, "iss"],
    ["no iss", { iss: undefined }, "iss"],
  ])("F13 rejects %s", (_label, overrides, reason) => {
    expect(checkToken(withClaims(overrides), publicKey, NOW_S)).toEqual({ valid: false, reason });
  });
});
