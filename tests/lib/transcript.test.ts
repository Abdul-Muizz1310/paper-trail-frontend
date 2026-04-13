import { describe, expect, it } from "vitest";
import { extractJudgeReasoning } from "@/lib/transcript";

describe("extractJudgeReasoning", () => {
  it("P1 returns undefined for null transcript", () => {
    expect(extractJudgeReasoning(null)).toBeUndefined();
  });

  it("P2 returns undefined for empty string", () => {
    expect(extractJudgeReasoning("")).toBeUndefined();
  });

  it("P3 extracts ## Reasoning section", () => {
    const md = [
      "## Verdict",
      "- Verdict: TRUE",
      "- Confidence: 0.9",
      "",
      "## Reasoning",
      "The evidence strongly supports the claim.",
      "",
    ].join("\n");
    expect(extractJudgeReasoning(md)).toBe("The evidence strongly supports the claim.");
  });

  it("P4 extracts ## Judgment section (alternative heading)", () => {
    const md = ["## Judgment", "The proponent had stronger citations."].join("\n");
    expect(extractJudgeReasoning(md)).toBe("The proponent had stronger citations.");
  });

  it("P5 extracts ## Decision section", () => {
    const md = ["## Decision", "Based on the debate, this is FALSE."].join("\n");
    expect(extractJudgeReasoning(md)).toBe("Based on the debate, this is FALSE.");
  });

  it("P6 extracts ## Judgement (British spelling)", () => {
    const md = ["## Judgement", "The skeptic prevailed."].join("\n");
    expect(extractJudgeReasoning(md)).toBe("The skeptic prevailed.");
  });

  it("P7 falls back to Verdict section when no Reasoning exists", () => {
    // matchSection's lazy regex (multiline $) captures only the first
    // line after the heading. If that line is prose, it's returned.
    const md = ["## Verdict", "The evidence strongly favors TRUE."].join("\n");
    expect(extractJudgeReasoning(md)).toBe("The evidence strongly favors TRUE.");
  });

  it("P8 Verdict fallback strips Verdict bullets → returns undefined", () => {
    // First captured line is a metadata bullet → stripped → empty → undefined
    const md = ["## Verdict", "- Verdict: **TRUE**", "- Confidence: 0.85"].join("\n");
    expect(extractJudgeReasoning(md)).toBeUndefined();
  });

  it("P9 Verdict Confidence-only bullet is also stripped", () => {
    const md = ["## Verdict", "- Confidence: 0.9"].join("\n");
    expect(extractJudgeReasoning(md)).toBeUndefined();
  });

  it("P10 Reasoning section stops at next ## heading", () => {
    const md = ["## Reasoning", "Reasoning body.", "", "## Other Section", "Something else."].join(
      "\n",
    );
    expect(extractJudgeReasoning(md)).toBe("Reasoning body.");
  });

  it("F1 returns undefined when transcript has no matching sections", () => {
    const md = ["## Round 1", "Some debate content.", "## Round 2", "More debate content."].join(
      "\n",
    );
    expect(extractJudgeReasoning(md)).toBeUndefined();
  });

  it("F2 empty Reasoning section returns undefined", () => {
    const md = ["## Reasoning", "", "## Verdict", "- Verdict: TRUE"].join("\n");
    expect(extractJudgeReasoning(md)).toBeUndefined();
  });

  it("F3 Reasoning captures first paragraph", () => {
    // The lazy regex + multiline $ captures the shortest match.
    // Single-paragraph content is fully captured.
    const md = "## Reasoning\nThe judge found the claim to be false.";
    const result = extractJudgeReasoning(md);
    expect(result).toBe("The judge found the claim to be false.");
  });
});
