export type ConfidenceBarProps = {
  value: number;
  label?: string;
};

export function ConfidenceBar({ value, label }: ConfidenceBarProps) {
  const isValid = Number.isFinite(value);
  const clamped = isValid ? Math.min(1, Math.max(0, value)) : 0;
  const pct = `${Math.round(clamped * 100)}%`;

  return (
    <div
      data-testid="confidence-bar"
      aria-invalid={!isValid}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={isValid ? clamped : undefined}
      className="flex items-center gap-3 font-mono text-xs"
    >
      <span className="text-fg-faint">confidence</span>
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full border border-border bg-background">
        <div
          data-testid="confidence-fill"
          className="h-full rounded-full bg-gradient-to-r from-accent-cyan to-accent-blue shadow-[0_0_12px_rgb(34_211_238_/_0.6)] transition-[width] duration-700 ease-out"
          style={{ width: pct }}
        />
      </div>
      <span className="tabular-nums text-accent-cyan">{label ?? pct}</span>
    </div>
  );
}
