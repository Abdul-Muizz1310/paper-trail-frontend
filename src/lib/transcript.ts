/**
 * Backend v0.1.0 renders the judge's reasoning ONLY inside the
 * `transcript_md` field, not as a separate round. This helper pulls
 * the `## Verdict` / `## Judgment` / `## Reasoning` section out of
 * the transcript so we can show it in the JudgeVerdict card.
 *
 * If no recognisable section is present, returns undefined and the
 * card shows verdict + confidence without a reasoning block.
 */
export function extractJudgeReasoning(transcript: string | null): string | undefined {
  if (!transcript) return undefined;

  // Match any heading that looks like a verdict/judgment/reasoning
  // section and grab everything up to the next `## ` heading or EOF.
  const re =
    /^##\s*(Verdict|Judgment|Judgement|Reasoning|Decision)\b[^\n]*\n([\s\S]*?)(?=\n##\s|$)/im;
  const m = transcript.match(re);
  if (!m) return undefined;
  const body = m[2].trim();
  return body.length > 0 ? body : undefined;
}
