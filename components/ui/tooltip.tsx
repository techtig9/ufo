'use client';

import { type ReactElement, type ReactNode, cloneElement, useId, useState } from 'react';
import clsx from 'clsx';

interface TooltipProps {
  children: ReactElement;
  content: ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

const sideClasses: Record<NonNullable<TooltipProps['side']>, string> = {
  top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
  bottom: 'top-full left-1/2 mt-2 -translate-x-1/2',
  left: 'right-full top-1/2 mr-2 -translate-y-1/2',
  right: 'left-full top-1/2 ml-2 -translate-y-1/2',
};

/** Hover/focus-triggered tooltip. Wraps a single focusable child (button, link, icon-button). */
export function Tooltip({ children, content, side = 'top' }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  const show = () => setVisible(true);
  const hide = () => setVisible(false);

  const trigger = cloneElement(children, {
    'aria-describedby': visible ? id : undefined,
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: hide,
  });

  return (
    <span className="relative inline-flex">
      {trigger}
      <span
        role="tooltip"
        id={id}
        className={clsx(
          'dropdown-surface pointer-events-none absolute z-[150] whitespace-nowrap rounded-md border border-line px-2.5 py-1.5 text-xs text-white shadow-lift transition-opacity duration-150',
          sideClasses[side],
          visible ? 'opacity-100' : 'opacity-0'
        )}
      >
        {content}
      </span>
    </span>
  );
}
