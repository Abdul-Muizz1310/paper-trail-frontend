"use client";

import { useEffect, useState } from "react";
import { env } from "@/lib/env";

type Status =
  | { kind: "checking" }
  | { kind: "cold" } // slow first response → likely Render cold start
  | { kind: "warm"; latencyMs: number }
  | { kind: "down" };

const COLD_THRESHOLD_MS = 3_000;

/**
 * Inline status pill shown on the home page. Pings /health once on
 * mount. If the response takes longer than COLD_THRESHOLD_MS the pill
 * warns the user the backend is likely waking from a Render cold
 * start (adds ~20s to the first debate).
 */
export function BackendStatus() {
  const [status, setStatus] = useState<Status>({ kind: "checking" });

  useEffect(() => {
    const started = performance.now();
    // Race a warm-cutoff timer against the actual response.
    const coldTimer = window.setTimeout(() => {
      setStatus((prev) => (prev.kind === "checking" ? { kind: "cold" } : prev));
    }, COLD_THRESHOLD_MS);

    const controller = new AbortController();
    fetch(`${env.NEXT_PUBLIC_API_URL}/health`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        const latencyMs = Math.round(performance.now() - started);
        window.clearTimeout(coldTimer);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        setStatus({ kind: "warm", latencyMs });
      })
      .catch(() => {
        window.clearTimeout(coldTimer);
        setStatus({ kind: "down" });
      });

    return () => {
      window.clearTimeout(coldTimer);
      controller.abort();
    };
  }, []);

  if (status.kind === "checking") {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-fg-faint">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-fg-faint pulse-ring" />
        pinging backend…
      </span>
    );
  }

  if (status.kind === "warm") {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-fg-muted">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
        backend <span className="text-success">OK</span>{" "}
        <span className="text-fg-faint">{status.latencyMs}ms</span>
      </span>
    );
  }

  if (status.kind === "cold") {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-warning">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-warning pulse-ring" />
        backend waking up — first request takes ~20s
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-error">
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-error" />
      backend unreachable
    </span>
  );
}
