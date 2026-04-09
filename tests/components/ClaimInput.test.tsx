import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ClaimInput } from "@/components/ClaimInput";

describe("ClaimInput", () => {
  it("P1 renders an accessible claim textbox", () => {
    render(<ClaimInput onSubmit={vi.fn()} isPending={false} />);
    expect(screen.getByRole("textbox", { name: /claim/i })).toBeInTheDocument();
  });

  it("P2 submitting calls onSubmit with the typed claim and default max_rounds=5", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ClaimInput onSubmit={onSubmit} isPending={false} />);
    await userEvent.type(
      screen.getByRole("textbox", { name: /claim/i }),
      "Remote work reduces productivity.",
    );
    await userEvent.click(screen.getByRole("button", { name: /submit|debate|start/i }));
    expect(onSubmit).toHaveBeenCalledWith("Remote work reduces productivity.", 5);
  });

  it("F1 empty submit does not call onSubmit and shows inline error", async () => {
    const onSubmit = vi.fn();
    render(<ClaimInput onSubmit={onSubmit} isPending={false} />);
    await userEvent.click(screen.getByRole("button", { name: /submit|debate|start/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("F2 error prop renders a role=alert message", () => {
    render(<ClaimInput onSubmit={vi.fn()} isPending={false} error="Backend exploded" />);
    expect(screen.getByRole("alert")).toHaveTextContent(/exploded/i);
  });

  it("F3 isPending disables the textbox and button", () => {
    render(<ClaimInput onSubmit={vi.fn()} isPending={true} defaultClaim="hi" />);
    expect(screen.getByRole("textbox", { name: /claim/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /submit|debate|start/i })).toBeDisabled();
  });
});
