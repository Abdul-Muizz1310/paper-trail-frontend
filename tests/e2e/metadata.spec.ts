import { expect, type Page, type Route, test } from "@playwright/test";
import { SITE } from "../../src/lib/site/config";

// Valid RFC 4122 v4 UUID, as in debate-flow.spec.ts.
const DEBATE_ID = "11111111-1111-4111-8111-111111111111";
// The frontend's signing proxy (spec 05), where every browser call goes. The
// mocks are scoped to it, so the app's own /debates/ID page is never intercepted.
const PROXY = "/api/backend";

function fulfill(route: Route, opts: { status?: number; contentType?: string; body?: string }) {
  return route.fulfill({
    status: opts.status ?? 200,
    contentType: opts.contentType ?? "application/json",
    body: opts.body ?? "",
  });
}

const DONE_DEBATE = JSON.stringify({
  id: DEBATE_ID,
  claim: "Remote work reduces productivity.",
  status: "done",
  verdict: "TRUE",
  confidence: 0.78,
  rounds: [],
  transcript_md: "# Transcript",
  created_at: "2026-04-09T12:00:00Z",
});

/** Answer every proxied call in the browser, so none reaches the proxy or a backend. */
async function mockApi(page: Page) {
  await page.route(`**${PROXY}/**`, (route, request) => {
    const pathname = new URL(request.url()).pathname.slice(PROXY.length);
    if (pathname === "/health") return fulfill(route, { body: '{"status":"ok"}' });
    if (pathname === `/debates/${DEBATE_ID}`) return fulfill(route, { body: DONE_DEBATE });
    if (pathname === `/debates/${DEBATE_ID}/stream`) {
      const done = { type: "done", status: "done", verdict: "TRUE", confidence: 0.78 };
      return fulfill(route, {
        contentType: "text/event-stream",
        body: `event: done\ndata: ${JSON.stringify(done)}\n\n`,
      });
    }
    return fulfill(route, { status: 404, body: '{"detail":"not mocked"}' });
  });
}

const content = (page: Page, selector: string) =>
  page.locator(`head ${selector}`).first().getAttribute("content");

/**
 * Where the share card's URL points. `next dev`, which this suite runs, resolves file-based
 * social images against the local server on purpose (getSocialImageMetadataBaseFallback in
 * next/dist/lib/metadata/resolvers/resolve-url.js); a built app uses metadataBase, the
 * production origin.
 */
function shareImageUrl(baseURL: string | undefined): RegExp {
  const dev = /\bdev\b/.test(test.info().config.webServer?.command ?? "");
  const origin = dev ? new URL(baseURL ?? "").origin : SITE.url;
  return new RegExp(`^${origin}/opengraph-image`);
}

test.describe("site metadata (spec 04)", () => {
  test.beforeEach(async ({ page }) => {
    await mockApi(page);
  });

  test("P9 the home page carries the site's head tags", async ({ page, baseURL }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(SITE.title);
    expect(await content(page, 'meta[name="description"]')).toBe(SITE.description);
    expect(await content(page, 'meta[property="og:title"]')).toBe(SITE.title);
    expect(await content(page, 'meta[property="og:image"]')).toMatch(shareImageUrl(baseURL));
    expect(await content(page, 'meta[name="twitter:card"]')).toBe("summary_large_image");
    expect(await content(page, 'meta[name="twitter:image"]')).toMatch(shareImageUrl(baseURL));
    expect(await content(page, 'meta[name="theme-color"]')).toBe("#0a0a0a");
    await expect(page.locator('head link[rel="icon"][type="image/svg+xml"]')).toHaveCount(1);
    await expect(page.locator('head link[rel="apple-touch-icon"]')).toHaveCount(1);
    await expect(page.locator('head link[rel="manifest"]')).toHaveCount(1);
  });

  test("P9 the home page can be indexed", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('head meta[name="robots"]')).toHaveCount(0);
  });

  test("P14 the home page carries the site's structured data", async ({ page }) => {
    await page.goto("/");
    const scripts = page.locator('script[type="application/ld+json"]');
    await expect(scripts).toHaveCount(1);
    const graph = JSON.parse((await scripts.textContent()) ?? "")["@graph"];
    expect(graph.map((node: { "@type": string }) => node["@type"])).toEqual([
      "WebSite",
      "WebApplication",
      "Person",
    ]);
    expect(graph[0]).toMatchObject({ url: `${SITE.url}/`, name: SITE.name });
  });

  test("P14 a debate page carries no structured data", async ({ page }) => {
    await page.goto(`/debates/${DEBATE_ID}`);
    await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);
  });

  test("P10 a debate page has its own og:title and stays out of search", async ({
    page,
    baseURL,
  }) => {
    await page.goto(`/debates/${DEBATE_ID}`);
    await expect(page).toHaveTitle("debate 11111111 — paper-trail");
    expect(await content(page, 'meta[property="og:title"]')).toBe("debate 11111111 — paper-trail");
    // The page sets no openGraph of its own, so the root share card survives.
    expect(await content(page, 'meta[property="og:image"]')).toMatch(shareImageUrl(baseURL));
    expect(await content(page, 'meta[name="robots"]')).toBe("noindex");
  });

  test("P10 a transcript page has its own title and stays out of search", async ({ page }) => {
    await page.goto(`/debates/${DEBATE_ID}/transcript`);
    await expect(page).toHaveTitle("transcript 11111111 — paper-trail");
    expect(await content(page, 'meta[name="robots"]')).toBe("noindex");
  });

  test("P11 every metadata route answers with its content type", async ({ request }) => {
    const routes: [string, RegExp][] = [
      ["/opengraph-image", /^image\/png/],
      ["/icon.svg", /^image\/svg\+xml/],
      ["/apple-icon.png", /^image\/png/],
      ["/favicon.ico", /^image\/(x-icon|vnd\.microsoft\.icon)/],
      ["/icon-512.png", /^image\/png/],
      ["/manifest.webmanifest", /^application\/manifest\+json/],
      ["/robots.txt", /^text\/plain/],
      ["/sitemap.xml", /^application\/xml/],
    ];
    for (const [path, type] of routes) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      expect(response.headers()["content-type"], path).toMatch(type);
    }
  });
});
