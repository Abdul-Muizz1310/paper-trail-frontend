import { AgentPanel } from "@/components/AgentPanel";
import { TerminalWindow } from "@/components/terminal/TerminalWindow";
import type { Round } from "@/lib/schemas";

export type DebatePhase = "loading" | "streaming" | "done" | "error";

export type DebateArenaProps = {
  pro: Round[];
  con: Round[];
  phase: DebatePhase;
  errorMessage?: string;
};

export function DebateArena({ pro, con, phase, errorMessage }: DebateArenaProps) {
  if (phase === "error") {
    return (
      <div
        role="alert"
        className="rounded-lg border border-error/40 bg-error/10 p-5 font-mono text-sm text-error"
      >
        <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-error/70">[error]</div>
        {errorMessage ?? "Something went wrong."}
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {(["pro", "con"] as const).map((s) => (
          <TerminalWindow key={s} title={`${s}.agent.md`} statusDot="yellow" statusLabel="boot">
            <div
              data-testid="arena-skeleton"
              className="flex min-h-[200px] flex-col gap-3 font-mono text-xs text-fg-faint"
            >
              <div className="h-2 w-1/4 animate-pulse rounded-full bg-border" />
              <div className="h-2 w-3/4 animate-pulse rounded-full bg-border" />
              <div className="h-2 w-2/3 animate-pulse rounded-full bg-border" />
              <div className="mt-3 flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent-cyan" />
                <span>{"// initialising agent…"}</span>
              </div>
            </div>
          </TerminalWindow>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
      <AgentPanel side="pro" rounds={pro} isActive={phase === "streaming"} />
      <AgentPanel side="con" rounds={con} isActive={phase === "streaming"} />
    </div>
  );
}
