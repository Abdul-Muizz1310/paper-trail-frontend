import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { JudgeVerdict } from "@/components/JudgeVerdict";

describe("JudgeVerdict", () => {
  it("P1 TRUE verdict exposes stable data-variant attribute", () => {
    render(<JudgeVerdict verdict="TRUE" confidence={0.9} />);
    expect(screen.getByTestId("judge-verdict")).toHaveAttribute("data-variant", "true");
  });

  it("P2 includes a ConfidenceBar bound to confidence", () => {
    render(<JudgeVerdict verdict="FALSE" confidence={0.42} />);
    expect(screen.getByTestId("confidence-fill")).toHaveStyle({ width: "42%" });
  });

  it("P3 renders reasoning block when reasoning is provided", () => {
    render(<JudgeVerdict verdict="TRUE" confidence={0.8} reasoning="The evidence is strong." />);
    expect(screen.getByText(/reasoning/i)).toBeInTheDocument();
    expect(screen.getByText(/evidence is strong/)).toBeInTheDocument();
  });

  it("P4 omits reasoning block when reasoning is absent", () => {
    render(<JudgeVerdict verdict="FALSE" confidence={0.5} />);
    expect(screen.queryByText(/reasoning/i)).not.toBeInTheDocument();
  });

  it("F1 confidence=0 still renders the bar", () => {
    render(<JudgeVerdict verdict="INCONCLUSIVE" confidence={0} />);
    expect(screen.getByTestId("confidence-bar")).toBeInTheDocument();
  });
});
