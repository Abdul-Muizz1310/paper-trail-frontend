import { describe, expect, it, vi } from "vitest";
import {
  DebateSchema,
  DoneEventSchema,
  isTerminalErrorReason,
  isUuid,
  parseRounds,
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

describe("parseRounds — side normalisation", () => {
  it("P1 maps 'opponent' to 'con'", () => {
    const rounds = parseRounds([{ side: "opponent", round: 1, argument: "arg", evidence: [] }]);
    expect(rounds).toHaveLength(1);
    expect(rounds[0].side).toBe("con");
  });

  it("P2 maps 'skeptic' to 'con'", () => {
    const rounds = parseRounds([{ side: "skeptic", round: 1, argument: "arg", evidence: [] }]);
    expect(rounds[0].side).toBe("con");
  });

  it("P3 maps 'judge' to 'judge'", () => {
    const rounds = parseRounds([{ side: "judge", round: 1, argument: "verdict", evidence: [] }]);
    expect(rounds[0].side).toBe("judge");
  });

  it("F1 unknown side is dropped with console.warn in non-production", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const rounds = parseRounds([{ side: "alien", round: 1, argument: "arg", evidence: [] }]);
    expect(rounds).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalledWith("[paper-trail] unknown side", "alien");
    warnSpy.mockRestore();
  });

  it("F1b unknown side in production does NOT console.warn", () => {
    vi.stubEnv("NODE_ENV", "production");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const rounds = parseRounds([{ side: "alien", round: 1, argument: "arg", evidence: [] }]);
    expect(rounds).toHaveLength(0);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  it("F2 null side is dropped", () => {
    const rounds = parseRounds([{ side: null, round: 1, argument: "arg", evidence: [] }]);
    expect(rounds).toHaveLength(0);
  });

  it("F3 non-array input returns empty array", () => {
    expect(parseRounds("not an array")).toEqual([]);
    expect(parseRounds(null)).toEqual([]);
    expect(parseRounds(42)).toEqual([]);
  });

  it("F4 non-object items are skipped", () => {
    const rounds = parseRounds([null, undefined, 42, "string"]);
    expect(rounds).toEqual([]);
  });

  it("F5 item with missing round/index is dropped", () => {
    const rounds = parseRounds([{ side: "pro", argument: "arg", evidence: [] }]);
    expect(rounds).toHaveLength(0);
  });

  it("F6 item with negative round is dropped", () => {
    const rounds = parseRounds([{ side: "pro", round: 0, argument: "arg", evidence: [] }]);
    // round: 0 → index: -1 → dropped
    expect(rounds).toHaveLength(0);
  });

  it("P4 uses body_md when argument is absent", () => {
    const rounds = parseRounds([{ side: "pro", round: 1, body_md: "from body_md", evidence: [] }]);
    expect(rounds[0].body_md).toBe("from body_md");
  });

  it("P5 uses index field when round is absent", () => {
    const rounds = parseRounds([{ side: "pro", index: 2, argument: "arg", evidence: [] }]);
    expect(rounds[0].index).toBe(2);
  });

  it("P6 derives claim preview from body when claim is absent", () => {
    const rounds = parseRounds([
      { side: "pro", round: 1, argument: "A long argument here", evidence: [] },
    ]);
    expect(rounds[0].claim).toBe("A long argument here");
  });

  it("P7 evidence with snippet maps to quote", () => {
    const rounds = parseRounds([
      {
        side: "pro",
        round: 1,
        argument: "a",
        evidence: [{ title: "T", url: "https://x.com", snippet: "snip" }],
      },
    ]);
    expect(rounds[0].evidence[0].quote).toBe("snip");
  });

  it("P8 evidence with quote field (no snippet) uses quote", () => {
    const rounds = parseRounds([
      {
        side: "pro",
        round: 1,
        argument: "a",
        evidence: [{ title: "T", url: "https://x.com", quote: "q" }],
      },
    ]);
    expect(rounds[0].evidence[0].quote).toBe("q");
  });

  it("P9 evidence with neither snippet nor quote has undefined quote", () => {
    const rounds = parseRounds([
      {
        side: "pro",
        round: 1,
        argument: "a",
        evidence: [{ title: "T", url: "https://x.com" }],
      },
    ]);
    expect(rounds[0].evidence[0].quote).toBeUndefined();
  });

  it("P10 empty claim with body derives preview from body", () => {
    const rounds = parseRounds([
      { side: "pro", round: 1, argument: "A body text", claim: "", evidence: [] },
    ]);
    expect(rounds[0].claim).toBe("A body text");
  });

  it("P11 both argument and body_md present — argument wins", () => {
    const rounds = parseRounds([
      { side: "pro", round: 1, argument: "arg", body_md: "body", evidence: [] },
    ]);
    expect(rounds[0].body_md).toBe("arg");
  });

  it("P12 neither argument nor body_md — body defaults to empty string", () => {
    const rounds = parseRounds([{ side: "pro", round: 1, evidence: [] }]);
    expect(rounds[0].body_md).toBe("");
  });

  it("P14 explicit non-empty claim is used as-is", () => {
    const rounds = parseRounds([
      { side: "pro", round: 1, argument: "arg", claim: "My claim", evidence: [] },
    ]);
    expect(rounds[0].claim).toBe("My claim");
  });

  it("P13 non-array evidence field is treated as empty", () => {
    const rounds = parseRounds([{ side: "pro", round: 1, argument: "a", evidence: "not-array" }]);
    expect(rounds[0].evidence).toEqual([]);
  });

  it("F7 evidence with missing title/url is dropped", () => {
    const rounds = parseRounds([
      {
        side: "pro",
        round: 1,
        argument: "a",
        evidence: [{ title: "T" }, { url: "u" }, {}],
      },
    ]);
    expect(rounds[0].evidence).toHaveLength(0);
  });

  it("F8 non-object evidence items are dropped", () => {
    const rounds = parseRounds([
      {
        side: "pro",
        round: 1,
        argument: "a",
        evidence: [null, 42, "string"],
      },
    ]);
    expect(rounds[0].evidence).toHaveLength(0);
  });
});

describe("isUuid", () => {
  it("P1 valid UUID returns true", () => {
    expect(isUuid("a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d")).toBe(true);
  });

  it("F1 non-UUID string returns false", () => {
    expect(isUuid("not-a-uuid")).toBe(false);
  });

  it("F2 empty string returns false", () => {
    expect(isUuid("")).toBe(false);
  });
});
