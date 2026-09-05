import Link from 'next/link';
import { Panel } from '@/components/ui/panel';

interface ChecklistItem {
  label: string;
  done: boolean;
  href: string;
}

export function OnboardingChecklist({ items }: { items: ChecklistItem[] }) {
  const doneCount = items.filter((i) => i.done).length;
  if (doneCount === items.length) return null; // fully onboarded — don't nag

  return (
    <Panel hover={false}>
      <div className="flex items-center justify-between">
        <h2 className="font-medium">Get started</h2>
        <span className="font-mono text-xs text-fg-faint">{doneCount}/{items.length}</span>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
        <div
          className="h-full rounded-full bg-studio-citron transition-all duration-500 ease-snap"
          style={{ width: `${(doneCount / items.length) * 100}%` }}
        />
      </div>
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item.label}>
            <Link
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-subtle"
            >
              <span
                className={
                  item.done
                    ? 'flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-studio-citron text-[10px] text-ink'
                    : 'h-4 w-4 shrink-0 rounded-full border border-edge-strong'
                }
              >
                {item.done && '\u2713'}
              </span>
              <span className={item.done ? 'text-fg-faint line-through' : 'text-fg-secondary'}>
                {item.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
