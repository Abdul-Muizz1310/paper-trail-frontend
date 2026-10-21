import { createPublicKey, verify } from "node:crypto";
import { expect, test } from "@playwright/test";
import type { ReceivedRequest } from "./fixtures/mock-backend";

/**
 * The composed flow of spec 05: no browser mocks at all. The browser talks to
 * the real Next server, whose real proxy signs and forwards to the local mock
 * backend started by tests/e2e/global-setup.ts.
 */

const MOCK = process.env.E2E_MOCK_BACKEND_URL ?? "";
const PUBLIC_KEY_B64 = process.env.E2E_SIGNING_KEY_PUBLIC ?? "";
const VISITOR = "203.0.113.7";

async function received(): Promise<ReceivedRequest[]> {
  const res = await fetch(`${MOCK}/__control/requests`);
  return (await res.json()) as ReceivedRequest[];
}

function decode(part: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;
}

/** Verified here, independently of the mock: the test's own public key, the backend's format. */
function verifiedClaims(token: string | null): Record<string, unknown> {
  const [h, c, s] = (token ?? "").split(".");
  const key = createPublicKey({
    key: Buffer.from(PUBLIC_KEY_B64, "base64"),
    format: "der",
    type: "spki",
  });
  expect(verify(null, Buffer.from(`${h}.${c}`, "ascii"), key, Buffer.from(s, "base64url"))).toBe(
    true,
  );
  expect(decode(h)).toEqual({ alg: "EdDSA", typ: "JWT", kid: "paper-trail-frontend-2026-10" });
  return decode(c);
}

test.describe("signed backend proxy, composed (spec 05)", () => {
  test.skip(!!process.env.E2E_LIVE, "mocked mode only: needs the local mock backend");

  test("P17 a debate runs end to end through the proxy, signed, streamed and without credentials", async ({
    page,
    context,
    request,
    baseURL,
  }) => {
    test.setTimeout(120_000);
    // `next dev` compiles a route on its first request; do it before the
    // home page's 10-second health probe depends on it.
    expect((await request.get("/api/backend/health")).status()).toBe(200);

    await context.addCookies([{ name: "pt_session", value: "must-not-leak", url: baseURL }]);
    await page.setExtraHTTPHeaders({
      authorization: "Bearer must-not-leak",
      "x-forwarded-for": VISITOR,
    });
    const direct: string[] = [];
    page.on("request", (req) => {
      if (req.url().startsWith(MOCK)) direct.push(req.url());
    });

    await page.goto("/");
    await expect(page.getByText("OK", { exact: true })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("textbox", { name: /claim/i }).fill("Composed claims travel signed.");
    await page.getByRole("button", { name: /start[- ]debate/i }).click();

    await expect(page).toHaveURL(/\/debates\/[0-9a-f-]{36}$/, { timeout: 30_000 });
    const id = new URL(page.url()).pathname.split("/").at(-1) ?? "";

    // Streamed, not buffered: the first state event renders while the backend
    // still holds the stream open, and the verdict waits for the release.
    await expect(page.locator("footer").getByText("streaming", { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("judge-verdict")).toHaveCount(0);
    const release = await fetch(`${MOCK}/__control/debates/${id}/release`, { method: "POST" });
    expect(release.status).toBe(204);

    await expect(page.getByTestId("judge-verdict")).toHaveAttribute("data-variant", "true", {
      timeout: 15_000,
    });
    await page.getByRole("link", { name: /transcript/i }).click();
    await expect(page).toHaveURL(new RegExp(`/debates/${id}/transcript$`));
    await expect(page.getByRole("heading", { name: /final reasoning/i })).toBeVisible({
      timeout: 30_000,
    });

    // The browser never called the backend's origin itself.
    expect(direct).toEqual([]);

    const all = await received();
    const mine = all.filter((r) => r.debateId === id);
    expect(mine.map((r) => `${r.method} ${r.path}`)).toEqual(
      expect.arrayContaining(["POST /debates", `GET /debates/${id}`, `GET /debates/${id}/stream`]),
    );
    const health = all.filter(
      (r) => r.path === "/health" && r.headers["x-forwarded-for"] === VISITOR,
    );
    expect(health.length).toBeGreaterThan(0);

    const jtis: unknown[] = [];
    for (const r of [...mine, ...health]) {
      expect(r.check.valid, `${r.method} ${r.path}`).toBe(true);
      const claims = verifiedClaims(r.token);
      expect(claims).toMatchObject({
        iss: "paper-trail-frontend",
        aud: "paper-trail",
        sub: "paper-trail-frontend",
        role: "frontend",
        service: "paper-trail",
      });
      expect(Number(claims.exp) - Number(claims.iat)).toBe(60);
      jtis.push(claims.jti);
      expect(r.headers.cookie, `${r.method} ${r.path}`).toBeNull();
      expect(r.headers.authorization, `${r.method} ${r.path}`).toBeNull();
      expect(r.headers.origin, `${r.method} ${r.path}`).toBeNull();
      expect(r.headers["x-forwarded-for"], `${r.method} ${r.path}`).toBe(VISITOR);
    }
    // A fresh token per upstream request.
    expect(new Set(jtis).size).toBe(jtis.length);
  });

  test("F11 a traversal path sent to the running server never reaches the backend", async ({
    request,
  }) => {
    for (const path of [
      "/api/backend/..%2F..%2Fadmin",
      "/api/backend/debates%5C..%5Cadmin",
      "/api/backend/debates/%252e%252e/admin",
      "/api/backend/%2e%2e/admin",
    ]) {
      const res = await request.get(path, { maxRedirects: 0 });
      expect([400, 404], path).toContain(res.status());
    }
    for (const r of await received()) {
      expect(r.path).not.toMatch(/admin|%2e|%5c|\\|\.\./i);
    }
  });
});
