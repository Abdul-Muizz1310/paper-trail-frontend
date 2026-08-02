import { describe, expect, it } from "vitest";

/**
 * Live health smoke check against the deployed backend.
 *
 * `SMOKE_HEALTH_URL` is intentionally NOT set in CI (see .github/workflows/ci.yml)
 * because the Render backend is currently billing-suspended and returns 503 --
 * an unconditional live check here would make every PR fail for reasons that
 * have nothing to do with this repo's code. Set it locally (e.g.
 * `SMOKE_HEALTH_URL=https://paper-trail-backend-jjpf.onrender.com pnpm test -- --run tests/smoke.test.ts`)
 * to actually exercise the live backend when it is warm.
 */
const healthUrl = process.env.SMOKE_HEALTH_URL;

describe("deployed backend health", () => {
  it.skipIf(!healthUrl)("GET /health on the live deployment returns 200", async () => {
    const res = await fetch(`${healthUrl}/health`, { cache: "no-store" });
    expect(res.status).toBe(200);
  });

  it.skipIf(!!healthUrl)(
    "skipped -- set SMOKE_HEALTH_URL to a deployed backend origin to run this live",
    () => {
      expect(healthUrl).toBeUndefined();
    },
  );
});
