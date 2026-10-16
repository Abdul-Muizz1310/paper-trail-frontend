import "server-only";
import { loadSigningKey, mintPlatformToken, SIGNING_KEY_ENV } from "./platform-token";
import {
  downstreamResponseHeaders,
  resolveUpstreamUrl,
  upstreamRequestHeaders,
} from "./proxy-rules";

/**
 * The imperative shell of the backend proxy (spec 05 §2): guard the path,
 * load the key, mint a token, forward, and stream the answer back. It never
 * sends an unsigned request.
 */

function refuse(status: 400 | 502 | 503, error: string): Response {
  return Response.json({ error }, { status });
}

export async function proxyToBackend(
  request: Request,
  segments: readonly string[],
  backendBase: string,
): Promise<Response> {
  const target = resolveUpstreamUrl(backendBase, segments, new URL(request.url).search);
  if (target === null) return refuse(400, "invalid path");

  const signingKey = loadSigningKey(process.env[SIGNING_KEY_ENV]);
  if (!signingKey.ok) {
    console.error(`[api/backend] ${SIGNING_KEY_ENV} is ${signingKey.reason}; refusing to proxy`);
    return refuse(503, "proxy not configured");
  }

  const body = request.method === "GET" ? undefined : await request.arrayBuffer();
  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers: upstreamRequestHeaders(request.headers, mintPlatformToken(signingKey.key)),
      body,
      cache: "no-store",
      redirect: "manual",
      signal: request.signal,
    });
  } catch (err) {
    // A closed tab aborts the call too; that is no backend failure to report.
    if (!request.signal.aborted) {
      console.error(`[api/backend] ${request.method} ${target.pathname} failed:`, err);
    }
    return refuse(502, "backend unreachable");
  }

  // The body is handed over as a stream, never read here: SSE arrives event by event.
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: downstreamResponseHeaders(upstream.headers),
  });
}
