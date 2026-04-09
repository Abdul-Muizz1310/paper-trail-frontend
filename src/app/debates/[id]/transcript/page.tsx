import Link from "next/link";
import { notFound } from "next/navigation";
import { TranscriptView } from "@/components/TranscriptView";
import { env } from "@/lib/env";
import { isUuid } from "@/lib/schemas";

type Params = Promise<{ id: string }>;

export default async function TranscriptPage({ params }: { params: Params }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const res = await fetch(`${env.NEXT_PUBLIC_API_URL}/debates/${id}/transcript.md`, {
    cache: "no-store",
  });
  if (res.status === 404) notFound();
  if (!res.ok) {
    throw new Error(`transcript fetch failed: ${res.status}`);
  }
  const markdown = await res.text();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <Link
          href={`/debates/${id}`}
          className="hover:text-foreground hover:underline underline-offset-4"
        >
          ← Back to debate
        </Link>
        <span>Transcript</span>
      </div>
      <TranscriptView markdown={markdown} />
    </main>
  );
}
