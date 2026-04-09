import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Round } from "@/lib/schemas";

export type EvidenceCardProps = {
  round: Round;
  compact?: boolean;
};

export function EvidenceCard({ round, compact }: EvidenceCardProps) {
  const hasEvidence = round.evidence.length > 0;

  return (
    <article
      data-testid="evidence-card"
      data-side={round.side}
      className={`rounded-lg border border-border bg-card p-4 shadow-sm ${compact ? "text-sm" : ""}`}
    >
      <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
        <span>Round {round.index + 1}</span>
        <span>{round.side}</span>
      </div>
      <div className="prose prose-sm max-w-none dark:prose-invert">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{round.body_md}</ReactMarkdown>
      </div>
      {hasEvidence && (
        <div className="mt-3 border-t border-border pt-3">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Sources
          </div>
          <ul className="flex flex-col gap-1 text-sm">
            {round.evidence.map((ev) => (
              <li key={ev.url}>
                <a
                  href={ev.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  {ev.title}
                </a>
                {ev.quote && (
                  <blockquote className="mt-1 border-l-2 border-border pl-2 text-xs text-muted-foreground">
                    {ev.quote}
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
