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
        className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground"
      >
        This debate has no transcript yet.
      </div>
    );
  }

  return (
    <article className="prose prose-sm max-w-none dark:prose-invert md:prose-base">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </article>
  );
}
