import { describe, expect, it } from "vitest";

/**
 * Post-deploy `/health` smoke check against the deployed backend.
 *
 * `SMOKE_BASE_URL` is intentionally NOT set in the main `test` job (see
 * .github/workflows/ci.yml) -- it is provided only to the dedicated `smoke`
 * job, which is gated to `push` events and reads the value from the
 * `SMOKE_BASE_URL` repository variable. That keeps a parked or cold
 * free-tier backend from ever turning a pull request red: unset (or blank)
 * means this file makes zero HTTP requests and skips cleanly.
 *
 * The variable is a bare origin -- no trailing slash, no path -- this file
 * joins it with `/health` using exactly one separator. Set it locally to
 * exercise the live backend when it is warm, e.g.
 * `SMOKE_BASE_URL=https://paper-trail-backend-jjpf.onrender.com pnpm exec vitest run tests/smoke.test.ts`.
 */
const baseUrl = process.env.SMOKE_BASE_URL;

/** Join `baseUrl` with `/health` using exactly one separator. */
function healthUrl(base: string): string {
  return `${base.replace(/\/+$/, "")}/health`;
}

// Render Free cold boots can take tens of seconds; give the live probe a
// generous budget so a cold-but-healthy backend isn't mistaken for a dead one.
const LIVE_PROBE_TIMEOUT_MS = 60_000;

describe("deployed backend health", () => {
  it.skipIf(!baseUrl)(
    "GET /health on the live deployment returns 200",
    async () => {
      const res = await fetch(healthUrl(baseUrl as string), { cache: "no-store" });
      expect(res.status).toBe(200);
    },
    LIVE_PROBE_TIMEOUT_MS,
  );

  it.skipIf(!!baseUrl)(
    "skipped -- set SMOKE_BASE_URL to a deployed backend origin to run this live",
    () => {
      expect(baseUrl).toBeUndefined();
    },
  );
});
