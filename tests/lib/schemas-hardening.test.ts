import { describe, expect, it } from "vitest";
import {
  DebateSchema,
  DoneEventSchema,
  isTerminalErrorReason,
  StateEventSchema,
} from "@/lib/schemas";

describe("isTerminalErrorReason", () => {
  it("P1 not_found is terminal", () => {
    expect(isTerminalErrorReason("not_found")).toBe(true);
  });

  it("P2 gone is terminal", () => {
    expect(isTerminalErrorReason("gone")).toBe(true);
  });

  it("F1 throttled is NOT terminal", () => {
    expect(isTerminalErrorReason("throttled")).toBe(false);
  });

  it("F2 empty string is NOT terminal", () => {
    expect(isTerminalErrorReason("")).toBe(false);
  });

  it("F3 unknown reason is NOT terminal", () => {
    expect(isTerminalErrorReason("server_error")).toBe(false);
  });
});

describe("rounds schema tightening", () => {
  it("P1 DebateSchema.rounds accepts array of objects", () => {
    const raw = {
      id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
      claim: "test",
      status: "done",
      verdict: "TRUE",
      confidence: 0.9,
      rounds: [{ side: "proponent", round: 1, argument: "yes", evidence: [] }],
      transcript_md: null,
      created_at: "2026-04-10T00:00:00Z",
    };
    const parsed = DebateSchema.parse(raw);
    expect(parsed.rounds).toHaveLength(1);
    expect(parsed.rounds[0].side).toBe("pro");
  });

  it("F1 DebateSchema.rounds falls back to empty array when not an array", () => {
    const raw = {
      id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
      claim: "test",
      status: "done",
      verdict: null,
      confidence: null,
      rounds: "not-an-array",
      transcript_md: null,
      created_at: "2026-04-10T00:00:00Z",
    };
    const parsed = DebateSchema.parse(raw);
    expect(parsed.rounds).toEqual([]);
  });

  it("P2 StateEventSchema accepts rounds array", () => {
    const raw = {
      type: "state",
      status: "running",
      verdict: null,
      confidence: null,
      rounds_count: 1,
      rounds: [{ side: "proponent", round: 1, argument: "a", evidence: [] }],
    };
    const result = StateEventSchema.safeParse(raw);
    expect(result.success).toBe(true);
  });

  it("F2 StateEventSchema rejects non-array rounds", () => {
    const raw = {
      type: "state",
      status: "running",
      verdict: null,
      confidence: null,
      rounds_count: 1,
      rounds: "not-an-array",
    };
    const result = StateEventSchema.safeParse(raw);
    expect(result.success).toBe(false);
  });

  it("P3 DoneEventSchema accepts rounds array", () => {
    const raw = {
      type: "done",
      rounds: [{ side: "proponent", round: 1 }],
    };
    const result = DoneEventSchema.safeParse(raw);
    expect(result.success).toBe(true);
  });

  it("P4 StateEventSchema works without rounds (backwards compat)", () => {
    const raw = {
      type: "state",
      status: "running",
      verdict: null,
      confidence: null,
      rounds_count: 0,
    };
    const result = StateEventSchema.safeParse(raw);
    expect(result.success).toBe(true);
  });
});
