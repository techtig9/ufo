import { Panel } from '@/components/ui/panel';

export interface Stat {
  label: string;
  value: string | number;
  hint?: string;
  /** Colours the value when the number itself is the signal. */
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
}

const TONES: Record<NonNullable<Stat['tone']>, string> = {
  neutral: 'text-fg',
  good: 'text-status-success',
  warn: 'text-status-warning',
  bad: 'text-status-error',
};

export function StatGrid({ stats, columns = 4 }: { stats: Stat[]; columns?: 3 | 4 }) {
  return (
    <div className={`grid gap-4 sm:grid-cols-2 ${columns === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}>
      {stats.map((stat) => (
        <Panel key={stat.label} hover={false}>
          <p className="text-sm text-fg-muted">{stat.label}</p>
          <p className={`mt-2 font-display text-3xl font-semibold ${TONES[stat.tone ?? 'neutral']}`}>
            {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
          </p>
          {stat.hint && <p className="mt-1 text-xs text-fg-faint">{stat.hint}</p>}
        </Panel>
      ))}
    </div>
  );
}

/**
 * An empty state that says the table is empty, not that something is broken.
 *
 * These pages read observability tables that are genuinely empty until the
 * feature runs — showing "0" with no explanation reads as a bug, and showing
 * fabricated sample rows would be worse.
 */
export function NoData({ what, because }: { what: string; because: string }) {
  return (
    <Panel hover={false} className="text-center">
      <p className="text-sm text-fg-muted">No {what} recorded yet.</p>
      <p className="mt-1 text-xs text-fg-faint">{because}</p>
    </Panel>
  );
}
