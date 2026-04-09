import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ConfidenceBar } from "@/components/ConfidenceBar";
import { TerminalWindow } from "@/components/terminal/TerminalWindow";
import type { Verdict } from "@/lib/schemas";

export type JudgeVerdictProps = {
  verdict: Verdict;
  confidence: number;
  reasoning?: string;
};

const VARIANT: Record<Verdict, { attr: string; label: string; accentClass: string; ring: string }> =
  {
    TRUE: {
      attr: "true",
      label: "TRUE",
      accentClass: "text-success",
      ring: "border-success/40 bg-success/5",
    },
    FALSE: {
      attr: "false",
      label: "FALSE",
      accentClass: "text-error",
      ring: "border-error/40 bg-error/5",
    },
    INCONCLUSIVE: {
      attr: "inconclusive",
      label: "INCONCLUSIVE",
      accentClass: "text-warning",
      ring: "border-warning/40 bg-warning/5",
    },
  };

export function JudgeVerdict({ verdict, confidence, reasoning }: JudgeVerdictProps) {
  const v = VARIANT[verdict];
  return (
    <div data-testid="judge-verdict" data-variant={v.attr}>
      <TerminalWindow title="judge.verdict.json" statusDot="cyan" statusLabel="final" strong>
        <div className="flex flex-col gap-5 font-mono">
          {/* JSON-style header block */}
          <div className={`rounded-lg border ${v.ring} px-4 py-3.5`}>
            <div className="flex items-baseline justify-between gap-4">
              <div className="flex items-baseline gap-2 text-xs text-fg-faint">
                <span className="text-accent-cyan">&ldquo;verdict&rdquo;</span>
                <span>:</span>
              </div>
              <div className={`text-lg font-bold tracking-[0.1em] ${v.accentClass}`}>{v.label}</div>
            </div>
          </div>

          {/* Confidence line */}
          <div className="px-1">
            <ConfidenceBar value={confidence} />
          </div>

          {/* Reasoning block */}
          {reasoning && (
            <div className="rounded-lg border border-border bg-background/40 px-4 py-3">
              <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-fg-faint">
                <span className="text-accent-cyan">{"//"}</span>
                <span>reasoning</span>
              </div>
              <div className="prose-terminal">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{reasoning}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </TerminalWindow>
    </div>
  );
}
