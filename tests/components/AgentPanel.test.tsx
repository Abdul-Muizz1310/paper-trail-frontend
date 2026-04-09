import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AgentPanel } from "@/components/AgentPanel";
import type { Round } from "@/lib/schemas";

const r = (index: number, side: "pro" | "con"): Round => ({
  index,
  side,
  claim: `c${index}`,
  body_md: `b${index}`,
  evidence: [],
});

describe("AgentPanel", () => {
  it("P1 renders rounds ordered by index", () => {
    render(
      <AgentPanel
        side="pro"
        rounds={[r(1, "pro"), r(0, "pro")]}
        isActive={false}
      />,
    );
    const cards = screen.getAllByTestId("evidence-card");
    expect(cards[0]).toHaveTextContent("b0");
    expect(cards[1]).toHaveTextContent("b1");
  });

  it("F1 filters out rounds whose side does not match", () => {
    render(
      <AgentPanel
        side="pro"
        rounds={[r(0, "pro"), r(1, "con")]}
        isActive={false}
      />,
    );
    expect(screen.getAllByTestId("evidence-card")).toHaveLength(1);
  });
});
