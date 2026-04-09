import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AppNav } from "./AppNav";
import { StatusBar, type StatusBarProps } from "./StatusBar";

export type PageFrameProps = {
  active?: "home" | "debate" | "transcript";
  children: ReactNode;
  statusLeft?: StatusBarProps["left"];
  statusRight?: StatusBarProps["right"];
  maxWidth?: string;
};

/**
 * Standard page chrome: sticky nav on top, fixed status bar on bottom,
 * main content area in between with consistent padding. Reserves 40px
 * at the bottom so content never hides behind the status bar.
 */
export function PageFrame({
  active,
  children,
  statusLeft,
  statusRight,
  maxWidth = "max-w-[1400px]",
}: PageFrameProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppNav active={active} />
      <main className={cn("mx-auto w-full flex-1 px-4 pt-8 pb-16 md:px-6 md:pt-10", maxWidth)}>
        {children}
      </main>
      <StatusBar left={statusLeft} right={statusRight} />
    </div>
  );
}
