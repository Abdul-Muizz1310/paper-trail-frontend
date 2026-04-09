# Spec 02 — Components

## Scope

Seven presentational components under `src/components/`. All typed with explicit `Props` interfaces, all stateless (state lives in Zustand / TanStack Query), all must render the three standard phases: **loading**, **error**, **content**.

| Component | File | Purpose |
|---|---|---|
| `ClaimInput` | `ClaimInput.tsx` | Home page input form; calls `POST /debates`; validates + submits |
| `DebateArena` | `DebateArena.tsx` | Two-panel (pro/con) layout shell; renders two `AgentPanel`s side-by-side |
| `AgentPanel` | `AgentPanel.tsx` | One side of the arena; renders that agent's rounds as an ordered list of `EvidenceCard`s |
| `ConfidenceBar` | `ConfidenceBar.tsx` | Horizontal bar, 0–1, with numeric label; used inside `JudgeVerdict` |
| `EvidenceCard` | `EvidenceCard.tsx` | A single round's claim + sources; markdown content |
| `JudgeVerdict` | `JudgeVerdict.tsx` | Final verdict badge (`TRUE`/`FALSE`/`INCONCLUSIVE`) + confidence + reasoning |
| `TranscriptView` | `TranscriptView.tsx` | Full markdown transcript, rendered with `react-markdown` + `remark-gfm` |

## Shared wire type (maps from `DebateOut`)

```ts
// src/lib/schemas.ts — zod-validated
type Round = {
  index: number;
  side: "pro" | "con" | "judge";
  claim: string;         // short summary
  body_md: string;       // full markdown (rendered inside EvidenceCard)
  evidence: { title: string; url: string; quote?: string }[];
};

type Debate = {
  id: string;
  claim: string;
  status: "pending" | "running" | "done" | "failed" | "error";
  verdict: "TRUE" | "FALSE" | "INCONCLUSIVE" | null;
  confidence: number | null;
  rounds: Round[];
  transcript_md: string | null;
  created_at: string;
};
```

The backend currently types `rounds: list[dict[str, Any]]`. The frontend zod schema is the frontend's source of truth; unexpected keys are preserved but ignored, missing required keys cause the round to be dropped with a console warning (NOT a page crash).

## Component contracts

### `ClaimInput`

```ts
type Props = {
  onSubmit: (claim: string, maxRounds: number) => Promise<void>;
  isPending: boolean;
  error?: string | null;
  defaultClaim?: string;
};
```

- Text input bound to local state, reset only on successful submit.
- Max-rounds control hidden behind a collapsible "Advanced" disclosure; default 5.
- Disabled during `isPending`; shows a spinner on the submit button.

### `DebateArena`

```ts
type Props = {
  pro: Round[];
  con: Round[];
  phase: "loading" | "streaming" | "done" | "error";
  errorMessage?: string;
};
```

### `AgentPanel`

```ts
type Props = {
  side: "pro" | "con";
  rounds: Round[];
  isActive: boolean;  // pulse while this side is being generated
};
```

### `ConfidenceBar`

```ts
type Props = { value: number; label?: string };  // value in [0, 1]
```

### `EvidenceCard`

```ts
type Props = { round: Round; compact?: boolean };
```

### `JudgeVerdict`

```ts
type Props = {
  verdict: "TRUE" | "FALSE" | "INCONCLUSIVE";
  confidence: number;
  reasoning?: string;  // pulled from the `judge` round's body_md
};
```

### `TranscriptView`

```ts
type Props = { markdown: string };
```

## Test cases (S3 red tests)

Each component has one test file under `tests/components/`. Every component tests all three phases plus one negative-space case.

### `ClaimInput`
- **P1** Renders a textbox with accessible label "claim".
- **P2** Typing + submitting calls `onSubmit` with the exact string.
- **F1** Empty string submit does NOT call `onSubmit` and shows an inline error.
- **F2** `error="foo"` prop renders the error visibly with `role="alert"`.
- **F3** `isPending=true` disables the submit button and the input (typing nothing changes).

### `DebateArena`
- **P1** With `phase="streaming"` and two rounds per side, renders 4 `EvidenceCard`s in two columns.
- **P2** With `phase="loading"`, renders skeletons in both columns.
- **F1** With `phase="error"` and `errorMessage`, shows the error (`role="alert"`) and no arena columns.

### `AgentPanel`
- **P1** `side="pro"`, two rounds → renders them in order by `round.index`.
- **F1** Rounds whose `side` doesn't match the panel's `side` are filtered out (defensive — caller is supposed to pre-filter but the panel must not mis-render).

### `ConfidenceBar`
- **P1** `value=0.75` renders a bar visually at 75% width (assert inline style).
- **P2** `value=0` and `value=1` both render without overflow.
- **F1** `value=-0.3` is clamped to 0; `value=1.7` is clamped to 1. No crash.
- **F2** `NaN` renders with `aria-invalid="true"` and 0% width.

### `EvidenceCard`
- **P1** Renders `round.body_md` through react-markdown (headings become `<h*>`).
- **P2** Evidence items render as a list with external links (`target="_blank"`, `rel="noopener noreferrer"`).
- **F1** `round.evidence=[]` renders the body but omits the evidence section entirely (no empty "Sources" header).

### `JudgeVerdict`
- **P1** `verdict="TRUE"` uses the positive variant styling (assert via `data-variant="true"` or similar stable attribute — never CSS classnames directly).
- **P2** Includes a `<ConfidenceBar>` bound to `confidence`.
- **F1** `confidence=0.0` still renders the bar (doesn't short-circuit to null).

### `TranscriptView`
- **P1** Markdown headings render as semantic `<h1>..<h6>`.
- **P2** GFM tables render (smoke via `remark-gfm`).
- **F1** Empty string renders an empty-state message, not a crash.
- **F2** Script tags in the markdown are NOT executed (react-markdown's default — assert absence of `<script>` in the DOM).
