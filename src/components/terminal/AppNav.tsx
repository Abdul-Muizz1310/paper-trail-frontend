import { Terminal } from "lucide-react";
import Link from "next/link";

export type AppNavProps = {
  active?: "home" | "debate" | "transcript";
};

export function AppNav({ active }: AppNavProps) {
  return (
    <nav className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-6 px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2 font-mono">
          <span className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface text-accent-cyan">
            <Terminal className="h-3.5 w-3.5" strokeWidth={2.25} />
          </span>
          <span className="text-sm font-semibold tracking-tight text-foreground">
            paper-trail
            <span className="ml-1 text-accent-cyan">.dev</span>
          </span>
        </Link>
        <div className="flex items-center gap-5 font-mono text-xs text-fg-muted">
          <Link
            href="/"
            className={
              active === "home"
                ? "relative text-foreground after:absolute after:-bottom-[19px] after:left-0 after:h-[2px] after:w-full after:bg-accent-cyan after:shadow-[0_0_8px_rgb(34_211_238_/_0.6)]"
                : "transition-colors hover:text-foreground"
            }
          >
            home
          </Link>
          <a
            href="https://github.com/Abdul-Muizz1310/paper-trail-frontend"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-foreground"
          >
            github
          </a>
          <a
            href="https://paper-trail-backend-7h27.onrender.com/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-foreground"
          >
            api
          </a>
        </div>
      </div>
    </nav>
  );
}
