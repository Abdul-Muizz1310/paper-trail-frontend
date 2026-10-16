# Spec 04 — Site metadata

## Scope

What a browser tab, a search result, a home-screen install and a link preview see. One validated
config drives the root `<head>`, the icons, the web manifest, `robots.txt`, `sitemap.xml` and a
1200×630 share card.

| Piece | File |
|---|---|
| Config (parsed when it loads) | `src/lib/site/config.ts`, `src/lib/site/define.ts` |
| Root metadata, viewport, manifest, robots, sitemap | `src/lib/site/metadata.ts` |
| Share card | `src/lib/site/share-card.tsx`, `src/lib/site/assets.ts`, `src/app/opengraph-image.tsx` |
| Metadata routes | `src/app/manifest.ts`, `src/app/robots.ts`, `src/app/sitemap.ts` |
| Icons | `src/app/icon.svg`, `src/app/favicon.ico`, `src/app/apple-icon.png`, `public/icon-*.png` |

## 1. One config, parsed when it loads

`src/lib/site/config.ts` defines the site once: the brand name, the default title, the
description, the production origin, the accent, keywords, the share card's copy, and which routes
are public (listed in the sitemap) or private (disallowed in robots.txt). Everything below is
derived from it.

The production origin is `https://paper-trail-frontend-sable.vercel.app`. The plain
`paper-trail-frontend.vercel.app` belongs to a stranger and is on the never-use list.

`defineSite` parses the config when the module loads and throws a `SiteConfigError` on:
- a `url` that is not a URL, is not `https:`, or is not a bare origin (a path or a trailing
  slash);
- a host on the never-use list (`knowledge/infrastructure/infra-never-use-hosts.md` in the
  workspace): strangers own those hosts, and a link preview must never point at one;
- a name longer than 12 characters (the manifest's `short_name`), a title longer than 70, or a
  description outside 50 to 160 characters (search results cut longer ones);
- an accent that is not `#rrggbb`;
- a highlight that does not occur in the headline;
- a route that does not start with `/`, or a sitemap route under a disallowed prefix.

A bad config fails the build. It never ships into every link preview.

## 2. The head

The root layout exports `metadata` and `viewport` built from the config:
- `metadataBase` is the production origin, so every image URL is absolute;
- the title has a default (`paper-trail — live AI debate`) and the template `%s — paper-trail`;
- description, application name, author, keywords, and `formatDetection` off (iOS must not turn
  numbers on a page into phone links);
- Open Graph: `type: website`, the site name and the locale. It has **no** title, description or
  url: Next fills `og:title` and `og:description` from each page's own, and a root `og:url` would
  claim that every page is the home page;
- `twitter:card` is `summary_large_image`. Next fills the Twitter title, description and image
  from Open Graph, so there is no separate `twitter-image`;
- no canonical at the root, for the same reason as `og:url`. The home page sets its own (`/`);
- viewport: `theme-color` `#0a0a0a` and `color-scheme: dark`.

No page other than the home canonical sets `openGraph`, `twitter` or `alternates.canonical`: a
page-level `openGraph` replaces the root one and drops the share image.

### Page titles

| Route | Title | Indexed |
|---|---|---|
| `/` | `paper-trail — live AI debate` (the default) | yes |
| `/debates/[id]` | `debate <first 8 of id> — paper-trail` | no |
| `/debates/[id]/transcript` | `transcript <first 8 of id> — paper-trail` | no |

The debate pages are Server Components (the client islands are `DebateView` and
`TranscriptClient`), so each exports `generateMetadata` built from the id alone. It never fetches
the debate: the title must not wait on the backend, and must not leak the claim.

## 3. Icons

The icon is the nav's brand tile: the Terminal glyph in `--accent-cyan` (`#22d3ee`) on the surface
colour, with a faint accent glow. `src/app/icon.svg` is the source. The rasters are rendered from
it:
- `src/app/favicon.ico`: 16, 32 and 48 px (replaces the stock Next favicon);
- `src/app/apple-icon.png`: 180 px, full-bleed, because iOS rounds the corners itself;
- `public/icon-192.png` and `public/icon-512.png` for the manifest, plus
  `public/icon-maskable-512.png`, with the glyph inside the maskable safe zone.

## 4. Manifest, robots, sitemap

- `manifest.webmanifest`: name, short name, description, `start_url` and `scope` `/`,
  `display: standalone`, dark background and theme colours, the three PNG icons.
- `robots.txt`: allow `/`, disallow only machine endpoints (paper-trail has none: the API lives
  on the backend's own host), point at the sitemap. Link-preview bots such as Twitterbot obey
  robots.txt, so disallowing a page would also break its link preview.
- A page that must stay out of search sets `robots: { index: false }` instead: `/debates/[id]`
  and its transcript, because each is a generated debate on a user's claim. They still get a
  preview when shared.
- `sitemap.xml`: absolute URLs of the sitemap routes (`/` only).

## 5. The share card

`opengraph-image` is a 1200×630 PNG rendered at build time with `next/og`: the brand tile, the
name, the `//` comment line (`a live multi-agent debater`), the headline
(`watch AI argue with itself.`) with the highlight (`argue`) in the accent and underlined, and the
live host. It is set in Geist Mono, vendored as subset TTFs under `src/lib/site/fonts/` with its
OFL licence, because `next/og` cannot read the fonts `next/font` loads.

The headline is set at the largest size, from 96 px down to 48 px in steps of 8, at which it wraps
to at most two lines across the card's 1056 px. Every Geist Mono glyph is 0.6 em wide, so the wrap
is computed exactly, not measured. paper-trail's headline fits at 96 px: `watch AI argue` /
`with itself.` in 18 columns.

## Test cases (S3 red tests)

Unit tests live in `tests/lib/site/`; the E2E cases in `tests/e2e/metadata.spec.ts`.

### Pass cases

- **P1** `defineSite` accepts the real config and derives its origin
  (`https://paper-trail-frontend-sable.vercel.app/`).
- **P2** the root metadata: `metadataBase`, the title template `%s — paper-trail`, description,
  author, Open Graph with no title, description or url, the Twitter card, no `alternates`.
- **P3** the viewport colours.
- **P4** the manifest's fields, and every icon it lists exists in `public/` at its declared size.
- **P5** robots.txt allows the site and names the sitemap on the origin; the sitemap lists `/` as
  an absolute URL, once.
- **P6** the icon files: `icon.svg` uses the accent, `favicon.ico` holds 16, 32 and 48,
  `apple-icon.png` is 180×180.
- **P7** the headline layout: highlight segments, the greedy wrap, the size chosen at each
  boundary (96 px for the real headline), and the share card's alt text
  (`paper-trail — watch AI argue with itself.`).
- **P8** page metadata: the home page's canonical is `/`; `/debates/[id]` is titled
  `debate <id8>` and its transcript `transcript <id8>`, both `noindex`, neither setting
  `openGraph`, `twitter` or a canonical.
- **P9** (E2E) the home page carries the title, description, `og:image`, the Twitter card, the
  theme colour, the icons and the manifest, and has no `robots` meta. The suite runs on
  `next dev` (spec 03), and `next dev` points file-based social images at the local server on
  purpose (`getSocialImageMetadataBaseFallback` in `next/dist/lib/metadata/resolvers/resolve-url.js`),
  so the image is expected on the server under test there and on the production origin against
  a built app. The production origin itself is pinned by P2's `metadataBase`.
- **P10** (E2E, backend mocked with `page.route`) a debate page's own title flows into
  `og:title`, and the page is `noindex`.
- **P11** (E2E) every metadata route answers 200 with its content type.

### Failure cases (negative space)

- **F1** `defineSite` rejects each case in §1, naming the reason — including every never-use
  host.
- **F2** `defineSite` rejects the stranger's `https://paper-trail-frontend.vercel.app` (the plain
  host, without `-sable`).
