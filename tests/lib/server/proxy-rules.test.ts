// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  downstreamResponseHeaders,
  PROXY_REQUEST_HEADERS,
  PROXY_RESPONSE_HEADERS,
  resolveUpstreamUrl,
  upstreamRequestHeaders,
} from "@/lib/server/proxy-rules";

const BACKEND = "https://paper-trail-backend-jjpf.onrender.com";
const ID = "11111111-1111-4111-8111-111111111111";

describe("resolveUpstreamUrl", () => {
  it("P8 joins the segments onto the backend origin", () => {
    expect(resolveUpstreamUrl(BACKEND, ["debates", ID, "stream"], "")?.href).toBe(
      `${BACKEND}/debates/${ID}/stream`,
    );
  });

  it("P8 keeps the query string as received", () => {
    expect(resolveUpstreamUrl(BACKEND, ["debates"], "?limit=5&cursor=a%20b")?.href).toBe(
      `${BACKEND}/debates?limit=5&cursor=a%20b`,
    );
  });

  it("P8 keeps a base path, with or without a trailing slash", () => {
    for (const base of ["https://api.example.com/v1", "https://api.example.com/v1/"]) {
      expect(resolveUpstreamUrl(base, ["health"], "")?.href).toBe(
        "https://api.example.com/v1/health",
      );
    }
  });

  it("P8 allows every unreserved character, such as transcript.md and ~", () => {
    expect(resolveUpstreamUrl(BACKEND, ["debates", ID, "transcript.md"], "")?.pathname).toBe(
      `/debates/${ID}/transcript.md`,
    );
    expect(resolveUpstreamUrl(BACKEND, ["a_b-c~d"], "")?.pathname).toBe("/a_b-c~d");
  });

  it.each<[string, string[]]>([
    ["no segments", []],
    ["an empty segment", ["debates", "", "stream"]],
    ["a dot segment", ["debates", ".", "stream"]],
    ["a dot-dot segment", ["debates", "..", "admin"]],
    ["a backslash", ["debates\\..\\admin"]],
    ["a slash inside a segment", ["debates/../admin"]],
    ["an encoded dot-dot", ["%2e%2e", "admin"]],
    ["an encoded slash after dots", ["..%2fadmin"]],
    ["an encoded slash", ["debates%2F..%2Fadmin"]],
    ["a double-encoded dot-dot", ["%252e%252e"]],
    ["a scheme", ["https:", "evil.com"]],
    ["a protocol-relative host", ["//evil.com"]],
    ["userinfo", ["evil.com@", "debates"]],
    ["a space", ["debates", "a b"]],
    ["a NUL byte", ["debates\u0000"]],
    ["a non-ASCII character", ["débats"]],
  ])("F4 refuses %s", (_label, segments) => {
    expect(resolveUpstreamUrl(BACKEND, segments, "")).toBeNull();
  });

  it("F4 refuses a result off the backend's origin (a base path that reads as //host)", () => {
    expect(resolveUpstreamUrl("https://api.example.com//evil.com", ["health"], "")).toBeNull();
  });

  it("F4 refuses a query string that does not start with ?", () => {
    expect(resolveUpstreamUrl(BACKEND, ["debates"], "@evil.com")).toBeNull();
    expect(resolveUpstreamUrl(BACKEND, ["debates"], "#frag")).toBeNull();
  });
});

describe("upstreamRequestHeaders", () => {
  it("P9 copies exactly the allowlisted headers and sets the fresh token", () => {
    expect([...PROXY_REQUEST_HEADERS]).toEqual([
      "content-type",
      "accept",
      "last-event-id",
      "x-request-id",
    ]);
    const out = upstreamRequestHeaders(
      new Headers({
        "content-type": "application/json",
        accept: "text/event-stream",
        "last-event-id": "42",
        "x-request-id": "req-1",
      }),
      "signed.token.here",
    );
    expect(Object.fromEntries(out)).toEqual({
      "content-type": "application/json",
      accept: "text/event-stream",
      "last-event-id": "42",
      "x-request-id": "req-1",
      "x-platform-token": "signed.token.here",
    });
  });

  it("P9 x-forwarded-for comes from x-forwarded-for first", () => {
    const out = upstreamRequestHeaders(
      new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1", "x-real-ip": "198.51.100.2" }),
      "t",
    );
    expect(out.get("x-forwarded-for")).toBe("203.0.113.7, 10.0.0.1");
  });

  it("P9 x-forwarded-for falls back to x-real-ip", () => {
    const out = upstreamRequestHeaders(new Headers({ "x-real-ip": "198.51.100.2" }), "t");
    expect(out.get("x-forwarded-for")).toBe("198.51.100.2");
  });

  it("P9 x-forwarded-for is absent when the visitor's address is unknown", () => {
    const out = upstreamRequestHeaders(new Headers({ "x-forwarded-for": "  " }), "t");
    expect(out.has("x-forwarded-for")).toBe(false);
  });

  it("F5 never forwards credentials, origin headers or the browser's own token", () => {
    const out = upstreamRequestHeaders(
      new Headers({
        cookie: "session=secret",
        authorization: "Bearer leaked",
        origin: "https://paper-trail-frontend-sable.vercel.app",
        referer: "https://paper-trail-frontend-sable.vercel.app/",
        host: "paper-trail-frontend-sable.vercel.app",
        "x-platform-token": "forged-by-the-browser",
        "user-agent": "test",
      }),
      "fresh",
    );
    expect(Object.fromEntries(out)).toEqual({ "x-platform-token": "fresh" });
  });
});

describe("downstreamResponseHeaders", () => {
  it("P10 copies exactly the allowlisted headers", () => {
    expect([...PROXY_RESPONSE_HEADERS]).toEqual([
      "content-type",
      "cache-control",
      "retry-after",
      "x-request-id",
      "last-event-id",
    ]);
    const out = downstreamResponseHeaders(
      new Headers({
        "content-type": "text/event-stream",
        "cache-control": "no-cache, no-transform",
        "retry-after": "30",
        "x-request-id": "req-1",
        "last-event-id": "42",
      }),
    );
    expect(Object.fromEntries(out)).toEqual({
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "retry-after": "30",
      "x-request-id": "req-1",
      "last-event-id": "42",
    });
  });

  it("F6 drops everything else", () => {
    const out = downstreamResponseHeaders(
      new Headers({
        "set-cookie": "a=b",
        location: "https://evil.example/",
        "content-length": "12",
        "content-encoding": "gzip",
        server: "uvicorn",
        "x-powered-by": "FastAPI",
        "access-control-allow-origin": "*",
      }),
    );
    expect([...out.keys()]).toEqual([]);
  });
});
