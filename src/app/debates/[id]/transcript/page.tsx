import { notFound } from "next/navigation";
import { isUuid } from "@/lib/schemas";
import { TranscriptClient } from "./TranscriptClient";

type Params = Promise<{ id: string }>;

export default async function TranscriptPage({ params }: { params: Params }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  return <TranscriptClient debateId={id} />;
}
