import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConfidenceBar } from "@/components/ConfidenceBar";

describe("ConfidenceBar", () => {
  it("P1 value=0.75 renders a 75% fill", () => {
    render(<ConfidenceBar value={0.75} />);
    const fill = screen.getByTestId("confidence-fill");
    expect(fill).toHaveStyle({ width: "75%" });
  });

  it("P2 boundary values render without overflow", () => {
    const { rerender } = render(<ConfidenceBar value={0} />);
    expect(screen.getByTestId("confidence-fill")).toHaveStyle({ width: "0%" });
    rerender(<ConfidenceBar value={1} />);
    expect(screen.getByTestId("confidence-fill")).toHaveStyle({ width: "100%" });
  });

  it("F1 clamps out-of-range values", () => {
    const { rerender } = render(<ConfidenceBar value={-0.3} />);
    expect(screen.getByTestId("confidence-fill")).toHaveStyle({ width: "0%" });
    rerender(<ConfidenceBar value={1.7} />);
    expect(screen.getByTestId("confidence-fill")).toHaveStyle({ width: "100%" });
  });

  it("F2 NaN renders aria-invalid and 0%", () => {
    render(<ConfidenceBar value={Number.NaN} />);
    const bar = screen.getByTestId("confidence-bar");
    expect(bar).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByTestId("confidence-fill")).toHaveStyle({ width: "0%" });
  });
});
