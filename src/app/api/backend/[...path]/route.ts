import { env } from "@/lib/env";
import { proxyToBackend } from "@/lib/server/backend-proxy";

/**
 * Same-origin proxy to paper-trail-backend (spec 05). The browser calls
 * `/api/backend/<path>`; this signs a fresh platform token and forwards to
 * `${NEXT_PUBLIC_API_URL}/<path>`, streaming the answer back (SSE included).
 */

// node:crypto signs the token.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A debate stream runs for minutes; the stream's own reconnect covers a cut.
export const maxDuration = 300;

type Context = { params: Promise<{ path: string[] }> };

async function forward(request: Request, { params }: Context): Promise<Response> {
  const { path } = await params;
  return proxyToBackend(request, path, env.NEXT_PUBLIC_API_URL);
}

export const GET = forward;
export const POST = forward;
export const PUT = forward;
export const PATCH = forward;
export const DELETE = forward;
