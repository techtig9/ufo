import { Panel } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { BudgetStatus } from '@/lib/ai/budget';

const usd = (n: number) =>
  n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

/**
 * AI spend against the cap.
 *
 * States it is careful to distinguish, because an operator glancing at this
 * needs to know which one they are in:
 *
 *   kill switch on   nothing is being generated, deliberately
 *   over budget      generation is paused by the cap
 *   no cap set       spend is unlimited — said loudly, because "no warning"
 *                    and "no protection" look identical otherwise
 *   unknown          the figure could not be computed; the cap is failing
 *                    OPEN right now, which the operator must know
 */
export function BudgetPanel({ status }: { status: BudgetStatus }) {
  return (
    <Panel>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">AI spend this month (estimated)</h2>
        {status.killSwitch ? (
          <Badge>AI_DISABLED — generation is off</Badge>
        ) : status.overBudget ? (
          <Badge>Over budget — generation paused</Badge>
        ) : null}
      </div>

      {status.unknown ? (
        <p className="mt-3 text-sm text-status-warning">
          Spend could not be read from <code className="font-mono text-xs">ai_requests</code>. The
          cap is <strong>failing open</strong> — generation is allowed. Set{' '}
          <code className="font-mono text-xs">AI_DISABLED=1</code> to stop it immediately; that
          switch does not depend on the database.
        </p>
      ) : status.budgetUsd === null ? (
        <>
          <p className="mt-3 font-display text-2xl font-semibold">{usd(status.spentUsd)}</p>
          <p className="mt-2 text-xs text-fg-muted">
            No cap is set, so spend is unlimited. Set{' '}
            <code className="font-mono">AI_MONTHLY_BUDGET_USD</code> to pause generation
            automatically past a ceiling.
          </p>
        </>
      ) : (
        <div className="mt-4">
          <Progress
            value={Math.round(status.spentUsd * 100) / 100}
            max={status.budgetUsd}
            label={`${usd(status.spentUsd)} of ${usd(status.budgetUsd)}`}
            showValue={false}
            hint={
              status.overBudget
                ? 'Generation is paused until the cap is raised or the month rolls over.'
                : `${Math.round((1 - status.ratio) * 100)}% of this month's budget remains.`
            }
          />
        </div>
      )}

      <p className="mt-4 border-t border-edge pt-3 text-[11px] leading-4 text-fg-faint">
        Estimated from logged token counts and the rate table in{' '}
        <code className="font-mono">lib/ai/cost.ts</code> — <strong>not</strong> from a provider
        invoice. Provider pricing changes without telling your codebase, so treat this as a smoke
        alarm and reconcile against the real bill. Unrecognised models are billed at the most
        expensive known rate, so the figure errs high rather than low.
      </p>
    </Panel>
  );
}
