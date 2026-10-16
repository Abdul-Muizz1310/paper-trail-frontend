import { defineSite } from "./define";

/** Everything a tab, a search result, an install and a link preview say about paper-trail. */
export const SITE = defineSite({
  name: "paper-trail",
  title: "paper-trail — live AI debate",
  description:
    "Enter a claim. Two AI agents argue it live with citations. A third judges. Every debate is a receipt.",
  url: "https://paper-trail-frontend-sable.vercel.app",
  accent: "#22d3ee",
  keywords: ["fact-checking", "AI debate", "multi-agent", "LangGraph", "citations", "SSE"],
  card: {
    comment: "a live multi-agent debater",
    headline: "watch AI argue with itself.",
    highlight: "argue",
  },
  // Debates are generated from a user's claim: /debates/ pages set noindex instead.
  // /api/ is the backend proxy (spec 05), a machine endpoint.
  routes: { sitemap: ["/"], disallow: ["/api/"] },
});
