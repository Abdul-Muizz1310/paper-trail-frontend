import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ConfidenceBar } from "@/components/ConfidenceBar";
import type { Verdict } from "@/lib/schemas";

export type JudgeVerdictProps = {
  verdict: Verdict;
  confidence: number;
  reasoning?: string;
};

const VARIANT: Record<Verdict, { attr: string; label: string; cls: string }> = {
  TRUE: {
    attr: "true",
    label: "TRUE",
    cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  },
  FALSE: { attr: "false", label: "FALSE", cls: "bg-rose-500/15 text-rose-500 border-rose-500/30" },
  INCONCLUSIVE: {
    attr: "inconclusive",
    label: "INCONCLUSIVE",
    cls: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  },
};

export function JudgeVerdict({ verdict, confidence, reasoning }: JudgeVerdictProps) {
  const v = VARIANT[verdict];
  return (
    <section
      data-testid="judge-verdict"
      data-variant={v.attr}
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Judge verdict
        </h2>
        <span
          className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${v.cls}`}
        >
          {v.label}
        </span>
      </div>
      <ConfidenceBar value={confidence} />
      {reasoning && (
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{reasoning}</ReactMarkdown>
        </div>
      )}
    </section>
  );
}
