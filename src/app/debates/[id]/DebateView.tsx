"use client";

import Link from "next/link";
import { useEffect } from "react";
import { DebateArena, type DebatePhase } from "@/components/DebateArena";
import { JudgeVerdict } from "@/components/JudgeVerdict";
import { PageFrame } from "@/components/terminal/PageFrame";
import { Prompt } from "@/components/terminal/Prompt";
import { useDebate, useInvalidateDebate, usePatchDebate } from "@/lib/api";
import { parseRounds, type Round, type Verdict } from "@/lib/schemas";
import { useDebateStream } from "@/lib/sse";
import { extractJudgeReasoning } from "@/lib/transcript";

type Props = { debateId: string };

function splitRounds(rounds: Round[]): { pro: Round[]; con: Round[] } {
  const pro: Round[] = [];
  const con: Round[] = [];
  for (const r of rounds) {
    if (r.side === "pro") pro.push(r);
    else if (r.side === "con") con.push(r);
  }
  return { pro, con };
}

export function DebateView({ debateId }: Props) {
  const debateQuery = useDebate(debateId);
  const invalidate = useInvalidateDebate(debateId);
  const patch = usePatchDebate(debateId);
  const { phase: streamPhase } = useDebateStream(debateId, {
    onStateChange: (ev) => {
      // If the backend inlined rounds in the SSE payload (v0.1.1+),
      // patch the cache directly — no extra HTTP round-trip.
      const patchBody: Partial<{
        status: string;
        verdict: Verdict | null;
        confidence: number | null;
        rounds: Round[];
      }> = {
        status: ev.status,
        verdict: ev.verdict,
        confidence: ev.confidence,
      };
      if (ev.rounds !== undefined) {
        patchBody.rounds = parseRounds(ev.rounds);
      }
      patch(patchBody);
      // Still trigger a background refetch for transcript_md, which
      // the state event doesn't carry.
      void invalidate();
    },
  });

  // On terminal state, refetch once more to pull final transcript.
  useEffect(() => {
    if (streamPhase.kind === "done") void invalidate();
  }, [streamPhase.kind, invalidate]);

  // Safety-net poll while running, in case SSE is silent.
  useEffect(() => {
    if (streamPhase.kind !== "streaming" && streamPhase.kind !== "connecting") {
      return;
    }
    const id = window.setInterval(() => {
      void invalidate();
    }, 3000);
    return () => window.clearInterval(id);
  }, [streamPhase.kind, invalidate]);

  const shortId = debateId.slice(0, 8);

  const statusText =
    streamPhase.kind === "error"
      ? streamPhase.reason
      : streamPhase.kind === "done"
        ? "done"
        : streamPhase.kind === "streaming"
          ? "streaming"
          : "connecting";

  const debate = debateQuery.data;

  const renderBody = () => {
    if (debateQuery.isPending) {
      return <DebateArena pro={[]} con={[]} phase="loading" />;
    }

    if (debateQuery.isError) {
      return (
        <div className="flex flex-col items-start gap-4">
          <div
            role="alert"
            className="rounded-lg border border-error/40 bg-error/10 p-4 font-mono text-sm text-error"
          >
            <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-error/70">[error]</div>
            Couldn&apos;t load this debate.
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 font-mono text-xs text-fg-muted transition-colors hover:border-accent-cyan/40 hover:text-accent-cyan"
          >
            <span className="text-accent-cyan">$</span>
            <span>cd ..</span>
            <span className="text-fg-faint">{"//"} go home</span>
          </Link>
        </div>
      );
    }

    // Narrow — we know data is defined
    // biome-ignore lint/style/noNonNullAssertion: guarded by isPending/isError above
    const d = debate!;
    const { pro, con } = splitRounds(d.rounds);

    const isTerminal =
      d.status === "done" ||
      d.status === "failed" ||
      d.status === "error" ||
      streamPhase.kind === "done" ||
      streamPhase.kind === "error";

    const arenaPhase: DebatePhase =
      streamPhase.kind === "error" ? "error" : isTerminal ? "done" : "streaming";

    const showVerdict = isTerminal && d.verdict !== null && d.confidence !== null;

    const reasoning = extractJudgeReasoning(d.transcript_md);

    return (
      <div className="flex flex-col gap-6">
        <DebateArena
          pro={pro}
          con={con}
          phase={arenaPhase}
          errorMessage={
            streamPhase.kind === "error"
              ? streamPhase.reason === "not_found"
                ? "This debate no longer exists."
                : "Connection failed."
              : undefined
          }
        />

        {showVerdict && d.verdict && d.confidence !== null && (
          <JudgeVerdict
            verdict={d.verdict as Verdict}
            confidence={d.confidence}
            reasoning={reasoning}
          />
        )}

        {isTerminal && (
          <div>
            <Link
              href={`/debates/${debateId}/transcript`}
              className="group inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 font-mono text-xs text-fg-muted transition-colors hover:border-accent-cyan/60 hover:bg-surface-hover hover:text-accent-cyan"
            >
              <span className="text-accent-cyan">$</span>
              <span>cat transcript.md</span>
              <span className="text-fg-faint transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </Link>
          </div>
        )}
      </div>
    );
  };

  return (
    <PageFrame
      active="debate"
      statusLeft={`paper-trail.dev ~/debates/${shortId}`}
      statusRight={
        <>
          <span>SSE</span>
          <span className="text-fg-faint">·</span>
          <span
            className={
              streamPhase.kind === "error"
                ? "text-error"
                : streamPhase.kind === "done"
                  ? "text-success"
                  : "text-accent-cyan"
            }
          >
            {statusText}
          </span>
        </>
      }
    >
      <div className="flex flex-col gap-8">
        <header className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <Prompt kind="comment">~/debates/{shortId}.run</Prompt>
            {debate && (
              <Prompt kind="input">
                <span className="text-foreground">debate &ldquo;{debate.claim}&rdquo;</span>
              </Prompt>
            )}
          </div>
          <h1 className="font-mono text-xl font-semibold leading-tight tracking-tight md:text-2xl">
            {debate ? (
              <span className="text-foreground">{debate.claim}</span>
            ) : (
              <span className="text-fg-faint">loading claim…</span>
            )}
          </h1>
          {debate && (
            <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-fg-faint">
              <span>
                status: <span className="text-accent-cyan">{debate.status}</span>
              </span>
              <span className="text-fg-faint">·</span>
              <span>
                rounds: <span className="text-foreground">{debate.rounds.length}</span>
              </span>
              {streamPhase.kind === "connecting" && (
                <>
                  <span className="text-fg-faint">·</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-warning pulse-ring" />
                    reconnecting
                  </span>
                </>
              )}
              {streamPhase.kind === "streaming" && (
                <>
                  <span className="text-fg-faint">·</span>
                  <span className="inline-flex items-center gap-1.5 text-accent-cyan">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-cyan pulse-ring" />
                    live
                  </span>
                </>
              )}
            </div>
          )}
        </header>

        {renderBody()}
      </div>
    </PageFrame>
  );
}
