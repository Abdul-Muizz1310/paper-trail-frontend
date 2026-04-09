"use client";

import Link from "next/link";
import { useEffect } from "react";
import { DebateArena, type DebatePhase } from "@/components/DebateArena";
import { JudgeVerdict } from "@/components/JudgeVerdict";
import { AppNav } from "@/components/terminal/AppNav";
import { Prompt } from "@/components/terminal/Prompt";
import { StatusBar } from "@/components/terminal/StatusBar";
import { useDebate, useInvalidateDebate } from "@/lib/api";
import type { Round, Verdict } from "@/lib/schemas";
import { useDebateStream } from "@/lib/sse";

type Props = { debateId: string };

function splitRounds(rounds: Round[]): {
  pro: Round[];
  con: Round[];
  judge?: Round;
} {
  const pro: Round[] = [];
  const con: Round[] = [];
  let judge: Round | undefined;
  for (const r of rounds) {
    if (r.side === "pro") pro.push(r);
    else if (r.side === "con") con.push(r);
    else judge = r;
  }
  return { pro, con, judge };
}

export function DebateView({ debateId }: Props) {
  const debateQuery = useDebate(debateId);
  const invalidate = useInvalidateDebate(debateId);
  const { phase: streamPhase } = useDebateStream(debateId, {
    onStateChange: () => {
      void invalidate();
    },
  });

  useEffect(() => {
    if (streamPhase.kind === "done") {
      void invalidate();
    }
  }, [streamPhase.kind, invalidate]);

  const shortId = debateId.slice(0, 8);

  const body = (() => {
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

    const debate = debateQuery.data;
    const { pro, con, judge } = splitRounds(debate.rounds);

    const isTerminal =
      debate.status === "done" ||
      debate.status === "failed" ||
      debate.status === "error" ||
      streamPhase.kind === "done" ||
      streamPhase.kind === "error";

    const arenaPhase: DebatePhase =
      streamPhase.kind === "error" ? "error" : isTerminal ? "done" : "streaming";

    const showVerdict = isTerminal && debate.verdict !== null && debate.confidence !== null;

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

        {showVerdict && debate.verdict && debate.confidence !== null && (
          <JudgeVerdict
            verdict={debate.verdict as Verdict}
            confidence={debate.confidence}
            reasoning={judge?.body_md}
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
  })();

  const statusText =
    streamPhase.kind === "error"
      ? streamPhase.reason
      : streamPhase.kind === "done"
        ? "done"
        : streamPhase.kind === "streaming"
          ? "streaming"
          : "connecting";

  const debate = debateQuery.data;

  return (
    <>
      <AppNav active="debate" />
      <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-8 px-4 pt-10 pb-20 md:px-6 md:pt-14">
        {/* Header */}
        <header className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Prompt kind="comment">~/debates/{shortId}.run</Prompt>
            {debate && (
              <Prompt kind="input">
                <span className="text-foreground">debate &ldquo;{debate.claim}&rdquo;</span>
              </Prompt>
            )}
          </div>
          <h1 className="font-mono text-2xl font-semibold tracking-tight md:text-3xl">
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
            </div>
          )}
        </header>

        {body}
      </main>

      <StatusBar
        left={`paper-trail.dev ~/debates/${shortId}`}
        right={
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
      />
    </>
  );
}
