import Link from 'next/link';
import { Panel } from '@/components/ui/panel';
import { Progress } from '@/components/ui/progress';
import { PLAN_MONTHLY_CREDITS, CREDIT_COSTS } from '@/lib/credits';
import type { Plan } from '@/lib/types';

const NEXT_PLAN: Record<Plan, Plan | null> = {
  free: 'starter',
  starter: 'pro',
  pro: 'business',
  business: null,
};

const PLAN_LABEL: Record<Plan, string> = {
  free: 'Free',
  starter: 'Starter',
  pro: 'Pro',
  business: 'Business',
};

/**
 * The credit meter, and the only place that decides when to suggest upgrading.
 *
 * The bar it replaces animated `width` (which lays out every frame), carried no
 * ARIA at all, and — the part that mattered — said nothing when a user was
 * about to run out. Someone hitting zero mid-generation is the worst possible
 * moment to discover the limit exists.
 *
 * The prompt is deliberately quiet and deliberately late: nothing until 75% of
 * the cycle's credits are spent, and the wording states a fact the user can
 * check ("about 2 more full projects") rather than urgency. A meter that cries
 * wolf at 40% gets ignored by 80%.
 *
 * On Business there is no higher plan, so it offers a top-up instead of a
 * nonexistent upgrade — a dead "Upgrade" link on the top tier is the kind of
 * detail that makes a product feel unmaintained.
 */
export function CreditMeter({
  plan,
  remaining,
  resetAt,
}: {
  plan: Plan;
  remaining: number;
  resetAt?: string | null;
}) {
  const total = PLAN_MONTHLY_CREDITS[plan];
  // A negative balance is possible in principle (a refund racing a spend), and
  // must not render as a bar pointing the wrong way.
  const used = Math.max(0, total - Math.max(0, remaining));
  const ratio = total > 0 ? used / total : 0;

  const projectsLeft = Math.floor(Math.max(0, remaining) / CREDIT_COSTS.generate_full_project);
  const next = NEXT_PLAN[plan];

  const resetLine = resetAt
    ? `Resets ${new Date(resetAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}.`
    : null;

  const exhausted = remaining <= 0;
  const low = ratio >= 0.75;

  return (
    <Panel>
      <Progress
        value={used}
        max={total}
        label={`Credits used this cycle · ${PLAN_LABEL[plan]}`}
        hint={
          [
            exhausted
              ? 'No credits left this cycle.'
              : `${projectsLeft === 0 ? 'Under one' : `About ${projectsLeft}`} more full ${projectsLeft === 1 ? 'project' : 'projects'} at current prices.`,
            resetLine,
          ]
            .filter(Boolean)
            .join(' ') || undefined
        }
      />

      {low ? (
        <div className="mt-4 border-t border-edge pt-3 text-xs">
          {next ? (
            <p className="text-fg-muted">
              {exhausted ? 'You are out of credits.' : 'You are close to the end of this cycle.'}{' '}
              <Link href="/dashboard/billing" className="font-medium text-brand-text hover:underline">
                {PLAN_LABEL[next]} gives you {PLAN_MONTHLY_CREDITS[next].toLocaleString()} credits a month
              </Link>
              , or wait for the reset.
            </p>
          ) : (
            <p className="text-fg-muted">
              {exhausted ? 'You are out of credits.' : 'You are close to the end of this cycle.'}{' '}
              {PLAN_LABEL[plan]} is the largest plan —{' '}
              <Link href="/dashboard/billing" className="font-medium text-brand-text hover:underline">
                top up credits
              </Link>{' '}
              to keep going before the reset.
            </p>
          )}
        </div>
      ) : null}
    </Panel>
  );
}
