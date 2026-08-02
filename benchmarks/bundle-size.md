# Bundle size

A real, reproducible measurement of the production client-side JavaScript/CSS
this app ships -- not an estimate. Regenerate it any time with the commands
below; do not hand-edit the numbers.

## How to reproduce

```bash
NEXT_PUBLIC_API_URL=https://paper-trail-backend-jjpf.onrender.com \
NEXT_PUBLIC_SITE_URL=https://paper-trail-frontend-sable.vercel.app \
pnpm build

# Shared chunks loaded on every route (from .next/build-manifest.json's
# rootMainFiles + polyfillFiles):
for f in $(node -e "const m=require('./.next/build-manifest.json'); console.log([...m.rootMainFiles, ...m.polyfillFiles].join(' '))"); do
  path=".next/$f"
  echo "$f raw=$(wc -c < "$path") gzip=$(gzip -c "$path" | wc -c)"
done

# All static JS/CSS chunks (every route combined):
find .next/static/chunks -type f -name '*.js'  -exec cat {} + | wc -c   # raw JS
find .next/static/chunks -type f -name '*.js'  -exec gzip -c {} \; | wc -c  # (sum per-file gzip, see below)
find .next/static/chunks -type f -name '*.css' -exec cat {} + | wc -c   # raw CSS
```

## Measured (2026-08-02)

- Toolchain: Next.js 16.2.3 (Turbopack production build), Node v24.12.0, pnpm 10.33.0.
- Build: `next build` (Turbopack), clean `.next/` output, static export of `/` and
  `/_not-found`, on-demand render of `/debates/[id]` and `/debates/[id]/transcript`.

### Shared "First Load" chunks (loaded on every route)

The 6 files `.next/build-manifest.json` marks as `rootMainFiles` + `polyfillFiles`
(the framework/runtime bundle every page pays for, regardless of route):

| File | Raw bytes | Gzip bytes |
|---|---:|---:|
| `03~yq9q893hmn.js` (polyfill) | 112,594 | 39,496 |
| `0fe~--xqljxjj.js` | 23,841 | 7,506 |
| `10nw5rp8ak_7z.js` | 44,415 | 9,254 |
| `0u_1zf_l56t4u.js` | 227,540 | 70,918 |
| `16dpb4i3me82m.js` | 149,525 | 40,181 |
| `turbopack-0t142kpt-po.h.js` | 10,580 | 4,184 |
| **Total** | **568,495 B (555.2 KB)** | **171,539 B (167.5 KB)** |

### All static chunks (every route's code combined)

| Asset type | Files | Raw bytes | Gzip bytes |
|---|---:|---:|---:|
| JS (`.next/static/chunks/*.js`) | 16 | 1,626,818 B (1,588.7 KB) | 455,375 B (444.7 KB) |
| CSS (`.next/static/chunks/*.css`) | 1 | 53,742 B (52.5 KB) | 10,054 B (9.8 KB) |

Filenames are content-hashed by Turbopack and will change on the next build even
with no code changes to measure against; re-run the reproduce commands above to
get current names before comparing across builds.

## Why this metric

Bundle size is the cheapest defensible performance claim a frontend can make
without a hosted Lighthouse/CI run: it needs no live backend (Render is
currently billing-suspended -- see `tests/smoke.test.ts`), no browser, and no
network access -- just a local production build and `wc`/`gzip`, both run in
this session against a real build.
