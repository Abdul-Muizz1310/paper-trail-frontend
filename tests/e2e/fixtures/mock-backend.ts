import { createPublicKey, type KeyObject, randomUUID, verify } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";

/**
 * A tiny stand-in for paper-trail-backend behind the real proxy (spec 05 §5).
 *
 * Like the real backend with DEMO_MODE=false, every route but /health demands
 * an X-Platform-Token that verifies against the frontend's public key, with
 * platform contract v2's `iss: "paper-trail-frontend"` and `aud: "paper-trail"`
 * (one string), `service: "paper-trail"` and `role: "frontend"`; anything else
 * gets 401. It
 * records what it received so a test can inspect it, and holds each debate's
 * stream open after the first event until the test releases it.
 *
 * Control routes, which the test calls on this server's own origin (the
 * browser never sees it):
 *   GET  /__control/requests              → every recorded request
 *   POST /__control/debates/{id}/release  → let that debate's stream finish
 */

export type TokenCheck =
  | { valid: true; header: Record<string, unknown>; claims: Record<string, unknown> }
  | { valid: false; reason: string };

export type ReceivedRequest = {
  method: string;
  path: string;
  debateId: string | null;
  token: string | null;
  check: TokenCheck;
  headers: Record<string, string | null>;
};

type Debate = {
  id: string;
  claim: string;
  streamOpened: boolean;
  finished: boolean;
  release: () => void;
  released: Promise<void>;
};

/** Headers a test asserts on: the ones the proxy must drop and the ones it must send. */
const RECORDED_HEADERS = [
  "cookie",
  "authorization",
  "origin",
  "referer",
  "x-forwarded-for",
  "content-type",
  "accept",
] as const;

const HOLD_MS = 60_000;
const TRANSCRIPT_MD = readFileSync(path.join(__dirname, "transcript.md"), "utf-8");

function decodeJsonPart(part: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** The backend's check, for a frontend-key token. */
export function checkToken(token: string | null, key: KeyObject, nowS: number): TokenCheck {
  if (!token) return { valid: false, reason: "missing" };
  const parts = token.split(".");
  if (parts.length !== 3) return { valid: false, reason: "not a compact JWS" };
  const [h, c, s] = parts;
  const header = decodeJsonPart(h);
  const claims = decodeJsonPart(c);
  if (header === null || claims === null) return { valid: false, reason: "undecodable" };
  if (header.alg !== "EdDSA") return { valid: false, reason: "alg" };
  const signature = Buffer.from(s, "base64url");
  if (!verify(null, Buffer.from(`${h}.${c}`, "ascii"), key, signature)) {
    return { valid: false, reason: "signature" };
  }
  if (typeof claims.exp !== "number" || claims.exp <= nowS) return { valid: false, reason: "exp" };
  if (claims.iss !== "paper-trail-frontend") return { valid: false, reason: "iss" };
  if (claims.aud !== "paper-trail") return { valid: false, reason: "aud" };
  if (claims.service !== "paper-trail") return { valid: false, reason: "service" };
  if (claims.role !== "frontend") return { valid: false, reason: "role" };
  return { valid: true, header, claims };
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json", "x-powered-by": "mock" });
  res.end(JSON.stringify(body));
}

function rounds(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    index: i,
    side: i % 2 === 0 ? "pro" : "con",
    claim: `round ${i}`,
    body_md: `Round ${i} body`,
    evidence: [],
  }));
}

function debateBody(d: Debate) {
  return {
    id: d.id,
    claim: d.claim,
    status: d.finished ? "done" : "running",
    verdict: d.finished ? "TRUE" : null,
    confidence: d.finished ? 0.78 : null,
    rounds: rounds(d.finished ? 2 : d.streamOpened ? 1 : 0),
    transcript_md: d.finished ? TRANSCRIPT_MD : null,
    created_at: "2026-10-16T12:00:00Z",
  };
}

function sse(res: ServerResponse, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

export type MockBackend = { url: string; close: () => Promise<void> };

export async function startMockBackend(opts: {
  port: number;
  publicKeyB64: string;
}): Promise<MockBackend> {
  const key = createPublicKey({
    key: Buffer.from(opts.publicKeyB64, "base64"),
    format: "der",
    type: "spki",
  });
  const debates = new Map<string, Debate>();
  const received: ReceivedRequest[] = [];

  function newDebate(claim: string): Debate {
    let release: () => void = () => {};
    const released = new Promise<void>((resolve) => {
      release = resolve;
    });
    const d: Debate = {
      id: randomUUID(),
      claim,
      streamOpened: false,
      finished: false,
      release,
      released,
    };
    debates.set(d.id, d);
    return d;
  }

  async function stream(req: IncomingMessage, res: ServerResponse, d: Debate): Promise<void> {
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    });
    res.flushHeaders();
    if (!d.finished) {
      d.streamOpened = true;
      const state = { type: "state", status: "running", verdict: null, confidence: null };
      sse(res, "state", { ...state, rounds_count: 1, rounds: rounds(1) });
      let closed = false;
      req.on("close", () => {
        closed = true;
      });
      await Promise.race([d.released, new Promise((r) => setTimeout(r, HOLD_MS))]);
      if (closed) return;
      sse(res, "state", { ...state, rounds_count: 2, rounds: rounds(2) });
      d.finished = true;
    }
    sse(res, "done", { type: "done", status: "done", verdict: "TRUE", confidence: 0.78 });
    res.end();
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", "http://mock.invalid");
    const method = req.method ?? "GET";

    if (url.pathname === "/__control/requests") return json(res, 200, received);
    const release = url.pathname.match(/^\/__control\/debates\/([^/]+)\/release$/);
    if (release && method === "POST") {
      const d = debates.get(release[1]);
      if (!d) return json(res, 404, { detail: "unknown debate" });
      d.release();
      res.writeHead(204).end();
      return;
    }

    const token = req.headers["x-platform-token"];
    const raw = typeof token === "string" ? token : null;
    const headers: Record<string, string | null> = {};
    for (const name of RECORDED_HEADERS) {
      const v = req.headers[name];
      headers[name] = typeof v === "string" ? v : null;
    }
    const debateId = url.pathname.match(/^\/debates\/([0-9a-f-]{36})(?:\/|$)/)?.[1] ?? null;
    const record: ReceivedRequest = {
      method,
      path: `${url.pathname}${url.search}`,
      debateId,
      token: raw,
      check: checkToken(raw, key, Math.floor(Date.now() / 1000)),
      headers,
    };
    received.push(record);

    if (url.pathname === "/health" && method === "GET") return json(res, 200, { status: "ok" });
    if (!record.check.valid) return json(res, 401, { detail: "invalid platform token" });

    if (url.pathname === "/debates" && method === "POST") {
      const body: unknown = JSON.parse((await readBody(req)) || "{}");
      const claim =
        typeof body === "object" && body !== null && "claim" in body ? String(body.claim) : "";
      const d = newDebate(claim);
      record.debateId = d.id;
      return json(res, 201, { debate_id: d.id, stream_url: `/debates/${d.id}/stream` });
    }

    const d = debateId === null ? undefined : debates.get(debateId);
    if (url.pathname === `/debates/${debateId}` && method === "GET") {
      return d ? json(res, 200, debateBody(d)) : json(res, 404, { detail: "debate not found" });
    }
    if (url.pathname === `/debates/${debateId}/stream` && method === "GET") {
      if (d) return stream(req, res, d);
      res.writeHead(200, { "content-type": "text/event-stream" });
      sse(res, "error", { reason: "not_found" });
      res.end();
      return;
    }
    return json(res, 404, { detail: "not found" });
  }

  const server = createServer((req, res) => {
    handle(req, res).catch((err: unknown) => {
      if (!res.headersSent) json(res, 500, { detail: String(err) });
      else res.end();
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(opts.port, "127.0.0.1", () => resolve());
  });

  return {
    url: `http://127.0.0.1:${opts.port}`,
    close: () =>
      new Promise<void>((resolve) => {
        for (const d of debates.values()) d.release();
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
