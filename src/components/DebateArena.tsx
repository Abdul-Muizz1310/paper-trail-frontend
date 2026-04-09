import { AgentPanel } from "@/components/AgentPanel";
import { Skeleton } from "@/components/ui/skeleton";
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
        className="rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive"
      >
        {errorMessage ?? "Something went wrong."}
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {(["pro", "con"] as const).map((s) => (
          <div
            key={s}
            data-testid="arena-skeleton"
            className="flex flex-col gap-3 rounded-xl border border-border p-4"
          >
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <AgentPanel side="pro" rounds={pro} isActive={phase === "streaming"} />
      <AgentPanel side="con" rounds={con} isActive={phase === "streaming"} />
    </div>
  );
}
