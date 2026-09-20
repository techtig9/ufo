import Link from 'next/link';
import { Logo } from '@/components/ui/logo';

/**
 * The "Made with ufo" badge on a public prototype.
 *
 * Shown on Free-plan shares only. Two reasons, and both matter:
 *
 *  - It is the growth loop. A prototype is shared with clients and
 *    stakeholders — exactly the people who commission design work — so the
 *    badge is seen by the right audience at the moment they are impressed by
 *    the output. It links out, because a wordmark nobody can click is
 *    decoration rather than a channel.
 *  - Removing it is a concrete thing a paid plan buys. A designer sending work
 *    to a client has a real reason not to want another company's name on it,
 *    and "unbranded sharing" is an honest upgrade reason rather than an
 *    artificial limit.
 *
 * The page previously printed "Built with ufo" as plain text on EVERY share,
 * paid included: branding on a paying customer's client-facing work, and not a
 * link, so it was the cost of a badge with none of the benefit.
 */
export function MadeWithBadge() {
  return (
    <div className="mt-10 flex justify-center">
      <Link
        href="/?utm_source=prototype_badge"
        target="_blank"
        rel="noopener"
        className="group inline-flex items-center gap-2 rounded-full border border-edge bg-surface-subtle px-3 py-1.5 text-xs text-fg-muted transition-colors duration-micro hover:border-edge-strong hover:text-fg"
      >
        <span>Made with</span>
        <Logo size="sm" />
        <span aria-hidden="true" className="text-fg-faint transition-transform duration-micro group-hover:translate-x-0.5">
          →
        </span>
      </Link>
    </div>
  );
}
