import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DebateArena } from "@/components/DebateArena";
import type { Round } from "@/lib/schemas";

const round = (index: number, side: "pro" | "con"): Round => ({
  index,
  side,
  claim: `claim ${index}`,
  body_md: `body ${index}`,
  evidence: [],
});

describe("DebateArena", () => {
  it("P1 renders 4 evidence cards in two columns when streaming", () => {
    render(
      <DebateArena
        pro={[round(0, "pro"), round(1, "pro")]}
        con={[round(0, "con"), round(1, "con")]}
        phase="streaming"
      />,
    );
    const cards = screen.getAllByTestId("evidence-card");
    expect(cards).toHaveLength(4);
  });

  it("P2 renders skeletons on loading phase", () => {
    render(<DebateArena pro={[]} con={[]} phase="loading" />);
    expect(screen.getAllByTestId("arena-skeleton").length).toBeGreaterThan(0);
  });

  it("F1 error phase shows role=alert and no arena columns", () => {
    render(<DebateArena pro={[]} con={[]} phase="error" errorMessage="boom" />);
    expect(screen.getByRole("alert")).toHaveTextContent(/boom/);
    expect(screen.queryByTestId("arena-column-pro")).not.toBeInTheDocument();
  });
});
