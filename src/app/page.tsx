import { BackendStatus } from "@/components/BackendStatus";
import { PageFrame } from "@/components/terminal/PageFrame";
import { Prompt } from "@/components/terminal/Prompt";
import { TerminalWindow } from "@/components/terminal/TerminalWindow";
import { HomeClaimForm } from "./_home/HomeClaimForm";

export default function HomePage() {
  return (
    <PageFrame
      active="home"
      statusLeft="paper-trail.dev ~/"
      statusRight={
        <>
          <span>UTF-8</span>
          <span className="text-fg-faint">·</span>
          <span>
            backend <span className="text-success">OK</span>
          </span>
        </>
      }
    >
      <div className="flex flex-col gap-14 pt-6 md:pt-10">
        {/* Hero */}
        <section className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col gap-7">
            <div className="flex flex-col gap-1.5">
              <Prompt kind="comment">welcome to paper-trail</Prompt>
              <Prompt kind="input">whoami</Prompt>
              <Prompt kind="output">a live multi-agent debater</Prompt>
              <Prompt kind="input">describe</Prompt>
              <Prompt kind="output">enter a claim — two agents argue — a judge decides</Prompt>
              <Prompt kind="input" cursor>
                claim
              </Prompt>
            </div>

            <h1 className="font-mono text-4xl font-semibold leading-[1.05] tracking-tight text-foreground md:text-5xl lg:text-[3.25rem]">
              watch AI{" "}
              <span className="relative text-accent-cyan">
                argue
                <span className="absolute -bottom-1 left-0 h-[3px] w-full bg-accent-cyan/60 shadow-[0_0_12px_rgb(34_211_238_/_0.8)]" />
              </span>{" "}
              with itself.
            </h1>
            <p className="max-w-xl font-mono text-sm leading-relaxed text-fg-muted md:text-base">
              paper-trail is a debate compiler. A claim goes in, two LangGraph agents debate it with
              citations, a third agent judges — and the transcript is a permanent receipt.
            </p>

            <HomeClaimForm />
            <BackendStatus />
          </div>

          <div className="lg:mt-6">
            <TerminalWindow title="sample.debate.run" statusDot="cyan" statusLabel="preview" strong>
              <div className="flex flex-col gap-4 font-mono text-xs">
                <div className="flex items-center gap-2 text-fg-faint">
                  <span className="text-accent-cyan">$</span>
                  <span className="text-foreground">
                    debate &ldquo;remote work harms productivity&rdquo;
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border bg-background/40 p-3">
                    <div className="mb-2 flex items-center justify-between text-[9px] uppercase tracking-[0.15em] text-fg-faint">
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
                        pro.agent
                      </span>
                      <span>01</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-foreground">
                      Stanford 2023 shows remote workers report{" "}
                      <span className="text-accent-cyan">13% higher productivity</span>…
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-background/40 p-3">
                    <div className="mb-2 flex items-center justify-between text-[9px] uppercase tracking-[0.15em] text-fg-faint">
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-error" />
                        con.agent
                      </span>
                      <span>01</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-foreground">
                      Async collaboration bandwidth drops{" "}
                      <span className="text-accent-cyan">~20%</span> in async-only teams per
                      Microsoft telemetry…
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border border-success/40 bg-success/5 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[9px] uppercase tracking-[0.15em] text-fg-faint">
                      judge.verdict
                    </span>
                    <span className="text-xs font-bold tracking-[0.1em] text-success">
                      INCONCLUSIVE
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-fg-faint">
                    <span>confidence</span>
                    <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-background">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-accent-cyan to-accent-blue"
                        style={{ width: "62%" }}
                      />
                    </div>
                    <span className="tabular-nums text-accent-cyan">62%</span>
                  </div>
                </div>
              </div>
            </TerminalWindow>
          </div>
        </section>

        {/* Feature strip */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            {
              kw: "stream",
              title: "live SSE",
              body: "every state change lands in the arena as it happens — no loading spinners hiding a wall of text.",
            },
            {
              kw: "judge",
              title: "structured verdict",
              body: "a separate LangGraph node produces JSON-forced output: verdict, confidence, reasoning.",
            },
            {
              kw: "trail",
              title: "permanent receipts",
              body: "every debate persists with its full transcript. share the link, audit later.",
            },
          ].map((f) => (
            <div
              key={f.kw}
              className="rounded-xl border border-border bg-surface/50 p-5 transition-colors hover:border-border-bright hover:bg-surface"
            >
              <div className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-accent-cyan">
                <span>{"//"}</span>
                <span>{f.kw}</span>
              </div>
              <div className="mb-1.5 font-mono text-base font-semibold text-foreground">
                {f.title}
              </div>
              <p className="text-sm leading-relaxed text-fg-muted">{f.body}</p>
            </div>
          ))}
        </section>
      </div>
    </PageFrame>
  );
}
