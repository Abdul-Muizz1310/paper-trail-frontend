import "server-only";

/**
 * What the backend proxy forwards (spec 05 §2): the path guard and the header
 * allowlists in both directions. Pure; the proxy itself is `backend-proxy.ts`.
 */

/** Request headers copied from the browser. Never cookies, never `authorization`. */
export const PROXY_REQUEST_HEADERS = [
  "content-type",
  "accept",
  "last-event-id",
  "x-request-id",
] as const;

/** Response headers copied from the backend. */
export const PROXY_RESPONSE_HEADERS = [
  "content-type",
  "cache-control",
  "retry-after",
  "x-request-id",
  "last-event-id",
] as const;

// RFC 3986 unreserved characters only: no `%` (so nothing encoded is ever
// decoded later), no `/` or `\`, no `:` or `@`.
const SEGMENT = /^[A-Za-z0-9._~-]+$/;

/**
 * The backend URL for a proxied path, or `null` when the proxy must refuse
 * it: no segments, an empty, `.` or `..` segment, any character outside the
 * unreserved set, a query that does not start with `?`, or a result whose
 * origin is not the backend's (the SSRF guard).
 */
export function resolveUpstreamUrl(
  backendBase: string,
  segments: readonly string[],
  search: string,
): URL | null {
  if (segments.length === 0) return null;
  for (const segment of segments) {
    if (!SEGMENT.test(segment) || segment === "." || segment === "..") return null;
  }
  if (search !== "" && !search.startsWith("?")) return null;
  const base = new URL(backendBase);
  const prefix = base.pathname.replace(/\/+$/, "");
  const url = new URL(`${prefix}/${segments.join("/")}${search}`, base.origin);
  return url.origin === base.origin ? url : null;
}

function clientAddress(incoming: Headers): string | null {
  for (const name of ["x-forwarded-for", "x-real-ip"]) {
    const value = incoming.get(name)?.trim();
    if (value) return value;
  }
  return null;
}

/** Headers for the upstream request: the allowlist, the fresh token, the visitor's address. */
export function upstreamRequestHeaders(incoming: Headers, token: string): Headers {
  const out = new Headers();
  for (const name of PROXY_REQUEST_HEADERS) {
    const value = incoming.get(name);
    if (value !== null) out.set(name, value);
  }
  out.set("x-platform-token", token);
  const client = clientAddress(incoming);
  if (client !== null) out.set("x-forwarded-for", client);
  return out;
}

/** Headers for the browser: the allowlist, nothing else. */
export function downstreamResponseHeaders(upstream: Headers): Headers {
  const out = new Headers();
  for (const name of PROXY_RESPONSE_HEADERS) {
    const value = upstream.get(name);
    if (value !== null) out.set(name, value);
  }
  return out;
}
