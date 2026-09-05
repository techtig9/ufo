'use client';

import { splitBody } from '@/lib/mentions';

/**
 * Renders a comment body, turning mention tokens into chips.
 *
 * Every segment is rendered as React text, never as HTML — comment bodies come
 * from anyone holding a share link, so the body is treated as untrusted input
 * at the point of display rather than sanitised on the way in.
 */
export function CommentBody({
  body,
  highlightUserId,
  className,
}: {
  body: string;
  /** Mentions of this user (the current viewer) are emphasised. */
  highlightUserId?: string | null;
  className?: string;
}) {
  return (
    <p className={className}>
      {splitBody(body).map((segment, i) =>
        segment.type === 'text' ? (
          <span key={i}>{segment.value}</span>
        ) : (
          <span
            key={i}
            className={
              segment.userId === highlightUserId
                ? 'rounded bg-studio-citron/20 px-1 font-medium text-brand-text'
                : 'rounded bg-surface-raised px-1 font-medium text-fg'
            }
          >
            @{segment.label}
          </span>
        )
      )}
    </p>
  );
}
