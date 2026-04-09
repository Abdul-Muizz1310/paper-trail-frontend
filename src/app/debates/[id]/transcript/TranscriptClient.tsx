"use client";

import Link from "next/link";
import { TranscriptView } from "@/components/TranscriptView";
import { AppNav } from "@/components/terminal/AppNav";
import { Prompt } from "@/components/terminal/Prompt";
import { StatusBar } from "@/components/terminal/StatusBar";
import { TerminalWindow } from "@/components/terminal/TerminalWindow";
import { useDebate } from "@/lib/api";

type Props = { debateId: string };

export function TranscriptClient({ debateId }: Props) {
  const query = useDebate(debateId);
  const shortId = debateId.slice(0, 8);

  return (
    <>
      <AppNav active="transcript" />
      <main className="mx-auto flex w-full max-w-[1000px] flex-1 flex-col gap-8 px-4 pt-10 pb-20 md:px-6 md:pt-14">
        {/* Header */}
        <header className="flex flex-col gap-3">
          <Prompt kind="comment">~/debates/{shortId}/transcript.md</Prompt>
          <div className="flex items-center justify-between gap-3">
            <Link
              href={`/debates/${debateId}`}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 font-mono text-xs text-fg-muted transition-colors hover:border-accent-cyan/60 hover:text-accent-cyan"
            >
              <span className="text-accent-cyan">$</span>
              <span>cd ..</span>
            </Link>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-fg-faint">
              read-only
            </span>
          </div>
        </header>

        {/* Body */}
        <TerminalWindow
          title="transcript.md"
          statusDot="green"
          statusLabel="saved"
          strong
          bodyClassName="p-6 md:p-8"
        >
          {query.isPending && (
            <div
              data-testid="transcript-loading"
              className="flex min-h-[200px] items-center justify-center font-mono text-sm text-fg-faint"
            >
              <span className="text-accent-cyan mr-2">{"//"}</span>
              loading transcript…
            </div>
          )}

          {query.isError && (
            <div
              data-testid="transcript-error"
              role="status"
              className="flex flex-col items-start gap-3 rounded-lg border border-error/40 bg-error/5 p-4 font-mono text-sm text-error"
            >
              <div className="flex items-center gap-2">
                <span>⨯</span>
                <span>Couldn&apos;t load this transcript.</span>
              </div>
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-fg-muted transition-colors hover:border-accent-cyan/60 hover:text-accent-cyan"
              >
                <span className="text-accent-cyan">$</span>
                <span>cd ~ {"//"} go home</span>
              </Link>
            </div>
          )}

          {query.data && <TranscriptView markdown={query.data.transcript_md ?? ""} />}
        </TerminalWindow>
      </main>

      <StatusBar
        left={`paper-trail.dev ~/debates/${shortId}/transcript.md`}
        right={
          <>
            <span>read-only</span>
            <span className="text-fg-faint">·</span>
            <span className="text-success">saved</span>
          </>
        }
      />
    </>
  );
}
