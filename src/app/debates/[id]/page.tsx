import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isUuid } from "@/lib/schemas";
import { DebateView } from "./DebateView";

type Params = Promise<{ id: string }>;

// A debate generated from a user's claim: previewable when shared, never in search
// results. Titled from the id alone; the debate itself is never fetched for metadata.
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  return { title: `debate ${id.slice(0, 8)}`, robots: { index: false } };
}

export default async function DebatePage({ params }: { params: Params }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  // DebateView ships its own <PageFrame>; don't double-wrap.
  return <DebateView debateId={id} />;
}
