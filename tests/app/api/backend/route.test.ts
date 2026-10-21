// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { decodePart, ed25519Pair, verifiesWith } from "../../../lib/server/keys";

/**
 * The composed proxy: the real route module, the real token minting and the
 * real header and path rules. Only `fetch` is a stand-in for the backend, so
 * nothing here opens a socket or reaches a real host.
 */

const BACKEND = "http://backend.test";
const ID = "11111111-1111-4111-8111-111111111111";
const pair = ed25519Pair();

type RouteModule = typeof import("@/app/api/backend/[...path]/route");
type Handler = RouteModule["GET"];

let route: RouteModule;
let fetchMock: Mock<(input: URL | RequestInfo, init?: RequestInit) => Promise<Response>>;

async function loadRoute(): Promise<RouteModule> {
  vi.resetModules();
  return import("@/app/api/backend/[...path]/route");
}

function ctx(path: string[]) {
  return { params: Promise.resolve({ path }) };
}

function call(
  handler: Handler,
  path: string[],
  init: RequestInit & { query?: string } = {},
): Promise<Response> {
  const { query = "", ...rest } = init;
  const url = `http://localhost:3000/api/backend/${path.join("/")}${query}`;
  return handler(new Request(url, rest) as Parameters<Handler>[0], ctx(path));
}

function upstreamCall(index = 0): { url: string; init: RequestInit; headers: Headers } {
  const [input, init] = fetchMock.mock.calls[index];
  return {
    url: input instanceof URL ? input.href : String(input),
    init: init ?? {},
    headers: new Headers(init?.headers),
  };
}

beforeEach(async () => {
  vi.stubEnv("NEXT_PUBLIC_API_URL", BACKEND);
  vi.stubEnv("PAPER_TRAIL_FRONTEND_SIGNING_KEY_PRIVATE", pair.privateB64);
  fetchMock = vi.fn(async () => Response.json({ ok: true }));
  vi.stubGlobal("fetch", fetchMock);
  route = await loadRoute();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("segment config", () => {
  it("P15 exports the five methods and the segment config", () => {
    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"] as const) {
      expect(typeof route[method]).toBe("function");
    }
    expect(route.runtime).toBe("nodejs");
    expect(route.dynamic).toBe("force-dynamic");
    expect(route.maxDuration).toBe(300);
  });
});

describe("forwarding", () => {
  it("P11 GET reaches the backend path with the query, a valid token and the fetch options", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('{"id":"x"}', {
        status: 200,
        headers: { "content-type": "application/json", "x-request-id": "req-9" },
      }),
    );
    const res = await call(route.GET, ["debates", ID], {
      query: "?verbose=1",
      headers: {
        accept: "application/json",
        "x-request-id": "req-9",
        "x-forwarded-for": "203.0.113.7",
        cookie: "session=secret",
        authorization: "Bearer leaked",
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const up = upstreamCall();
    expect(up.url).toBe(`${BACKEND}/debates/${ID}?verbose=1`);
    expect(up.init.method).toBe("GET");
    expect(up.init.body).toBeUndefined();
    expect(up.init.cache).toBe("no-store");
    expect(up.init.redirect).toBe("manual");
    expect(up.init.signal).toBeInstanceOf(AbortSignal);

    const token = up.headers.get("x-platform-token") ?? "";
    expect(verifiesWith(token, pair.publicB64)).toBe(true);
    const claims = decodePart(token.split(".")[1]) as Record<string, unknown>;
    expect(claims).toMatchObject({
      iss: "paper-trail-frontend",
      aud: "paper-trail",
      sub: "paper-trail-frontend",
      role: "frontend",
      service: "paper-trail",
    });
    expect(Number(claims.exp) - Number(claims.iat)).toBe(60);

    expect(up.headers.get("accept")).toBe("application/json");
    expect(up.headers.get("x-request-id")).toBe("req-9");
    expect(up.headers.get("x-forwarded-for")).toBe("203.0.113.7");
    expect(up.headers.has("cookie")).toBe(false);
    expect(up.headers.has("authorization")).toBe(false);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/json");
    expect(res.headers.get("x-request-id")).toBe("req-9");
    expect(await res.text()).toBe('{"id":"x"}');
  });

  it("P11 mints a fresh token for every upstream request", async () => {
    await call(route.GET, ["health"]);
    await call(route.GET, ["health"]);
    const a = upstreamCall(0).headers.get("x-platform-token");
    const b = upstreamCall(1).headers.get("x-platform-token");
    expect(a).not.toBe(b);
  });

  it("P11 passes the upstream status and only the allowlisted response headers", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('{"detail":"slow down"}', {
        status: 429,
        headers: {
          "content-type": "application/json",
          "retry-after": "30",
          "set-cookie": "tracking=1",
          server: "uvicorn",
        },
      }),
    );
    const res = await call(route.GET, ["debates", ID]);
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("30");
    expect(res.headers.has("set-cookie")).toBe(false);
    expect(res.headers.has("server")).toBe(false);
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"] as const)(
    "P12 %s forwards its method and body byte for byte",
    async (method) => {
      const body = JSON.stringify({ claim: "Café ☕ is a drink.", max_rounds: 3 });
      await call(route[method], ["debates"], {
        method,
        body,
        headers: { "content-type": "application/json" },
      });
      const up = upstreamCall();
      expect(up.init.method).toBe(method);
      expect(up.headers.get("content-type")).toBe("application/json");
      const sent = up.init.body as ArrayBuffer;
      expect(sent).toBeInstanceOf(ArrayBuffer);
      expect(Buffer.from(sent).equals(Buffer.from(body, "utf8"))).toBe(true);
    },
  );

  it("P13 streams SSE: the first event arrives while the upstream is still open", async () => {
    const encoder = new TextEncoder();
    let upstream: ReadableStreamDefaultController<Uint8Array> | undefined;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        upstream = controller;
      },
    });
    fetchMock.mockResolvedValueOnce(
      new Response(body, {
        status: 200,
        headers: {
          "content-type": "text/event-stream",
          "cache-control": "no-cache, no-transform",
          "last-event-id": "7",
        },
      }),
    );

    const res = await call(route.GET, ["debates", ID, "stream"], {
      headers: { accept: "text/event-stream", "last-event-id": "6" },
    });
    expect(upstreamCall().headers.get("last-event-id")).toBe("6");
    expect(res.headers.get("content-type")).toBe("text/event-stream");
    expect(res.headers.get("cache-control")).toBe("no-cache, no-transform");
    expect(res.headers.get("last-event-id")).toBe("7");

    const reader = res.body?.getReader();
    if (!reader || !upstream) throw new Error("no stream");
    const first = 'id: 7\nevent: state\ndata: {"rounds_count":1}\n\n';
    upstream.enqueue(encoder.encode(first));

    const timeout = new Promise<"buffered">((resolve) =>
      setTimeout(() => resolve("buffered"), 1000),
    );
    const chunk = await Promise.race([reader.read(), timeout]);
    expect(chunk).not.toBe("buffered");
    if (chunk === "buffered") return;
    expect(new TextDecoder().decode(chunk.value)).toBe(first);

    upstream.enqueue(encoder.encode('event: done\ndata: {"type":"done"}\n\n'));
    upstream.close();
    const rest = await reader.read();
    expect(new TextDecoder().decode(rest.value)).toContain("event: done");
    expect((await reader.read()).done).toBe(true);
  });

  it("P13 closing the client request aborts the upstream call", async () => {
    const client = new AbortController();
    await call(route.GET, ["debates", ID, "stream"], { signal: client.signal });
    const signal = upstreamCall().init.signal as AbortSignal;
    expect(signal.aborted).toBe(false);
    client.abort();
    expect(signal.aborted).toBe(true);
  });

  it("P14 returns an upstream redirect without following it or exposing its location", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(null, { status: 307, headers: { location: `${BACKEND}/debates` } }),
    );
    const res = await call(route.GET, ["debates"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(307);
    expect(res.headers.has("location")).toBe(false);
  });
});

describe("refusals", () => {
  it.each<[string, string[]]>([
    ["an empty segment", ["debates", ""]],
    ["a dot-dot segment", ["debates", "..", "admin"]],
    ["a backslash", ["debates\\admin"]],
    ["an encoded traversal", ["%2e%2e", "admin"]],
    ["an encoded slash", ["debates%2F..%2Fadmin"]],
    ["an absolute URL", ["https:", "", "evil.com"]],
    ["userinfo", ["evil.com@", "debates"]],
  ])("F7 %s → 400 and no upstream call", async (_label, path) => {
    const res = await route.GET(
      new Request("http://localhost:3000/api/backend/x") as Parameters<Handler>[0],
      ctx(path),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid path" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("F7 no segments at all → 400 and no upstream call", async () => {
    const res = await route.POST(
      new Request("http://localhost:3000/api/backend", {
        method: "POST",
      }) as Parameters<Handler>[0],
      ctx([]),
    );
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("F8 a missing key → 503, no upstream call, and the log names the variable", async () => {
    vi.stubEnv("PAPER_TRAIL_FRONTEND_SIGNING_KEY_PRIVATE", "");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call(route.GET, ["debates", ID]);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "proxy not configured" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(log.mock.calls.flat().join(" ")).toContain("PAPER_TRAIL_FRONTEND_SIGNING_KEY_PRIVATE");
    expect(log.mock.calls.flat().join(" ")).toContain("missing");
  });

  it("F9 a malformed key → 503, no upstream call, and the log never holds the value", async () => {
    const bad = "c2VjcmV0LWJ1dC1ub3QtYS1rZXk=";
    vi.stubEnv("PAPER_TRAIL_FRONTEND_SIGNING_KEY_PRIVATE", bad);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await call(route.POST, ["debates"], { method: "POST", body: "{}" });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "proxy not configured" });
    expect(fetchMock).not.toHaveBeenCalled();
    const logged = log.mock.calls.flat().join(" ");
    expect(logged).toContain("PAPER_TRAIL_FRONTEND_SIGNING_KEY_PRIVATE");
    expect(logged).toContain("malformed");
    expect(logged).not.toContain(bad);
  });

  it("F10 an unreachable backend → 502", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockRejectedValueOnce(
      new TypeError("fetch failed", { cause: new Error("connect ECONNREFUSED") }),
    );
    const res = await call(route.GET, ["debates", ID]);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "backend unreachable" });
    expect(log).toHaveBeenCalledTimes(1);
  });

  it("F10 a fetch aborted because the browser left is not logged as a backend failure", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const client = new AbortController();
    fetchMock.mockImplementationOnce(async () => {
      client.abort();
      throw new DOMException("This operation was aborted", "AbortError");
    });
    const res = await call(route.GET, ["debates", ID, "stream"], { signal: client.signal });
    expect(res.status).toBe(502);
    expect(log).not.toHaveBeenCalled();
  });
});
