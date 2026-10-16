import { describe, expect, it } from "vitest";
import { SITE } from "@/lib/site/config";
import { ROOT_VIEWPORT, rootMetadata } from "@/lib/site/metadata";

describe("root metadata", () => {
  const metadata = rootMetadata(SITE);

  it("P2 resolves every relative URL against the production origin", () => {
    expect(String(metadata.metadataBase)).toBe("https://paper-trail-frontend-sable.vercel.app/");
  });

  it("P2 has a default title and a template that names the site", () => {
    expect(metadata.title).toEqual({
      default: "paper-trail — live AI debate",
      template: "%s — paper-trail",
    });
  });

  it("P2 describes the site and credits its author", () => {
    expect(metadata.description).toBe(SITE.description);
    expect(metadata.applicationName).toBe("paper-trail");
    expect(metadata.authors).toEqual([
      { name: "Abdul-Muizz Anwar", url: "https://github.com/Abdul-Muizz1310" },
    ]);
    expect(metadata.keywords).toEqual(SITE.keywords);
  });

  it("P2 leaves the Open Graph title, description and url to each page", () => {
    expect(metadata.openGraph).toEqual({
      type: "website",
      siteName: "paper-trail",
      locale: "en_US",
    });
  });

  it("P2 asks for the large Twitter card and lets Next fill the rest from Open Graph", () => {
    expect(metadata.twitter).toEqual({ card: "summary_large_image" });
  });

  it("P2 sets no canonical at the root, so no page claims to be the home page", () => {
    expect(metadata).not.toHaveProperty("alternates");
  });

  it("P2 names the home-screen app and keeps the iOS status bar dark", () => {
    expect(metadata.appleWebApp).toEqual({ title: "paper-trail", statusBarStyle: "black" });
  });

  it("P2 stops iOS turning numbers into phone links", () => {
    expect(metadata.formatDetection).toEqual({ telephone: false, email: false, address: false });
  });
});

describe("viewport", () => {
  it("P3 paints the browser chrome in the page background and declares a dark scheme", () => {
    expect(ROOT_VIEWPORT).toEqual({ themeColor: "#0a0a0a", colorScheme: "dark" });
  });
});
