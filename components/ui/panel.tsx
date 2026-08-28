import { type ReactNode } from 'react';
import clsx from 'clsx';

interface PanelProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  as?: 'div' | 'section' | 'article';
}

export function Panel({ children, className, hover = true, as: Tag = 'div' }: PanelProps) {
  return (
    <Tag className={clsx('panel p-6', hover && 'panel-hover', className)}>
      {children}
    </Tag>
  );
}
