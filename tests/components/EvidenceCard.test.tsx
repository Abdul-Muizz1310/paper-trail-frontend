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

  it("P3 renders evidence quote as blockquote when present", () => {
    const round: Round = {
      index: 0,
      side: "con",
      claim: "c",
      body_md: "body",
      evidence: [{ title: "Source A", url: "https://a.com", quote: "Important finding" }],
    };
    render(<EvidenceCard round={round} />);
    expect(screen.getByText(/Important finding/)).toBeInTheDocument();
  });

  it("P4 compact prop applies text-sm class", () => {
    const round: Round = {
      index: 0,
      side: "pro",
      claim: "c",
      body_md: "body",
      evidence: [],
    };
    render(<EvidenceCard round={round} compact />);
    expect(screen.getByTestId("evidence-card")).toHaveClass("text-sm");
  });

  it("P5 caps evidence at 5 items and shows hidden count", () => {
    const evidence = Array.from({ length: 8 }, (_, i) => ({
      title: `Source ${i}`,
      url: `https://example.com/${i}`,
    }));
    const round: Round = {
      index: 0,
      side: "pro",
      claim: "c",
      body_md: "body",
      evidence,
    };
    render(<EvidenceCard round={round} />);
    // Should show 5 links + "3 more sources" message
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(5);
    expect(screen.getByText(/3 more sources/)).toBeInTheDocument();
  });

  it("P6 hidden count uses singular when exactly 1 extra", () => {
    const evidence = Array.from({ length: 6 }, (_, i) => ({
      title: `Source ${i}`,
      url: `https://example.com/${i}`,
    }));
    const round: Round = {
      index: 0,
      side: "pro",
      claim: "c",
      body_md: "body",
      evidence,
    };
    render(<EvidenceCard round={round} />);
    expect(screen.getByText(/1 more source in/)).toBeInTheDocument();
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
