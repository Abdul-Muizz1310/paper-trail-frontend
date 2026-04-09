import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EvidenceCard } from "@/components/EvidenceCard";
import type { Round } from "@/lib/schemas";

describe("EvidenceCard", () => {
  it("P1 renders body_md as markdown (headings become h*)", () => {
    const round: Round = {
      index: 0,
      side: "pro",
      claim: "c",
      body_md: "# Hello\n\nbody",
      evidence: [],
    };
    render(<EvidenceCard round={round} />);
    expect(screen.getByRole("heading", { level: 1, name: /hello/i })).toBeInTheDocument();
  });

  it("P2 renders evidence as external links", () => {
    const round: Round = {
      index: 0,
      side: "pro",
      claim: "c",
      body_md: "body",
      evidence: [{ title: "WHO report", url: "https://who.int/x" }],
    };
    render(<EvidenceCard round={round} />);
    const link = screen.getByRole("link", { name: /WHO report/i });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringMatching(/noopener/));
  });

  it("F1 empty evidence omits the Sources section entirely", () => {
    const round: Round = {
      index: 0,
      side: "pro",
      claim: "c",
      body_md: "body",
      evidence: [],
    };
    render(<EvidenceCard round={round} />);
    expect(screen.queryByText(/sources/i)).not.toBeInTheDocument();
  });
});
