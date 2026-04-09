import { EvidenceCard } from "@/components/EvidenceCard";
import { TerminalWindow } from "@/components/terminal/TerminalWindow";
import type { Round, Side } from "@/lib/schemas";

export type AgentPanelProps = {
  side: Extract<Side, "pro" | "con">;
  rounds: Round[];
  isActive: boolean;
};

const CONFIG: Record<
  AgentPanelProps["side"],
  { title: string; accent: "green" | "red"; empty: string }
> = {
  pro: {
    title: "pro.agent.md",
    accent: "green",
    empty: "// awaiting response…",
  },
  con: {
    title: "con.agent.md",
    accent: "red",
    empty: "// awaiting response…",
  },
};

export function AgentPanel({ side, rounds, isActive }: AgentPanelProps) {
  const filtered = rounds.filter((r) => r.side === side).sort((a, b) => a.index - b.index);
  const cfg = CONFIG[side];

  return (
    <TerminalWindow
      title={cfg.title}
      statusDot={isActive ? "cyan" : cfg.accent}
      statusLabel={isActive ? "live" : `${filtered.length}`}
      bodyClassName="p-4 md:p-5"
    >
      <div data-testid={`arena-column-${side}`} data-active={isActive}>
        {filtered.length === 0 ? (
          <div className="flex min-h-[160px] items-center justify-center font-mono text-xs text-fg-faint">
            {cfg.empty}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((r) => (
              <EvidenceCard key={`${r.side}-${r.index}`} round={r} />
            ))}
          </div>
        )}
      </div>
    </TerminalWindow>
  );
}
