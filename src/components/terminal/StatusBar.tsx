import type { ReactNode } from "react";

export type StatusBarProps = {
  left?: ReactNode;
  right?: ReactNode;
};

/**
 * Fixed terminal-style strip at the bottom of every page — mirrors the
 * reference site's status bar.
 */
export function StatusBar({ left, right }: StatusBarProps) {
  return (
    <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-8 max-w-[1400px] items-center justify-between gap-4 px-4 font-mono text-[11px] text-fg-muted">
        <div className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full bg-success" />
          <span className="truncate">{left}</span>
        </div>
        <div className="flex items-center gap-3 truncate">{right}</div>
      </div>
    </footer>
  );
}
