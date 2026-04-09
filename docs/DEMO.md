# Demo script

Target audience: a technical interviewer. Total runtime: ~3 minutes.

## Setup (before the call)

1. Backend is live at `https://paper-trail-backend-7h27.onrender.com/health` — open in a tab, confirm `{"status":"ok"}`.
2. Frontend is live at the Vercel URL (production).
3. Have one "good" claim queued: **"Remote work reduces software engineering productivity."**
4. Have one "hostile" claim queued: **"The Eiffel Tower is in Berlin."** (tests the judge's handling of factual claims).

## Walkthrough

1. **Open the home page.** Point out: no login, no paywall, single input. "The product is: a claim in, a receipt out."
2. **Enter the good claim, submit.** Watch the arena populate live. Narrate:
   - "Pro and con agents both start writing at the same time — this is two SSE streams multiplexed."
   - "Notice the evidence cards — each claim links back to a source the agent retrieved."
3. **Let the judge verdict appear.** Point at the confidence bar. "The judge is a separate LangGraph node — it only fires once both debaters finish, and it's forced into JSON mode so the verdict is always structured."
4. **Click through to the transcript.** "Every debate is a permanent artifact — this is the paper trail. You could link a skeptic here and they'd see exactly what each agent said, in order."
5. **Back, enter the hostile claim.** Show how the judge catches the factual error even when one agent tries to defend it. "This is why adversarial structure matters — a single-agent system would just confidently agree."

## Fallbacks

- If SSE disconnects mid-demo: refresh; the debate ID is in the URL, the transcript page pulls the completed state from Postgres.
- If the backend is cold (Render free tier): first request takes ~20s. Have a cached debate ID ready and open `/debates/:id/transcript` directly.
