import { HomeClaimForm } from "./_home/HomeClaimForm";

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-10 px-6 py-16">
      <header className="flex flex-col gap-3">
        <span className="inline-flex w-fit items-center rounded-full border border-border px-3 py-1 text-xs uppercase tracking-wider text-muted-foreground">
          paper-trail
        </span>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Watch AI argue with itself.
        </h1>
        <p className="max-w-xl text-sm text-muted-foreground md:text-base">
          Enter a claim. Two agents argue it out with citations. A third agent judges. You read the
          receipts.
        </p>
      </header>
      <HomeClaimForm />
    </main>
  );
}
