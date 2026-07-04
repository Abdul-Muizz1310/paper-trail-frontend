import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TypewriterMarkdown } from "@/components/TypewriterMarkdown";

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("TypewriterMarkdown", () => {
  it("P1 speed=0 reveals full text instantly and fires onDone", () => {
    const onDone = vi.fn();
    render(<TypewriterMarkdown markdown="Hello world" speed={0} onDone={onDone} />);
    expect(screen.getByText("Hello world")).toBeInTheDocument();
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("P2 speed>0 shows the reveal cursor before completion", () => {
    render(<TypewriterMarkdown markdown="abcdefghij" speed={10} />);
    // The full text is parsed once and present in the DOM (visually clipped),
    // and the reveal cursor is shown while the wipe is in progress.
    expect(screen.getByText("abcdefghij")).toBeInTheDocument();
    expect(document.querySelector("[aria-hidden]")).toBeInTheDocument();
  });

  it("P3 speed>0 calls onDone when fully revealed", async () => {
    const onDone = vi.fn();
    render(<TypewriterMarkdown markdown="abc" speed={100} onDone={onDone} />);
    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("P4 cursor is hidden after the reveal completes", async () => {
    render(<TypewriterMarkdown markdown="ab" speed={100} />);
    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    expect(document.querySelector("[aria-hidden]")).toBeNull();
  });

  it("P5 parses markdown (bold, links) exactly once — full output present immediately", () => {
    // If we were re-parsing an ever-growing slice, the bold node would only
    // appear partway through the animation. Parse-once means it is present
    // from the first render regardless of reveal progress.
    render(<TypewriterMarkdown markdown="**bold** text" speed={100} />);
    const bold = screen.getByText("bold");
    expect(bold.tagName).toBe("STRONG");
  });

  it("P6 className is applied to root div", () => {
    const { container } = render(
      <TypewriterMarkdown markdown="x" speed={0} className="custom-class" />,
    );
    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("P7 does NOT use a per-frame setInterval (no per-tick re-parse)", () => {
    const intervalSpy = vi.spyOn(window, "setInterval");
    render(<TypewriterMarkdown markdown="a longer body of text here" speed={420} />);
    expect(intervalSpy).not.toHaveBeenCalled();
    intervalSpy.mockRestore();
  });

  it("F1 reveal timer is cleared on unmount", () => {
    const clearSpy = vi.spyOn(window, "clearTimeout");
    const { unmount } = render(<TypewriterMarkdown markdown="long text here" speed={10} />);
    unmount();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it("F2 replacement text re-renders the new content", async () => {
    const { rerender } = render(<TypewriterMarkdown markdown="abcdefghij" speed={0} />);
    rerender(<TypewriterMarkdown markdown="xyz" speed={0} />);
    await act(() => Promise.resolve());
    expect(screen.getByText("xyz")).toBeInTheDocument();
  });

  it("F3 replacement text with speed>0 renders the new content and re-arms the cursor", async () => {
    const { rerender } = render(<TypewriterMarkdown markdown="abcdefghij" speed={0} />);
    rerender(<TypewriterMarkdown markdown="new body" speed={100} />);
    await act(() => Promise.resolve());
    expect(screen.getByText("new body")).toBeInTheDocument();
    expect(document.querySelector("[aria-hidden]")).toBeInTheDocument();
  });

  it("F4 empty markdown reveals instantly and fires onDone", () => {
    const onDone = vi.fn();
    render(<TypewriterMarkdown markdown="" speed={420} onDone={onDone} />);
    // No cursor, onDone fired: empty content is treated as instant.
    expect(document.querySelector("[aria-hidden]")).toBeNull();
    expect(onDone).toHaveBeenCalledOnce();
  });
});
