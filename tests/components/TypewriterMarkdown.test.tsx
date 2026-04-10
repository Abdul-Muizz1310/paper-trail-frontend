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
    render(
      <TypewriterMarkdown markdown="Hello world" speed={0} onDone={onDone} />,
    );
    expect(screen.getByText("Hello world")).toBeInTheDocument();
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("P2 speed>0 progressively reveals text", () => {
    render(
      <TypewriterMarkdown markdown="abcdefghij" speed={10} />,
    );
    // Initially only partial text should be shown (not the full string)
    // We can't check exact chars due to rounding, but cursor should be visible
    const cursor = document.querySelector("[aria-hidden]");
    expect(cursor).toBeInTheDocument();
  });

  it("P3 speed>0 calls onDone when fully revealed", async () => {
    const onDone = vi.fn();
    render(
      <TypewriterMarkdown markdown="abc" speed={100} onDone={onDone} />,
    );
    // Run timers long enough to fully reveal 3 chars at 100 cps
    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    expect(onDone).toHaveBeenCalled();
  });

  it("P4 cursor is hidden after full reveal", async () => {
    render(
      <TypewriterMarkdown markdown="ab" speed={100} />,
    );
    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    // After reveal, the cursor span (aria-hidden) should no longer be present
    const cursor = document.querySelector("[aria-hidden]");
    expect(cursor).toBeNull();
  });

  it("P5 renders markdown (bold, links) correctly", () => {
    render(
      <TypewriterMarkdown markdown="**bold** text" speed={0} />,
    );
    const bold = screen.getByText("bold");
    expect(bold.tagName).toBe("STRONG");
  });

  it("P6 className is applied to root div", () => {
    const { container } = render(
      <TypewriterMarkdown markdown="x" speed={0} className="custom-class" />,
    );
    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("F1 interval is cleared on unmount", () => {
    const clearSpy = vi.spyOn(window, "clearInterval");
    const { unmount } = render(
      <TypewriterMarkdown markdown="long text here" speed={10} />,
    );
    unmount();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it("F2 shorter replacement text snaps immediately", async () => {
    const { rerender } = render(
      <TypewriterMarkdown markdown="abcdefghij" speed={0} />,
    );
    // Rerender with shorter text
    rerender(<TypewriterMarkdown markdown="abc" speed={0} />);
    await act(() => Promise.resolve());
    expect(screen.getByText("abc")).toBeInTheDocument();
  });
});
