# Spec 05 — Signed backend proxy

## Scope

paper-trail-backend runs with `DEMO_MODE=false` and demands an EdDSA JWT in `X-Platform-Token` on
every route except `/health`, `/version`, `/metrics`, `/openapi.json`, the docs and
`/platform/receipt-public-key`. The frontend used to call it straight from the browser with no
token, so every data call answered 401. Decision DR-0030 (workspace `knowledge/decisions/`): the
frontend holds its own Ed25519 key, its server mints a 60-second token per upstream request, and
the browser reaches the backend only through a same-origin proxy that signs and forwards.

| Piece | File |
|---|---|
| Token claims, base64url, key parsing (pure) | `src/lib/server/token-claims.ts` |
| Key loading and signing (`node:crypto`) | `src/lib/server/platform-token.ts` |
| Path guard and header allowlists (pure) | `src/lib/server/proxy-rules.ts` |
| The proxy itself (imperative shell) | `src/lib/server/backend-proxy.ts` |
| Route handler | `src/app/api/backend/[...path]/route.ts` |
| Where browser code points | `src/lib/backend-url.ts` |

Every module under `src/lib/server/` starts with `import "server-only"`: Next resolves that import
to a module that fails the build if a Client Component pulls it in. Vitest aliases it to an empty
module.

## 1. The token

- **Key.** `PAPER_TRAIL_FRONTEND_SIGNING_KEY_PRIVATE`: an Ed25519 private key, PKCS#8 DER,
  base64 (standard alphabet, no line breaks), the format of bastion's
  `BASTION_SIGNING_KEY_PRIVATE`. Server-only, never `NEXT_PUBLIC_*`. The backend holds the public
  half (SPKI DER, base64) as `PAPER_TRAIL_FRONTEND_SIGNING_KEY_PUBLIC`.
- **Parsing the key.** A leading byte-order mark and edge whitespace (a trailing `\n` or `\r\n`)
  are stripped first (workspace lesson: invisible bytes in deployed env values). Then:
  - unset, empty or only whitespace → **missing**;
  - anything that is not strict base64 (other characters, inner line breaks, a length that is not
    a multiple of 4, misplaced padding) → **malformed**;
  - base64 that does not decode to a PKCS#8 private key, or decodes to one that is not Ed25519
    (an RSA or X25519 key, or an SPKI public key) → **malformed**.
  The key is read on every request, never at import, so a missing key can never crash the server.
- **Header.** Exactly `{"alg":"EdDSA","typ":"JWT","kid":"paper-trail-frontend-2026-10"}`.
- **Claims.** `{"iss":"paper-trail-frontend","aud":"paper-trail","sub":"paper-trail-frontend","role":"frontend","service":"paper-trail","iat":<now>,"exp":<now+60>,"jti":<uuid v4>}`,
  `iat` in whole seconds (floor). The lifetime is exactly 60 s. A token is minted fresh for every
  upstream request, with a new `jti`.
- **Contract v2 (2026-10-20).** `iss` and `aud` are the workspace platform token contract v2
  (`docs/specs/platform-contract-v2.md` §4, DR-0033): the backend accepts a token signed by this
  frontend's key only with `iss == "paper-trail-frontend"` and `role == "frontend"`, and only when
  `aud` is exactly the string `"paper-trail"` (another service's id, or a list, is rejected). `aud` is
  one string, never an array. A contract-v1 backend (PyJWT with no audience configured) rejects a
  token that carries `aud`, so this ships on branch `contract-v2` and merges after the backend's.
- **Encoding.** Compact JWS: `base64url(header) "." base64url(claims) "." base64url(signature)`,
  base64url without padding (RFC 7515), the signature `crypto.sign(null, signingInput, key)` over
  the ASCII signing input (the first two parts joined by `.`).

## 2. The proxy route

`/api/backend/<path>` forwards to `${NEXT_PUBLIC_API_URL}/<path>` (the URL `src/lib/env.ts`
already parses with Zod). It exports `GET`, `POST`, `PUT`, `PATCH` and `DELETE`, plus
`runtime = "nodejs"` (it needs `node:crypto`), `dynamic = "force-dynamic"` and
`maxDuration = 300` (a debate stream runs for minutes; the stream's own reconnect covers a cut).

### The path

The catch-all segments are joined onto the backend base. The proxy forwards a path only if:

- there is at least one segment;
- every segment is non-empty and made only of RFC 3986 unreserved characters
  (`A–Z a–z 0–9 - . _ ~`) and is not `.` or `..`. This rejects a backslash, a slash inside a
  segment, any `%` (so no encoded traversal such as `%2e%2e` or `%2F` can reach the backend
  decoded), `:`, `@` and every other piece of an absolute URL;
- the resolved URL's origin is the backend's origin (the SSRF guard; it catches, for one, a
  configured base whose path begins `//` and would turn the join protocol-relative).

Anything else answers **400** `{"error":"invalid path"}` and makes no upstream call. The query
string is forwarded as received.

### Request headers (browser → backend)

Copied when present: `content-type`, `accept`, `last-event-id`, `x-request-id`. Nothing else: no
`cookie`, no `authorization`, no `origin`, `referer` or `host`, and an incoming `x-platform-token`
is replaced. Added:

- `x-platform-token`: the fresh token;
- `x-forwarded-for`: the incoming `x-forwarded-for`, else `x-real-ip`, else omitted, so the
  backend's per-client rate limit still sees the visitor.

### Body and fetch options

For every method but `GET` the body is read as an `ArrayBuffer` and forwarded unchanged. The
upstream `fetch` uses `cache: "no-store"`, `redirect: "manual"` (a redirect is returned, never
followed) and `signal: request.signal` (a closed tab aborts the upstream call).

### Response (backend → browser)

`new Response(upstream.body, …)`: the body streams through unbuffered, so `text/event-stream`
reaches the browser event by event. The status is the upstream status. Headers are copied only
from `content-type`, `cache-control`, `retry-after`, `x-request-id`, `last-event-id`; never
`set-cookie`, `location`, `content-length`, `content-encoding`, `server` or anything else.

### Errors

| Condition | Answer | Upstream call |
|---|---|---|
| Path fails the guard | 400 `{"error":"invalid path"}` | none |
| Key missing or malformed | 503 `{"error":"proxy not configured"}`; logs the variable's name and which (missing or malformed), never its value | none |
| Upstream unreachable (fetch throws) | 502 `{"error":"backend unreachable"}`, logged | attempted |
| The browser went away first (its signal aborted) | 502, not logged: no backend failed | aborted |

The proxy never sends an unsigned request.

## 3. Browser calls

Browser code calls `/api/backend/...` on its own origin and never the backend's:

- `useDebate` → `GET /api/backend/debates/{id}`; `useCreateDebate` → `POST /api/backend/debates`;
- `useDebateStream` → `new EventSource("/api/backend/debates/{id}/stream")`. `EventSource` cannot
  send headers, so the stream must go through the proxy; `Last-Event-ID` passes both ways;
- `BackendStatus` → `GET /api/backend/health`. `/health` is exempt and could stay direct, but it
  goes through the proxy so the pill reports the path every other call takes: a direct probe
  would say "backend OK" while a missing key made every debate fail. It also removes the last
  cross-origin browser call.

There are no server-side backend calls today (pages fetch nothing from the backend; the debate
pages are client islands). A future RSC, server action or route handler must call the backend
directly with a freshly minted token, not hop through its own proxy.

`robots.txt` now disallows `/api/` (spec 04): the proxy is a machine endpoint.

## 4. Bundle boundary

The private key's variable name and the minting code never reach a client bundle. After
`pnpm build`, `.next/static` contains neither `PAPER_TRAIL_FRONTEND_SIGNING_KEY_PRIVATE` nor
`createPrivateKey`; CI's build job greps for both and fails if either is found.

## 5. End to end

With the proxy, the browser calls the frontend's own origin and the upstream fetch runs in the
Next server, where `page.route` cannot reach. The suite stays hermetic this way:

- `playwright.config.ts` generates a throwaway Ed25519 pair when it loads (workers inherit it
  through the environment) and starts `next dev` with that private key and with
  `NEXT_PUBLIC_API_URL` pointed at a local mock backend. It never reuses a running server: one
  started by hand could hold a real key and the real backend's URL.
- `tests/e2e/global-setup.ts` starts the mock backend (`tests/e2e/fixtures/mock-backend.ts`, a
  Node `http` server on `127.0.0.1:3502` unless `E2E_MOCK_BACKEND_PORT` says otherwise). Like the
  real backend it answers 401 to a missing or invalid token outside `/health`, verifying each with
  the throwaway public key, and it records what it received for the test to inspect.
- The UI specs (spec 03, spec 04) mock `**/api/backend/**` in the browser, as before.
- One composed spec, `tests/e2e/proxy.spec.ts`, mocks nothing in the browser.
- Live mode (`E2E_LIVE=1`) starts no mock and keeps the environment's backend URL and key.

## Test cases

Unit tests: `tests/lib/server/` and `tests/app/api/backend/route.test.ts` (Node environment, a
stubbed `fetch` standing in for the backend, keys generated per run); browser-side cases in
`tests/lib/api.test.tsx`, `tests/lib/sse.test.ts`, `tests/components/BackendStatus.test.tsx`;
E2E in `tests/e2e/proxy.spec.ts`.

### Pass cases

- **P1** `base64url` matches RFC 4648 §10 vectors without padding and uses `-` and `_`.
- **P2** the token header is exactly the one in §1.
- **P3** the claims for a given `now`: `iss`, `aud`, `sub`, `role`, `service`, `iat = floor(now / 1000)`,
  `exp = iat + 60`, the given `jti`, in that order; `iss` is `"paper-trail-frontend"` and `aud` the
  single string `"paper-trail"`.
- **P4** the signing input is `base64url(JSON(header)) "." base64url(JSON(claims))`.
- **P5** a minted token has three parts; its signature verifies with `node:crypto` against the
  public key in the backend's format (SPKI DER, base64); header and claims decode to P2 and P3.
- **P6** two mints carry different `jti`s; each lives exactly 60 s.
- **P7** the key loads from PKCS#8 DER base64, also wrapped in a BOM and a trailing CRLF.
- **P8** the path joins onto the backend base (with or without a base path) and the query string
  is kept.
- **P9** request headers: the four allowlisted ones are copied, `x-platform-token` is set,
  `x-forwarded-for` comes from `x-forwarded-for`, else `x-real-ip`, else is absent.
- **P10** response headers: only the five allowlisted ones are copied.
- **P11** `GET` through the route reaches `${NEXT_PUBLIC_API_URL}/<path>?<query>` with a token that
  verifies against the public key, the allowlisted headers, `cache: "no-store"`,
  `redirect: "manual"` and the request's own signal; the status and body come back.
- **P12** `POST`, `PUT`, `PATCH` and `DELETE` forward their method and body byte for byte.
- **P13** SSE: the first event reaches the client while the upstream stream is still open, with
  `content-type: text/event-stream`; `last-event-id` is forwarded upstream and back.
- **P14** an upstream redirect comes back as a redirect, without its `location`.
- **P15** the route exports `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `runtime = "nodejs"`,
  `dynamic = "force-dynamic"` and `maxDuration = 300`.
- **P16** `useDebate` and `useCreateDebate` fetch `/api/backend/debates…`; `useDebateStream` opens
  `/api/backend/debates/{id}/stream`; `BackendStatus` pings `/api/backend/health`.
- **P17** (E2E, composed, no browser mocks) claim → debate page → stream → verdict → transcript
  through the real proxy and the mock backend. The first `state` event renders ("streaming")
  while the mock holds the stream open, and the verdict only after it is released. Every request
  the backend saw carried a token that verifies against the test's public key with the claims of
  §1; none carried the browser's cookie or `authorization`; each carried the visitor's
  `x-forwarded-for`.

### Failure cases (negative space)

- **F1** a missing key (unset, empty, whitespace) is reported as missing.
- **F2** a malformed key is reported as malformed: non-base64 characters, an inner line break, a
  length that is not a multiple of 4, base64 of junk bytes, an SPKI public key, an RSA key, an
  X25519 key.
- **F3** a token does not verify against another key, nor after its claims are altered.
- **F4** the path guard refuses: no segments, an empty segment, `.`, `..`, a backslash, a slash
  inside a segment, `%2e%2e`, `..%2f`, `%2F`, `%252e%252e`, `https:`, `//evil.com`, `evil.com@`,
  a space, a NUL byte, a non-ASCII character; a query string that does not start with `?`; and a
  result off the backend's origin.
- **F5** request headers never carry `cookie`, `authorization`, `origin`, `referer`, `host` or the
  browser's own `x-platform-token`.
- **F6** response headers never carry `set-cookie`, `location`, `content-length`,
  `content-encoding`, `server` or `x-powered-by`.
- **F7** through the route, each path in F4 answers 400 `{"error":"invalid path"}` and the
  backend is never called.
- **F8** a missing key answers 503 `{"error":"proxy not configured"}`; the backend is never called;
  the log names the variable.
- **F9** a malformed key answers 503 the same way, and the log never contains the key's value.
- **F10** an unreachable backend (fetch rejects) answers 502 `{"error":"backend unreachable"}`
  and is logged; a fetch aborted because the browser left first is not logged.
- **F11** (E2E) a traversal path sent to the running server never reaches the mock backend.
- **F12** (build) `.next/static` contains neither the key's variable name nor `createPrivateKey`.
- **F13** (contract v2) a minted token's `aud` is a string, never an array, and names no other
  service; its `iss` is never `"bastion"`. The E2E mock backend, like the real one, answers 401 to a
  token whose `iss` or `aud` is wrong or missing.
