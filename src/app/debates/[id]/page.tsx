import { notFound } from "next/navigation";
import { isUuid } from "@/lib/schemas";
import { DebateView } from "./DebateView";

type Params = Promise<{ id: string }>;

export default async function DebatePage({ params }: { params: Params }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <DebateView debateId={id} />
    </main>
  );
}
