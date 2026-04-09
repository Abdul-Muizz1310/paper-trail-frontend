import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const DEBATE_ID = "11111111-1111-1111-1111-111111111111";
const TRANSCRIPT_MD = readFileSync(
  path.join(__dirname, "fixtures", "transcript.md"),
  "utf-8",
);

/**
 * Build an SSE response body from a list of (event, data) tuples.
 */
function sseBody(events: Array<[string, unknown]>): string {
  return events
    .map(([ev, data]) => `event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`)
    .join("");
}

function debateBody(rounds: number, done = false) {
  return {
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
    transcript_md: done ? TRANSCRIPT_MD : null,
    created_at: "2026-04-09T12:00:00Z",
  };
}

test.describe("debate flow (mocked backend)", () => {
  test("P1 happy path: submit claim → stream → verdict → transcript", async ({ page }) => {
    let getCallCount = 0;

    await page.route("**/debates", async (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          debate_id: DEBATE_ID,
          stream_url: `/debates/${DEBATE_ID}/stream`,
        }),
      });
    });

    await page.route(`**/debates/${DEBATE_ID}`, async (route) => {
      getCallCount += 1;
      const rounds = Math.min(getCallCount, 3);
      const done = getCallCount >= 3;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(debateBody(rounds, done)),
      });
    });

    await page.route(`**/debates/${DEBATE_ID}/stream`, async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: sseBody([
          ["state", { type: "state", status: "running", verdict: null, confidence: null, rounds_count: 1 }],
          ["state", { type: "state", status: "running", verdict: null, confidence: null, rounds_count: 2 }],
          ["done", { type: "done", status: "done", verdict: "TRUE", confidence: 0.78, rounds_count: 3 }],
        ]),
      });
    });

    await page.route(`**/debates/${DEBATE_ID}/transcript.md`, async (route) => {
      return route.fulfill({
        status: 200,
        contentType: "text/markdown",
        body: TRANSCRIPT_MD,
      });
    });

    await page.goto("/");
    await page.getByRole("textbox", { name: /claim/i }).fill("Remote work reduces productivity.");
    await page.getByRole("button", { name: /submit|debate|start/i }).click();

    await expect(page).toHaveURL(new RegExp(`/debates/${DEBATE_ID}$`));
    await expect(page.getByTestId("judge-verdict")).toHaveAttribute("data-variant", "true", { timeout: 10_000 });

    await page.getByRole("link", { name: /transcript/i }).click();
    await expect(page).toHaveURL(new RegExp(`/debates/${DEBATE_ID}/transcript$`));
    await expect(page.getByRole("heading", { name: /final reasoning/i })).toBeVisible();
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
    await page.route(`**/debates/${DEBATE_ID}`, (route) =>
      route.fulfill({ status: 404, contentType: "application/json", body: '{"detail":"debate not found"}' }),
    );
    await page.route(`**/debates/${DEBATE_ID}/stream`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: sseBody([["error", { reason: "not_found" }]]),
      }),
    );
    await page.goto(`/debates/${DEBATE_ID}`);
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("link", { name: /home/i })).toHaveAttribute("href", "/");
  });

  test("F3 transcript 404 → Next.js 404 page", async ({ page }) => {
    await page.route(`**/debates/${DEBATE_ID}/transcript.md`, (route) =>
      route.fulfill({ status: 404, body: '{"detail":"transcript not available"}' }),
    );
    const resp = await page.goto(`/debates/${DEBATE_ID}/transcript`);
    expect(resp?.status()).toBe(404);
  });

  test("F4 POST /debates fails → toast + claim preserved", async ({ page }) => {
    await page.route("**/debates", (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      return route.fulfill({ status: 500, body: '{"detail":"boom"}' });
    });
    await page.goto("/");
    await page.getByRole("textbox", { name: /claim/i }).fill("my precious claim");
    await page.getByRole("button", { name: /submit|debate|start/i }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("textbox", { name: /claim/i })).toHaveValue("my precious claim");
  });
});
