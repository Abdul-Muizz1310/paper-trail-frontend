import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export type TranscriptViewProps = {
  markdown: string;
};

export function TranscriptView({ markdown }: TranscriptViewProps) {
  if (markdown.trim().length === 0) {
    return (
      <div
        data-testid="transcript-empty"
        className="rounded-lg border border-dashed border-border bg-background/40 p-10 text-center font-mono text-sm text-fg-muted"
      >
        <span className="text-accent-cyan">{"//"}</span> this debate has no transcript yet.
      </div>
    );
  }

  return (
    <article className="prose-terminal">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </article>
  );
}
