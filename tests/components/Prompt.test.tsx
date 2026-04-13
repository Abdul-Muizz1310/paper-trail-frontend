import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Prompt } from "@/components/terminal/Prompt";

describe("Prompt", () => {
  it("P1 kind=input renders $ marker", () => {
    render(<Prompt kind="input">hello</Prompt>);
    expect(screen.getByText("$")).toBeInTheDocument();
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("P2 kind=output renders > marker with accent styling", () => {
    render(<Prompt kind="output">result</Prompt>);
    expect(screen.getByText(">")).toBeInTheDocument();
    expect(screen.getByText(">")).toHaveClass("text-accent-cyan");
    expect(screen.getByText("result")).toHaveClass("text-foreground", "font-semibold");
  });

  it("P3 kind=comment renders // marker with italic styling", () => {
    render(<Prompt kind="comment">note</Prompt>);
    expect(screen.getByText("//")).toBeInTheDocument();
    expect(screen.getByText("//")).toHaveClass("italic");
    expect(screen.getByText("note")).toHaveClass("italic");
  });

  it("P4 defaults to input kind when no kind is specified", () => {
    render(<Prompt>default</Prompt>);
    expect(screen.getByText("$")).toBeInTheDocument();
  });

  it("P5 cursor prop renders a cursor-blink span", () => {
    const { container } = render(
      <Prompt kind="input" cursor>
        cmd
      </Prompt>,
    );
    expect(container.querySelector(".cursor-blink")).not.toBeNull();
  });

  it("P6 cursor=false (default) does not render cursor span", () => {
    const { container } = render(<Prompt kind="input">cmd</Prompt>);
    expect(container.querySelector(".cursor-blink")).toBeNull();
  });

  it("P7 className is applied to the root element", () => {
    const { container } = render(<Prompt className="extra-class">x</Prompt>);
    expect(container.firstChild).toHaveClass("extra-class");
  });
});
