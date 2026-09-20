/**
 * A determinate progress / usage meter.
 *
 * Built for the usage meters Phase 6 needs, so it carries the thing a plain
 * bar usually gets wrong: it states its own numbers to assistive technology
 * via the ARIA range attributes, rather than relying on a sighted-only visual.
 *
 * The bar changes colour as it fills — neutral, then warning past 75%, then
 * error past 90%. Colour is never the only signal: `label` and `hint` carry
 * the same information in text, so this still reads correctly for someone who
 * cannot distinguish the two.
 */
export function Progress({
  value,
  max,
  label,
  hint,
  showValue = true,
}: {
  value: number;
  max: number;
  label: string;
  hint?: string;
  showValue?: boolean;
}) {
  // A quota that has been exceeded (value > max) must still render a bar that
  // fits, and a max of 0 must not produce NaN.
  const ratio = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;
  const pct = Math.round(ratio * 100);

  const tone =
    ratio >= 0.9
      ? 'bg-status-error'
      : ratio >= 0.75
        ? 'bg-status-warning'
        : 'bg-brand';

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="font-medium text-fg-secondary">{label}</span>
        {showValue ? (
          <span className="font-mono tabular-nums text-fg-muted">
            {value.toLocaleString()} / {max.toLocaleString()}
          </span>
        ) : null}
      </div>
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
        className="h-1.5 w-full overflow-hidden rounded-full bg-n2"
      >
        {/* Animating width would trigger layout on every frame. scaleX is a
            compositor-only transform, and transform-origin keeps it growing
            from the left rather than the centre. */}
        <div
          className={`h-full w-full origin-left rounded-full transition-transform duration-standard ease-snap motion-reduce:transition-none ${tone}`}
          style={{ transform: `scaleX(${ratio})` }}
        />
      </div>
      {hint ? <p className="text-[11px] text-fg-faint">{hint}</p> : null}
    </div>
  );
}
