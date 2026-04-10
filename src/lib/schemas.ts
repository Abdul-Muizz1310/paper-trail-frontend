import { z } from "zod";

/**
 * Wire schemas for paper-trail-backend v0.1.0.
 *
 * Backend reality (verified against the live API on 2026-04-09):
 *   rounds: [{ side: "proponent"|"skeptic", round: 1, argument: "md",
 *              evidence: [{ title, url, snippet, published_date }] }]
 *
 * Frontend prefers a cleaner shape (side: "pro"|"con"|"judge",
 * index 0-based, body_md, evidence[].quote). parseRounds() bridges
 * the two, dropping malformed items with a dev warning so one bad
 * row can't crash the arena.
 */

export const VerdictSchema = z.enum(["TRUE", "FALSE", "INCONCLUSIVE"]);
export type Verdict = z.infer<typeof VerdictSchema>;

export const EvidenceSchema = z.object({
  title: z.string(),
  url: z.string(), // Backend sometimes returns bare paths; keep loose.
  quote: z.string().optional(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const SideSchema = z.enum(["pro", "con", "judge"]);
export type Side = z.infer<typeof SideSchema>;

export type Round = {
  index: number;
  side: Side;
  claim: string;
  body_md: string;
  evidence: Evidence[];
};

/** Map the backend's `side` vocabulary to our UI vocabulary. */
function normaliseSide(raw: unknown): Side | null {
  if (raw === "pro" || raw === "proponent") return "pro";
  if (raw === "con" || raw === "opponent" || raw === "skeptic") return "con";
  if (raw === "judge") return "judge";
  return null;
}

/** Loosely parse one backend evidence item into our shape. */
function parseEvidence(raw: unknown): Evidence | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const title = typeof r.title === "string" ? r.title : null;
  const url = typeof r.url === "string" ? r.url : null;
  if (!title || !url) return null;
  // Backend uses `snippet`; our UI shows it as `quote`.
  const quote =
    typeof r.snippet === "string" ? r.snippet : typeof r.quote === "string" ? r.quote : undefined;
  return { title, url, quote };
}

/**
 * Accept rounds in the backend's native shape and convert them to
 * the frontend's internal Round[]. Drop malformed entries.
 */
export function parseRounds(raw: unknown): Round[] {
  if (!Array.isArray(raw)) return [];
  const out: Round[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;

    const side = normaliseSide(r.side);
    if (!side) {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn("[paper-trail] unknown side", r.side);
      }
      continue;
    }

    // 1-based `round` (backend) → 0-based `index` (ui). Fall back to
    // an `index` field if a caller already normalised the shape.
    const rawIndex =
      typeof r.round === "number" ? r.round - 1 : typeof r.index === "number" ? r.index : null;
    if (rawIndex === null || rawIndex < 0) continue;

    // `argument` is the backend field; `body_md` is accepted too.
    const body =
      typeof r.argument === "string" ? r.argument : typeof r.body_md === "string" ? r.body_md : "";

    // Short claim summary is optional; derive a preview if absent.
    const claim =
      typeof r.claim === "string" && r.claim.length > 0
        ? r.claim
        : body.slice(0, 120).replace(/\s+/g, " ");

    const evidence = Array.isArray(r.evidence)
      ? r.evidence.map(parseEvidence).filter((e): e is Evidence => e !== null)
      : [];

    out.push({ index: rawIndex, side, claim, body_md: body, evidence });
  }
  return out.sort((a, b) => a.index - b.index);
}

export const DebateStatusSchema = z.enum(["pending", "running", "done", "failed", "error"]);
export type DebateStatus = z.infer<typeof DebateStatusSchema>;

/**
 * Full debate snapshot as returned by GET /debates/{id}. The backend types
 * rounds as list[dict[str, Any]] and uses its own field names — we run
 * them through parseRounds() to get our internal shape.
 */
export const DebateSchema = z
  .object({
    id: z.string().uuid(),
    claim: z.string(),
    status: z.string(),
    verdict: VerdictSchema.nullable(),
    confidence: z.number().nullable(),
    rounds: z.array(z.unknown()).catch([]),
    transcript_md: z.string().nullable(),
    created_at: z.string(),
  })
  .transform((raw) => ({
    ...raw,
    rounds: parseRounds(raw.rounds),
  }));
export type Debate = z.infer<typeof DebateSchema>;

export const DebateCreateOutSchema = z.object({
  debate_id: z.string().uuid(),
  stream_url: z.string(),
});
export type DebateCreateOut = z.infer<typeof DebateCreateOutSchema>;

/* ----------------------- SSE event schemas ----------------------- */

export const StateEventSchema = z.object({
  type: z.literal("state"),
  status: z.string(),
  verdict: VerdictSchema.nullable(),
  confidence: z.number().nullable(),
  rounds_count: z.number().int().nonnegative(),
  // New in backend v0.1.1: rounds[] inlined so the client doesn't
  // have to round-trip a GET on every tick. Optional for back-compat.
  // Accepts unknown[] (array of any shape) — parseRounds() handles
  // per-item validation and drops malformed entries.
  rounds: z.array(z.unknown()).optional(),
});
export type StateEvent = z.infer<typeof StateEventSchema>;

export const DoneEventSchema = z.object({
  type: z.literal("done"),
  status: z.string().optional(),
  verdict: VerdictSchema.nullable().optional(),
  confidence: z.number().nullable().optional(),
  rounds_count: z.number().int().nonnegative().optional(),
  rounds: z.array(z.unknown()).optional(),
  reason: z.string().optional(),
});
export type DoneEvent = z.infer<typeof DoneEventSchema>;

/** Terminal reasons that should NOT trigger a reconnect. */
const TERMINAL_ERROR_REASONS = ["not_found", "gone"] as const;

export const ErrorEventSchema = z.object({
  reason: z.string(),
});
export type ErrorEvent = z.infer<typeof ErrorEventSchema>;

/** Check if an error reason is terminal (no retry). */
export function isTerminalErrorReason(reason: string): boolean {
  return (TERMINAL_ERROR_REASONS as readonly string[]).includes(reason);
}

/* ----------------------- Misc helpers ----------------------- */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
