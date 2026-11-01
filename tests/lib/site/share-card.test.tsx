import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { shareCardAssets } from "@/lib/site/assets";
import { SITE } from "@/lib/site/config";
import {
  fitsIn,
  GLYPH_ADVANCE,
  HEADLINE_SIZES,
  headlineSize,
  headlineWords,
  LETTER_SPACING_EM,
  rgba,
  SHARE_CARD_SIZE,
  ShareCard,
  shareCardAlt,
  wrapLines,
} from "@/lib/site/share-card";

const plain = (text: string) => ({ text, highlight: false });
const lit = (text: string) => ({ text, highlight: true });

describe("headline words", () => {
  it("P7 splits the headline into words and marks the highlight, not its punctuation", () => {
    expect(headlineWords("prove who wrote it first.", "first")).toMatchObject([
      [plain("prove")],
      [plain("who")],
      [plain("wrote")],
      [plain("it")],
      [lit("first"), plain(".")],
    ]);
  });

  it("P7 marks a highlight that spans words", () => {
    expect(headlineWords("watch AI argue with itself.", "AI argue")).toMatchObject([
      [plain("watch")],
      [lit("AI")],
      [lit("argue")],
      [plain("with")],
      [plain("itself.")],
    ]);
  });

  it("P7 marks the real highlight", () => {
    expect(headlineWords(SITE.card.headline, SITE.card.highlight)).toMatchObject([
      [plain("watch")],
      [plain("AI")],
      [lit("argue")],
      [plain("with")],
      [plain("itself.")],
    ]);
  });

  it("P7 keys every segment by its offset in the headline", () => {
    const offsets = headlineWords("catch slow queries.", "slow")
      .flat()
      .map((s) => s.at);
    expect(offsets).toEqual([0, 6, 11]);
  });

  it("P7 refuses a highlight the headline does not contain", () => {
    expect(() => headlineWords("catch slow queries.", "fast")).toThrow(/highlight/);
  });
});

describe("headline fit", () => {
  it("P7 wraps greedily at the column", () => {
    expect(fitsIn(["catch", "slow", "queries."], 10, 2)).toBe(true);
    expect(fitsIn(["catch", "slow", "queries."], 9, 2)).toBe(false);
  });

  it("P7 never fits a word wider than the column", () => {
    expect(fitsIn(["supercalifragilistic"], 10, 5)).toBe(false);
  });

  it("P7 sets a short headline at the largest size", () => {
    expect(headlineSize("catch slow queries.")).toBe(96);
  });

  it("P7 steps down exactly at the two-line boundary", () => {
    // 1056 px / (0.6 × 96 px) = 18 columns at the largest size
    const full = `${"a".repeat(18)} ${"b".repeat(18)}`;
    expect(headlineSize(full)).toBe(96);
    expect(headlineSize(`${full}b`)).toBe(88);
  });

  it("P7 falls back to the smallest size when nothing fits", () => {
    expect(headlineSize("x".repeat(60))).toBe(HEADLINE_SIZES.at(-1));
  });

  it("P7 fits the real headline on two lines at the largest size", () => {
    // "watch AI argue" (14) / "with itself." (12), in 18 columns
    expect(headlineSize(SITE.card.headline)).toBe(96);
  });
});

describe("headline glyph advance", () => {
  const CONTENT_WIDTH = 1200 - 2 * 72;

  it("is Geist Mono's 0.6 em minus the card's letter spacing", () => {
    expect(LETTER_SPACING_EM).toBe(-0.02);
    expect(GLYPH_ADVANCE).toBeCloseTo(0.58, 10);
  });

  it("renders the headline with the letter spacing the model counts", () => {
    const html = renderToStaticMarkup(<ShareCard site={SITE} icon="data:image/png;base64,AAAA" />);
    expect(html).toContain(`letter-spacing:${LETTER_SPACING_EM}em`);
  });

  it("agrees with a column count computed from 0.58 em at every size", () => {
    for (const px of HEADLINE_SIZES) {
      const columns = Math.floor(CONTENT_WIDTH / (0.58 * px));
      const edge = `${"a".repeat(columns)} ${"b".repeat(columns)}`;
      expect(headlineSize(edge)).toBeGreaterThanOrEqual(px);
      // the smallest size is the fallback, so nothing is smaller than it
      if (px !== HEADLINE_SIZES.at(-1)) expect(headlineSize(`${edge}b`)).toBeLessThan(px);
    }
  });

  it("never leaves a one-letter word at the end of line one", () => {
    const size = headlineSize(SITE.card.headline);
    const columns = Math.floor(CONTENT_WIDTH / (0.58 * size));
    const lines = wrapLines(SITE.card.headline.split(" "), columns);
    expect(lines.length).toBeLessThanOrEqual(2);
    for (const line of lines.slice(0, -1)) expect(line.at(-1)?.length).toBeGreaterThan(1);
  });
});

describe("accent colours", () => {
  it("P7 turns #rrggbb into rgba with the given alpha", () => {
    expect(rgba("#22d3ee", 0.25)).toBe("rgba(34, 211, 238, 0.25)");
    expect(rgba("#0A0a0A", 1)).toBe("rgba(10, 10, 10, 1)");
  });
});

describe("share card", () => {
  it("P7 is the 1200×630 Open Graph size", () => {
    expect(SHARE_CARD_SIZE).toEqual({ width: 1200, height: 630 });
  });

  it("P7 describes itself in its alt text", () => {
    expect(shareCardAlt(SITE)).toBe("paper-trail — watch AI argue with itself.");
  });

  it("P7 renders the name, the comment, the highlight in the accent and the live host", () => {
    const html = renderToStaticMarkup(<ShareCard site={SITE} icon="data:image/svg+xml;base64," />);
    expect(html).toContain(">paper-trail<");
    expect(html).toContain("// a live multi-agent debater");
    expect(html).toMatch(/color:#22d3ee[^>]*>argue</);
    expect(html).toContain("paper-trail-frontend-sable.vercel.app");
  });

  it("P7 loads both Geist Mono weights and the icon for the renderer", async () => {
    const { fonts, icon } = await shareCardAssets();
    expect(fonts.map((f) => `${f.name} ${f.weight}`)).toEqual(["Geist Mono 400", "Geist Mono 700"]);
    for (const font of fonts) expect(font.data.byteLength).toBeGreaterThan(10_000);
    expect(icon).toMatch(/^data:image\/svg\+xml;base64,/);
  });
});
