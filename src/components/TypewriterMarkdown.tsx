"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export type TypewriterMarkdownProps = {
  markdown: string;
  /** characters per second; 0 = instant */
  speed?: number;
  /** when the full text has been revealed */
  onDone?: () => void;
  className?: string;
};

/**
 * Reveals a markdown string character-by-character on mount. Gives the
 * arena a "live" feel even when the backend delivered the round in one
 * chunk. When the source `markdown` changes we append the delta rather
 * than restarting, so incremental backends work too.
 */
export function TypewriterMarkdown({
  markdown,
  speed = 420,
  onDone,
  className,
}: TypewriterMarkdownProps) {
  const [revealed, setRevealed] = useState<number>(0);
  const targetRef = useRef(markdown);
  targetRef.current = markdown;
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  // We intentionally depend on `markdown.length` + `speed` only, not
  // on `markdown` itself, so small reformats don't restart the
  // animation, and not on `onDone` (we call it via ref).
  // biome-ignore lint/correctness/useExhaustiveDependencies: see note above
  useEffect(() => {
    if (speed <= 0) {
      setRevealed(markdown.length);
      doneRef.current?.();
      return;
    }
    // If the new text is shorter than what's already shown (e.g. a
    // different round) snap to its full length.
    if (markdown.length < revealed) {
      setRevealed(markdown.length);
      return;
    }
    if (revealed >= markdown.length) {
      if (revealed === markdown.length) doneRef.current?.();
      return;
    }

    const intervalMs = 1000 / speed;
    const stepChars = Math.max(1, Math.round(speed / 60));
    const id = window.setInterval(() => {
      const target = targetRef.current.length;
      setRevealed((prev) => {
        const next = Math.min(prev + stepChars, target);
        if (next >= target) {
          window.clearInterval(id);
          doneRef.current?.();
        }
        return next;
      });
    }, intervalMs * stepChars);
    return () => window.clearInterval(id);
  }, [markdown.length, speed]);

  const shown = markdown.slice(0, revealed);
  const isRevealing = revealed < markdown.length;

  return (
    <div className={className}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{shown}</ReactMarkdown>
      {isRevealing && (
        <span
          aria-hidden
          className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 bg-accent-cyan cursor-blink"
        />
      )}
    </div>
  );
}
