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
      className="flex items-center gap-3"
    >
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          data-testid="confidence-fill"
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: pct }}
        />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">{label ?? pct}</span>
    </div>
  );
}
