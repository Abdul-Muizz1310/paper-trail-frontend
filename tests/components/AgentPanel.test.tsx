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
    render(<AgentPanel side="pro" rounds={[r(1, "pro"), r(0, "pro")]} isActive={false} />);
    const cards = screen.getAllByTestId("evidence-card");
    expect(cards[0]).toHaveTextContent("b0");
    expect(cards[1]).toHaveTextContent("b1");
  });

  it("F1 filters out rounds whose side does not match", () => {
    render(<AgentPanel side="pro" rounds={[r(0, "pro"), r(1, "con")]} isActive={false} />);
    expect(screen.getAllByTestId("evidence-card")).toHaveLength(1);
  });

  it("P3 empty rounds + isActive shows empty placeholder with cursor blink", () => {
    render(<AgentPanel side="pro" rounds={[]} isActive={true} />);
    expect(screen.queryAllByTestId("evidence-card")).toHaveLength(0);
    // The "// thinking…" text should be present
    expect(screen.getByText(/thinking/)).toBeInTheDocument();
    // The cursor blink span should be present (isActive = true)
    expect(document.querySelector(".cursor-blink")).not.toBeNull();
  });

  it("P4 empty rounds + isActive=false shows empty placeholder without cursor", () => {
    render(<AgentPanel side="con" rounds={[]} isActive={false} />);
    expect(screen.getByText(/thinking/)).toBeInTheDocument();
    // No cursor-blink when not active
    expect(document.querySelector(".cursor-blink")).toBeNull();
  });
});
