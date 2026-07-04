"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
 * Renders a markdown string with a live "reveal" effect.
 *
 * The markdown is parsed **exactly once** (memoised on `markdown`) and the
 * reveal is driven purely by CSS — a top-to-bottom clip wipe whose duration
 * scales with the text length. The previous implementation re-ran the full
 * remark→remark-gfm→rehype pipeline on every ~17ms animation tick against an
 * ever-growing slice of the string (~200+ re-parses for a single argument),
 * which pinned a CPU core during the headline streaming experience. Here the
 * pipeline runs once and the animation is compositor-only.
 */
export function TypewriterMarkdown({
  markdown,
  speed = 420,
  onDone,
  className,
}: TypewriterMarkdownProps) {
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const instant = speed <= 0 || markdown.length === 0;
  const durationMs = instant ? 0 : Math.round((markdown.length / speed) * 1000);

  // `progress` drives the CSS clip target (0 = hidden, 1 = fully shown).
  // `done` gates the cursor + onDone and flips when the wipe completes.
  const [progress, setProgress] = useState(instant ? 1 : 0);
  const [done, setDone] = useState(instant);

  const content = useMemo(
    () => <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>,
    [markdown],
  );

  // We depend on `markdown`/`speed` (via `instant`/`durationMs`) only, and
  // call onDone through a ref so a changing callback doesn't restart it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: onDone via ref
  useEffect(() => {
    if (instant) {
      setProgress(1);
      setDone(true);
      doneRef.current?.();
      return;
    }
    setProgress(0);
    setDone(false);
    // Kick the transition on the next frame so the browser sees the 0→1 change.
    const raf = requestAnimationFrame(() => setProgress(1));
    const timer = window.setTimeout(() => {
      setDone(true);
      doneRef.current?.();
    }, durationMs);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [markdown, instant, durationMs]);

  return (
    <div className={className}>
      <div
        style={
          done
            ? undefined
            : {
                clipPath: `inset(0 0 ${Math.round((1 - progress) * 100)}% 0)`,
                transition: `clip-path ${durationMs}ms linear`,
              }
        }
      >
        {content}
      </div>
      {!done && (
        <span
          aria-hidden
          className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-0.5 bg-accent-cyan cursor-blink"
        />
      )}
    </div>
  );
}
