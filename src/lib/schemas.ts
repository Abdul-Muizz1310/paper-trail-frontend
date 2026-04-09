import { z } from "zod";

/**
 * Wire schemas for paper-trail-backend v0.1.0.
 *
 * These zod schemas are the frontend's source of truth for what a debate
 * "looks like". Unknown keys are preserved but ignored; malformed rounds
 * are dropped with a console warning (never crash the page).
 */

export const VerdictSchema = z.enum(["TRUE", "FALSE", "INCONCLUSIVE"]);
export type Verdict = z.infer<typeof VerdictSchema>;

export const EvidenceSchema = z.object({
  title: z.string(),
  url: z.string().url(),
  quote: z.string().optional(),
});
export type Evidence = z.infer<typeof EvidenceSchema>;

export const SideSchema = z.enum(["pro", "con", "judge"]);
export type Side = z.infer<typeof SideSchema>;

export const RoundSchema = z.object({
  index: z.number().int().nonnegative(),
  side: SideSchema,
  claim: z.string(),
  body_md: z.string(),
  evidence: z.array(EvidenceSchema).default([]),
});
export type Round = z.infer<typeof RoundSchema>;

/**
 * Parse a raw list of round dicts from the backend. Malformed rounds are
 * dropped (with a console warning in dev), so the arena never crashes
 * because of one bad row.
 */
export function parseRounds(raw: unknown): Round[] {
  if (!Array.isArray(raw)) return [];
  const out: Round[] = [];
  for (const item of raw) {
    const parsed = RoundSchema.safeParse(item);
    if (parsed.success) {
      out.push(parsed.data);
    } else if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn("[paper-trail] dropping malformed round", parsed.error.issues);
    }
  }
  return out.sort((a, b) => a.index - b.index);
}

export const DebateStatusSchema = z.enum(["pending", "running", "done", "failed", "error"]);
export type DebateStatus = z.infer<typeof DebateStatusSchema>;

/**
 * Full debate snapshot as returned by GET /debates/{id}. The backend types
 * rounds as list[dict[str, Any]] — we parse them through RoundSchema here.
 */
export const DebateSchema = z
  .object({
    id: z.string().uuid(),
    claim: z.string(),
    status: z.string(), // tolerate unknown statuses rather than 500'ing the page
    verdict: VerdictSchema.nullable(),
    confidence: z.number().nullable(),
    rounds: z.unknown(),
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
});
export type StateEvent = z.infer<typeof StateEventSchema>;

export const DoneEventSchema = z.object({
  type: z.literal("done"),
  status: z.string().optional(),
  verdict: VerdictSchema.nullable().optional(),
  confidence: z.number().nullable().optional(),
  rounds_count: z.number().int().nonnegative().optional(),
  reason: z.string().optional(),
});
export type DoneEvent = z.infer<typeof DoneEventSchema>;

export const ErrorEventSchema = z.object({
  reason: z.string(),
});
export type ErrorEvent = z.infer<typeof ErrorEventSchema>;

/* ----------------------- Misc helpers ----------------------- */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}
