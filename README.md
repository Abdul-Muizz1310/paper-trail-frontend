# paper-trail-frontend

Next.js (App Router) UI for **paper-trail** — a LangGraph multi-agent debater that takes a claim, runs pro/con agents, a judge, and streams the transcript live.

Backend: [`paper-trail-backend`](https://github.com/Abdul-Muizz1310/paper-trail-backend) — deployed at `https://paper-trail-backend-7h27.onrender.com`.

## Stack

- Next.js 16 (App Router, RSC, React 19)
- TypeScript (strict)
- Tailwind v4 + shadcn/ui
- TanStack Query + Zustand
- Framer Motion
- Vitest + Testing Library + Playwright
- Biome (lint + format)

## Development

```bash
pnpm install
cp .env.example .env.local   # edit if backend URL differs
pnpm dev
```

Open http://localhost:3000.

## Environment

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | FastAPI backend base URL (SSE + REST) |
| `NEXT_PUBLIC_SITE_URL` | Public canonical URL (OG tags, absolute links) |

Validated at import time in [`src/lib/env.ts`](src/lib/env.ts) via zod.

## Scripts

- `pnpm dev` — Next.js dev server
- `pnpm build` — production build
- `pnpm test` — Vitest unit tests
- `pnpm test:e2e` — Playwright
- `pnpm lint` — Biome check
- `pnpm format` — Biome write

## License

MIT — see [LICENSE](LICENSE).
