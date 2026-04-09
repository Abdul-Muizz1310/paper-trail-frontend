import { notFound } from "next/navigation";
import { isUuid } from "@/lib/schemas";
import { DebateView } from "./DebateView";

type Params = Promise<{ id: string }>;

export default async function DebatePage({ params }: { params: Params }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  // DebateView ships its own <PageFrame>; don't double-wrap.
  return <DebateView debateId={id} />;
}
