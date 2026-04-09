import type { Round } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { TypewriterMarkdown } from "./TypewriterMarkdown";

export type EvidenceCardProps = {
  round: Round;
  compact?: boolean;
  /** Enable the character-by-character reveal (streaming mode). */
  reveal?: boolean;
};

const SIDE_LABEL: Record<Round["side"], string> = {
  pro: "pro.claim",
  con: "con.claim",
  judge: "judge.note",
};

// Cap evidence at a sane number per round so the cards stay readable.
// (Backend sometimes dumps 25+ raw search results.)
const MAX_EVIDENCE = 5;

export function EvidenceCard({ round, compact, reveal = false }: EvidenceCardProps) {
  const evidence = round.evidence.slice(0, MAX_EVIDENCE);
  const hidden = round.evidence.length - evidence.length;
  const hasEvidence = evidence.length > 0;

  return (
    <article
      data-testid="evidence-card"
      data-side={round.side}
      className={cn(
        "group relative min-w-0 overflow-hidden rounded-lg border border-border bg-background/40 p-4 transition-colors hover:border-border-bright hover:bg-surface-hover",
        compact && "text-sm",
      )}
    >
      <div className="mb-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-fg-faint">
        <span>{SIDE_LABEL[round.side]}</span>
        <span className="tabular-nums">{String(round.index + 1).padStart(2, "0")}</span>
      </div>
      <TypewriterMarkdown
        markdown={round.body_md}
        speed={reveal ? 420 : 0}
        className="prose-terminal break-words"
      />
      {hasEvidence && (
        <div className="mt-4 border-t border-dashed border-border pt-3">
          <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-faint">
            <span className="text-accent-cyan">{"//"}</span>
            <span>sources ({round.evidence.length})</span>
          </div>
          <ul className="flex min-w-0 flex-col gap-2 font-mono text-xs">
            {evidence.map((ev) => (
              <li key={`${ev.url}-${ev.title}`} className="min-w-0">
                <a
                  href={ev.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 items-start gap-1.5 text-accent-cyan transition-colors hover:text-foreground"
                  title={ev.title}
                >
                  <span className="shrink-0 text-fg-faint">→</span>
                  <span className="min-w-0 flex-1 truncate">{ev.title}</span>
                </a>
                {ev.quote && (
                  <blockquote className="mt-1 line-clamp-2 overflow-hidden break-words border-l-2 border-border pl-2 text-[11px] italic text-fg-muted">
                    “{ev.quote}”
                  </blockquote>
                )}
              </li>
            ))}
            {hidden > 0 && (
              <li className="text-[11px] italic text-fg-faint">
                + {hidden} more source{hidden === 1 ? "" : "s"} in transcript
              </li>
            )}
          </ul>
        </div>
      )}
    </article>
  );
}
