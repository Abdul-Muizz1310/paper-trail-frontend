# Why paper-trail-frontend

Most "AI answers" arrive as a single paragraph you either trust or don't. There's no adversary, no rebuttal, no judge — just a confident voice. **paper-trail** flips that: a claim enters, two agents argue it out with citations, a third agent judges, and the user watches the whole thing unfold.

This repo is the surface that makes that legible. The debate happens on the backend as a LangGraph state machine, but it only becomes *believable* when you can see the agents disagree in real time. That means:

- **Streaming-first UI.** SSE events land as they're produced — no loading spinners hiding a 30-second wall of text. If reasoning is live, skepticism stays live.
- **Two-panel arena.** Pro and con visually occupy equal space. Neither side gets a home-field advantage from layout.
- **Evidence-forward cards.** Each agent claim links back to a source. The reader can always ask "according to whom?"
- **Judge verdict as a first-class artifact.** Not buried at the bottom — surfaced with confidence score, reasoning, and the specific turns that swayed it.
- **Transcripts are permanent.** A debate is a receipt, hence "paper trail." You can link someone to `/debates/:id/transcript` and they see exactly what happened.

The frontend's job is to make the adversarial structure of the backend feel *inevitable* — to teach the user, by showing, that a single AI voice is not the only shape an answer can take.
