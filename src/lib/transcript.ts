/**
 * Backend v0.1.1 renders a `## Reasoning` section in `transcript_md`
 * containing the judge's full reasoning paragraph. Older backends
 * (pre-2026-04-10) only emit `## Verdict` with bullet points, so we
 * fall back to that for backwards compat.
 *
 * The returned string is passed directly to ReactMarkdown.
 */
export function extractJudgeReasoning(transcript: string | null): string | undefined {
  if (!transcript) return undefined;

  // Prefer the dedicated Reasoning section — it's a real paragraph.
  const reasoning = matchSection(transcript, /Reasoning|Judgment|Judgement|Decision/);
  if (reasoning) return reasoning;

  // Fall back to the Verdict section (older backends put a few
  // bullet points here). Strip the leading "- Verdict: ..." /
  // "- Confidence: ..." bullets so only real prose remains.
  const verdict = matchSection(transcript, /Verdict/);
  if (!verdict) return undefined;
  const lines = verdict
    .split(/\r?\n/)
    .filter((line) => !/^\s*-\s*(Verdict|Confidence)\b/i.test(line))
    .join("\n")
    .trim();
  return lines.length > 0 ? lines : undefined;
}

function matchSection(transcript: string, kind: RegExp): string | undefined {
  const re = new RegExp(`^##\\s*(?:${kind.source})\\b[^\\n]*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, "im");
  const m = transcript.match(re);
  if (!m) return undefined;
  const body = m[1].trim();
  return body.length > 0 ? body : undefined;
}
