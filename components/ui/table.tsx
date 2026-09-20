import type { ReactNode } from 'react';

/**
 * A table primitive, extracted because six screens had each grown their own
 * `<table>` with slightly different borders, padding and zebra striping.
 *
 * `<Table>` renders its own horizontal scroll container. A data table is the
 * single most common cause of horizontal page scroll on a phone, and the fix
 * has to live with the component rather than depending on every caller
 * remembering to wrap it. `tabindex={0}` on the scroller is deliberate: a
 * keyboard user with no pointer otherwise cannot scroll it at all.
 */
export function Table({ caption, children }: { caption?: string; children: ReactNode }) {
  return (
    <div
      tabIndex={0}
      role="region"
      aria-label={caption}
      className="-mx-1 overflow-x-auto px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60"
    >
      <table className="w-full min-w-[32rem] border-collapse text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        {children}
      </table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-edge text-left">
      <tr>{children}</tr>
    </thead>
  );
}

export function TH({
  children,
  numeric = false,
  scope = 'col',
}: {
  children: ReactNode;
  numeric?: boolean;
  scope?: 'col' | 'row';
}) {
  return (
    <th
      scope={scope}
      className={`px-3 py-2.5 font-medium text-fg-muted ${numeric ? 'text-right tabular-nums' : ''}`}
    >
      {children}
    </th>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  // Zebra striping via --n1 rather than a hardcoded grey: it inverts with the
  // theme, so rows stay subtly distinct on paper as well as on ink.
  return <tbody className="[&>tr:nth-child(even)]:bg-n1/60">{children}</tbody>;
}

export function TR({ children }: { children: ReactNode }) {
  return <tr className="border-b border-edge/60 last:border-0">{children}</tr>;
}

export function TD({ children, numeric = false }: { children: ReactNode; numeric?: boolean }) {
  return (
    <td className={`px-3 py-2.5 align-middle ${numeric ? 'text-right tabular-nums' : ''}`}>
      {children}
    </td>
  );
}
