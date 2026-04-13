import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppNav } from "@/components/terminal/AppNav";

describe("AppNav", () => {
  it("P1 renders home link with active styling when active=home", () => {
    render(<AppNav active="home" />);
    const homeLink = screen.getByRole("link", { name: /home/i });
    expect(homeLink).toHaveClass("text-foreground");
  });

  it("P2 renders home link without active styling when active is not home", () => {
    render(<AppNav active="debate" />);
    const homeLink = screen.getByRole("link", { name: /home/i });
    expect(homeLink).not.toHaveClass("text-foreground");
    expect(homeLink).toHaveClass("transition-colors");
  });

  it("P3 renders home link without active styling when active is undefined", () => {
    render(<AppNav />);
    const homeLink = screen.getByRole("link", { name: /home/i });
    expect(homeLink).toHaveClass("transition-colors");
  });

  it("P4 renders github and api external links", () => {
    render(<AppNav />);
    expect(screen.getByRole("link", { name: /github/i })).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: /api/i })).toHaveAttribute("target", "_blank");
  });
});
