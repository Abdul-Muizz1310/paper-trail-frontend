/**
 * Where browser code reaches the backend: the same-origin signing proxy
 * (`src/app/api/backend/[...path]/route.ts`, spec 05). The browser never calls
 * the backend's own origin, so it never needs a platform token or CORS.
 */
export const BACKEND_PROXY_PREFIX = "/api/backend";

/** A backend path, always with its leading slash: `/debates`, `/health`. */
export type BackendPath = `/${string}`;

export function backendUrl(path: BackendPath): string {
  return `${BACKEND_PROXY_PREFIX}${path}`;
}
