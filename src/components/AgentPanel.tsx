import { EvidenceCard } from "@/components/EvidenceCard";
import type { Round, Side } from "@/lib/schemas";

export type AgentPanelProps = {
  side: Extract<Side, "pro" | "con">;
  rounds: Round[];
  isActive: boolean;
};

export function AgentPanel({ side, rounds, isActive }: AgentPanelProps) {
  const filtered = rounds.filter((r) => r.side === side).sort((a, b) => a.index - b.index);

  return (
    <section
      data-testid={`arena-column-${side}`}
      data-active={isActive}
      className="flex min-h-[200px] flex-col gap-3 rounded-xl border border-border bg-background/40 p-4"
    >
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider">
          {side === "pro" ? "Pro" : "Con"}
        </h2>
        {isActive && <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-primary" />}
      </header>
      <div className="flex flex-col gap-3">
        {filtered.map((r) => (
          <EvidenceCard key={`${r.side}-${r.index}`} round={r} />
        ))}
      </div>
    </section>
  );
}
