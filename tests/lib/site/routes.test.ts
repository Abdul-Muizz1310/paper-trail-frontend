import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { SITE } from "@/lib/site/config";
import { defineSite } from "@/lib/site/define";
import { robotsFile } from "@/lib/site/metadata";
import { pngSize } from "./image-headers";

describe("manifest", () => {
  const m = manifest();

  it("P4 names the site and opens at the home page in the dark colours", () => {
    expect(m).toMatchObject({
      name: "paper-trail",
      short_name: "paper-trail",
      description: SITE.description,
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: "#0a0a0a",
      theme_color: "#0a0a0a",
    });
  });

  it("P4 lists any-purpose 192 and 512 icons and a maskable 512", () => {
    expect(m.icons?.map((i) => `${i.sizes} ${i.purpose}`)).toEqual([
      "192x192 any",
      "512x512 any",
      "512x512 maskable",
    ]);
  });

  it.each(m.icons ?? [])("P4 $src exists in public/ at $sizes", (icon) => {
    expect(pngSize(readFileSync(join("public", icon.src)))).toBe(icon.sizes);
  });
});

describe("robots and sitemap", () => {
  it("P5 allows the whole site and names the sitemap", () => {
    expect(robots()).toEqual({
      rules: [{ userAgent: "*", allow: "/" }],
      sitemap: "https://paper-trail-frontend-sable.vercel.app/sitemap.xml",
    });
  });

  it("P5 disallows the machine endpoints a site declares", () => {
    const site = defineSite({ ...SITE, routes: { sitemap: ["/"], disallow: ["/api/", "/auth/"] } });
    expect(robotsFile(site).rules).toEqual([
      { userAgent: "*", allow: "/", disallow: ["/api/", "/auth/"] },
    ]);
  });

  it("P5 lists the sitemap routes, as absolute URLs, once each", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toEqual(["https://paper-trail-frontend-sable.vercel.app/"]);
    expect(new Set(urls).size).toBe(urls.length);
  });
});
