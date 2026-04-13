# Why paper-trail-frontend?

## The obvious version

The obvious version of an AI-powered fact-checker is a chat interface: type a claim, get a paragraph back, trust it or don't. There's no adversary, no rebuttal, no judge — just a single confident voice. That's the shape of every "ask AI" product, and it's the shape that makes hallucinations invisible, because a wrong answer delivered fluently looks exactly like a right one.

## Why I built it differently

**paper-trail** flips the single-voice model: a claim enters, two agents argue it out with citations, a third agent judges, and the user watches the whole thing unfold. This frontend is the surface that makes that adversarial structure legible. The debate happens on the backend as a LangGraph state machine, but it only becomes *believable* when you can see the agents disagree in real time. That meant five non-negotiable design decisions: **streaming-first UI** — SSE events land as they're produced, no loading spinners hiding a 30-second wall of text, because if reasoning is live then skepticism stays live; **two-panel arena** — pro and con visually occupy equal space so neither side gets a layout advantage; **evidence-forward cards** — each agent claim links back to a source so the reader can always ask "according to whom?"; **judge verdict as a first-class artifact** — not buried at the bottom but surfaced with confidence score, reasoning, and the specific turns that swayed it; and **permanent transcripts** — a debate is a receipt (hence "paper trail"), linkable at `/debates/:id/transcript` so anyone can see exactly what happened. The frontend's job is to make the adversarial structure feel *inevitable* — to teach the user, by showing, that a single AI voice is not the only shape an answer can take.

## What I'd change if I did it again

I'd replace the plain textarea for claim input with a Monaco editor instance — claims worth debating are often nuanced and multi-sentence, and syntax highlighting, line numbers, and bracket matching would make editing longer claims far less painful. I'd also add offline transcript generation: right now transcripts only exist as server-rendered pages, but a "download as PDF" or "export as Markdown" option would let users archive debates locally without depending on the service staying online. Debates are the artifact; they should be portable.
