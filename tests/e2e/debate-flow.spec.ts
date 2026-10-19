import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Route, test } from "@playwright/test";

// Valid RFC 4122 v4 UUID (version=4, variant=8..b). Zod v4 enforces this.
const DEBATE_ID = "11111111-1111-4111-8111-111111111111";
// Browser calls go to the frontend's own signing proxy (spec 05), so the
// mocks match its prefix; scoping them to it keeps them off the app's own
// /debates/ID page. The proxy itself is driven, unmocked, by proxy.spec.ts.
const API = "**/api/backend";
const TRANSCRIPT_MD = readFileSync(path.join(__dirname, "fixtures", "transcript.md"), "utf-8");

/** Answer a proxied call in the browser. Same-origin, so no CORS headers. */
async function fulfill(
  route: Route,
  opts: { status?: number; contentType?: string; body?: string },
) {
  return route.fulfill({
    status: opts.status ?? 200,
    contentType: opts.contentType ?? "application/json",
    body: opts.body ?? "",
  });
}

function sseBody(events: Array<[string, unknown]>): string {
  return events.map(([ev, data]) => `event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`).join("");
}

function debateJson(rounds: number, done = false, withTranscript = false) {
  return JSON.stringify({
    id: DEBATE_ID,
    claim: "Remote work reduces productivity.",
    status: done ? "done" : "running",
    verdict: done ? "TRUE" : null,
    confidence: done ? 0.78 : null,
    rounds: Array.from({ length: rounds }, (_, i) => ({
      index: i,
      side: i % 2 === 0 ? "pro" : "con",
      claim: `round ${i}`,
      body_md: `Round ${i} body`,
      evidence: [],
    })),
    transcript_md: withTranscript ? TRANSCRIPT_MD : null,
    created_at: "2026-04-09T12:00:00Z",
  });
}

test.describe("debate flow (mocked backend)", () => {
  test("P1 happy path: submit claim → stream → verdict → transcript", async ({ page }) => {
    let getCallCount = 0;
    // Completion is tied to the stream's lifecycle, never to a GET count.
    // DebateView invalidates the debate query from SSE state events *and*
    // once more on the terminal event, and React Query coalesces concurrent
    // refetches of the same key — so when a state-event refetch is still in
    // flight as the done event lands, the two collapse into a single request.
    // How many GETs the page issues is therefore a function of machine speed.
    // The old mock only reported `done` on the 3rd GET, so a slow runner saw
    // 2 and the verdict never arrived: that is what timed out here, three
    // retries deep, while the same test passed on faster runs.
    let streamCompleted = false;

    await page.route(`${API}/debates`, async (route, request) => {
      if (request.method() !== "POST") return route.fallback();
      return fulfill(route, {
        status: 201,
        body: JSON.stringify({
          debate_id: DEBATE_ID,
          stream_url: `/debates/${DEBATE_ID}/stream`,
        }),
      });
    });

    await page.route(`${API}/debates/${DEBATE_ID}`, async (route, request) => {
      if (request.method() !== "GET") return route.fallback();
      getCallCount += 1;
      // Before the stream finishes: running, with rounds accumulating. After
      // it finishes: complete, with transcript_md populated for the
      // transcript page. Every ordering now converges on the verdict, so no
      // path can stall waiting for an Nth call that never comes.
      const rounds = streamCompleted ? 3 : Math.min(getCallCount, 2);
      return fulfill(route, {
        body: debateJson(rounds, streamCompleted, streamCompleted),
      });
    });

    await page.route(`${API}/debates/${DEBATE_ID}/stream`, async (route) => {
      const served = fulfill(route, {
        contentType: "text/event-stream",
        body: sseBody([
          [
            "state",
            { type: "state", status: "running", verdict: null, confidence: null, rounds_count: 1 },
          ],
          [
            "state",
            { type: "state", status: "running", verdict: null, confidence: null, rounds_count: 2 },
          ],
          [
            "done",
            { type: "done", status: "done", verdict: "TRUE", confidence: 0.78, rounds_count: 3 },
          ],
        ]),
      });
      // The body carries the terminal event, so once it is handed to the
      // browser the debate is complete as far as the backend is concerned.
      // Set the flag after fulfilling so a GET racing the stream still sees
      // the running snapshot rather than a half-applied one.
      await served;
      streamCompleted = true;
    });

    await page.goto("/");
    await page.getByRole("textbox", { name: /claim/i }).fill("Remote work reduces productivity.");
    await page.getByRole("button", { name: /start[- ]debate/i }).click();

    await expect(page).toHaveURL(new RegExp(`/debates/${DEBATE_ID}$`));
    await expect(page.getByTestId("judge-verdict")).toHaveAttribute("data-variant", "true", {
      timeout: 10_000,
    });

    await page.getByRole("link", { name: /transcript/i }).click();
    await expect(page).toHaveURL(new RegExp(`/debates/${DEBATE_ID}/transcript$`));
    await expect(page.getByRole("heading", { name: /final reasoning/i })).toBeVisible();
  });

  test("P2 a stream cut (done + reason timeout) is renewed and the verdict still arrives", async ({
    page,
  }) => {
    // The backend closes every stream after 120 s with {type:"done",
    // reason:"timeout"} while the debate keeps running (spec 01). The page
    // must reopen the stream, not freeze without a verdict.
    let streamCalls = 0;
    let finished = false;
    await page.route(`${API}/debates/${DEBATE_ID}`, async (route, request) => {
      if (request.method() !== "GET") return route.fallback();
      return fulfill(route, { body: debateJson(finished ? 3 : 1, finished, finished) });
    });
    await page.route(`${API}/debates/${DEBATE_ID}/stream`, async (route) => {
      streamCalls += 1;
      if (streamCalls === 1) {
        return fulfill(route, {
          contentType: "text/event-stream",
          body: sseBody([
            [
              "state",
              {
                type: "state",
                status: "running",
                verdict: null,
                confidence: null,
                rounds_count: 1,
              },
            ],
            ["done", { type: "done", reason: "timeout" }],
          ]),
        });
      }
      const served = fulfill(route, {
        contentType: "text/event-stream",
        body: sseBody([
          [
            "state",
            { type: "state", status: "done", verdict: "TRUE", confidence: 0.78, rounds_count: 3 },
          ],
          [
            "done",
            { type: "done", status: "done", verdict: "TRUE", confidence: 0.78, rounds_count: 3 },
          ],
        ]),
      });
      await served;
      finished = true;
    });

    await page.goto(`/debates/${DEBATE_ID}`);
    await expect(page.getByTestId("judge-verdict")).toHaveAttribute("data-variant", "true", {
      timeout: 10_000,
    });
    expect(streamCalls).toBe(2);
  });

  test("F5 a debate that ends in error says it failed instead of waiting for a verdict", async ({
    page,
  }) => {
    await page.route(`${API}/debates/${DEBATE_ID}`, async (route, request) => {
      if (request.method() !== "GET") return route.fallback();
      return fulfill(route, {
        body: JSON.stringify({ ...JSON.parse(debateJson(2)), status: "error" }),
      });
    });
    await page.route(`${API}/debates/${DEBATE_ID}/stream`, (route) =>
      fulfill(route, {
        contentType: "text/event-stream",
        body: sseBody([
          [
            "state",
            { type: "state", status: "error", verdict: null, confidence: null, rounds_count: 2 },
          ],
          ["done", { type: "done", status: "error", verdict: null, confidence: null }],
        ]),
      }),
    );
    await page.goto(`/debates/${DEBATE_ID}`);
    await expect(page.getByTestId("debate-failed")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("judge-verdict")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /transcript/i })).toHaveCount(0);
  });

  test("F1 invalid UUID route → 404 and zero stream requests", async ({ page }) => {
    const streamRequests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/stream")) streamRequests.push(req.url());
    });
    const resp = await page.goto("/debates/not-a-uuid");
    expect(resp?.status()).toBe(404);
    expect(streamRequests).toHaveLength(0);
  });

  test("F2 backend 404 on debate → error state with Go home link", async ({ page }) => {
    await page.route(`${API}/debates/${DEBATE_ID}`, (route) =>
      fulfill(route, { status: 404, body: '{"detail":"debate not found"}' }),
    );
    await page.route(`${API}/debates/${DEBATE_ID}/stream`, (route) =>
      fulfill(route, {
        contentType: "text/event-stream",
        body: sseBody([["error", { reason: "not_found" }]]),
      }),
    );
    await page.goto(`/debates/${DEBATE_ID}`);
    await expect(page.getByText("Couldn't load this debate.")).toBeVisible();
    await expect(page.getByRole("link", { name: /go home/i })).toHaveAttribute("href", "/");
  });

  test("F3 transcript backend error → transcript-error state", async ({ page }) => {
    await page.route(`${API}/debates/${DEBATE_ID}`, (route) =>
      fulfill(route, { status: 404, body: '{"detail":"debate not found"}' }),
    );
    await page.route(`${API}/debates/${DEBATE_ID}/stream`, (route) =>
      fulfill(route, {
        contentType: "text/event-stream",
        body: sseBody([["error", { reason: "not_found" }]]),
      }),
    );
    await page.goto(`/debates/${DEBATE_ID}/transcript`);
    await expect(page.getByTestId("transcript-error")).toBeVisible();
  });

  test("F4 POST /debates fails → inline error + claim preserved", async ({ page }) => {
    await page.route(`${API}/debates`, async (route, request) => {
      if (request.method() !== "POST") return route.fallback();
      return fulfill(route, { status: 500, body: '{"detail":"boom"}' });
    });
    await page.goto("/");
    await page.getByRole("textbox", { name: /claim/i }).fill("my precious claim");
    await page.getByRole("button", { name: /start[- ]debate/i }).click();
    await expect(page.getByText(/couldn't start the debate/i)).toBeVisible();
    await expect(page.getByRole("textbox", { name: /claim/i })).toHaveValue("my precious claim");
  });
});

// See docs/specs/03-e2e.md "Live smoke (nightly, E2E_LIVE=1)". Skipped unless
// E2E_LIVE is set, so no normal PR run depends on the live backend; run by
// .github/workflows/nightly-e2e.yml, which fails when this fails. It drives the
// app exactly as a visitor does: the browser calls the frontend's own signing
// proxy, which signs with the real key and forwards to the deployed backend.
// One real debate per run spends ~4 requests of the account's 50 free-model
// requests a day, so live mode runs it once, without retries.
test.describe("L1 live smoke (nightly only, real backend)", () => {
  test.skip(!process.env.E2E_LIVE, "set E2E_LIVE=1 to run this against the real deployed backend");

  test("a real claim reaches a TRUE verdict and a transcript through the signed proxy", async ({
    page,
    request,
  }) => {
    test.setTimeout(600_000);

    // Wake the free-tier backend first (a cold start takes ~70 s) through the
    // proxy, so the 30 s create-debate timeout measures the app, not Render.
    // A 503 here means the proxy has no signing key; a 401 that the backend
    // rejected its token.
    const health = await request.get("/api/backend/health", { timeout: 150_000 });
    expect(health.status(), "GET /api/backend/health").toBe(200);
    expect(await health.json()).toMatchObject({ status: "ok", db: "ok" });

    await page.goto("/");
    await page.getByRole("textbox", { name: /claim/i }).fill("The Eiffel Tower is in Paris.");
    // The fewest rounds the UI offers: the debate spends free-tier requests.
    await page.getByRole("button", { name: /advanced/i }).click();
    await page.getByLabel(/max-rounds/i).selectOption("3");
    await page.getByRole("button", { name: /start[- ]debate/i }).click();

    // POST /debates went through the proxy and the backend accepted the token.
    // (Before the proxy, the browser's untokened POST got 401 and the page
    // never left home, which surfaced only as "judge-verdict not found".)
    await expect(page).toHaveURL(/\/debates\/[0-9a-f-]{36}$/, { timeout: 60_000 });

    // Whichever terminal state renders first decides: a failed run says so
    // instead of timing out. The backend's own run deadline is 300 s.
    const verdict = page.getByTestId("judge-verdict");
    const failed = page.getByTestId("debate-failed");
    await expect(verdict.or(failed)).toBeVisible({ timeout: 330_000 });
    await expect(failed, "the live debate failed before reaching a verdict").toHaveCount(0);
    await expect(verdict).toHaveAttribute("data-variant", "true");
    const confidence = await page.getByTestId("confidence-bar").getAttribute("aria-valuenow");
    expect(Number(confidence)).toBeGreaterThanOrEqual(0.5);

    // The transcript the verdict links to is the backend's rendered markdown.
    await page.getByRole("link", { name: /transcript/i }).click();
    await expect(page).toHaveURL(/\/transcript$/);
    await expect(page.getByRole("heading", { level: 2, name: "Verdict" })).toBeVisible({
      timeout: 30_000,
    });
  });
});
