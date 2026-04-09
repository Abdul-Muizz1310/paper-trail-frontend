import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Round } from "@/lib/schemas";
import { cn } from "@/lib/utils";

export type EvidenceCardProps = {
  round: Round;
  compact?: boolean;
};

const SIDE_LABEL: Record<Round["side"], string> = {
  pro: "pro.claim",
  con: "con.claim",
  judge: "judge.note",
};

export function EvidenceCard({ round, compact }: EvidenceCardProps) {
  const hasEvidence = round.evidence.length > 0;

  return (
    <article
      data-testid="evidence-card"
      data-side={round.side}
      className={cn(
        "group relative rounded-lg border border-border bg-background/40 p-4 transition-colors hover:border-border-bright hover:bg-surface-hover",
        compact && "text-sm",
      )}
    >
      <div className="mb-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.12em] text-fg-faint">
        <span>{SIDE_LABEL[round.side]}</span>
        <span className="tabular-nums">{String(round.index + 1).padStart(2, "0")}</span>
      </div>
      <div className="prose-terminal">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{round.body_md}</ReactMarkdown>
      </div>
      {hasEvidence && (
        <div className="mt-4 border-t border-dashed border-border pt-3">
          <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-faint">
            <span className="text-accent-cyan">{"//"}</span>
            <span>sources ({round.evidence.length})</span>
          </div>
          <ul className="flex flex-col gap-1.5 font-mono text-xs">
            {round.evidence.map((ev) => (
              <li key={ev.url}>
                <a
                  href={ev.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-accent-cyan transition-colors hover:text-foreground"
                >
                  <span className="text-fg-faint">→</span>
                  {ev.title}
                </a>
                {ev.quote && (
                  <blockquote className="mt-1 border-l-2 border-border pl-2 text-[11px] text-fg-muted">
                    “{ev.quote}”
                  </blockquote>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
