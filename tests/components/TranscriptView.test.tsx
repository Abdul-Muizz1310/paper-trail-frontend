import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TranscriptView } from "@/components/TranscriptView";

describe("TranscriptView", () => {
  it("P1 renders markdown headings as semantic h1/h2", () => {
    render(<TranscriptView markdown={"# Title\n\n## Sub\n\nbody"} />);
    expect(screen.getByRole("heading", { level: 1, name: /title/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: /sub/i })).toBeInTheDocument();
  });

  it("P2 renders GFM tables", () => {
    const md = "| a | b |\n|---|---|\n| 1 | 2 |\n";
    render(<TranscriptView markdown={md} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("F1 empty string shows empty-state message (no crash)", () => {
    render(<TranscriptView markdown="" />);
    expect(screen.getByTestId("transcript-empty")).toBeInTheDocument();
  });

  it("F2 does not execute script tags", () => {
    render(<TranscriptView markdown={"<script>window.__pwned = 1</script>hi"} />);
    expect(document.querySelector("script")).toBeNull();
    // @ts-expect-error probing sentinel
    expect(globalThis.__pwned).toBeUndefined();
  });
});
