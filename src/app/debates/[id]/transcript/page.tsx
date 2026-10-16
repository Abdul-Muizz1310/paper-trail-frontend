import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isUuid } from "@/lib/schemas";
import { TranscriptClient } from "./TranscriptClient";

type Params = Promise<{ id: string }>;

// A generated debate's transcript: previewable when shared, never in search results.
// Titled from the id alone; the debate itself is never fetched for metadata.
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  return { title: `transcript ${id.slice(0, 8)}`, robots: { index: false } };
}

export default async function TranscriptPage({ params }: { params: Params }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  return <TranscriptClient debateId={id} />;
}
