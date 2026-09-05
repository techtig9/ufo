'use client';

import { useMemo, useState } from 'react';
import { PrototypeViewer } from '@/components/prototype-viewer/prototype-viewer';
import { CommentsPanel, type Comment } from '@/components/prototype-viewer/comments-panel';
import type { Screen } from '@/lib/types';

export function PublicPrototype({
  shareId,
  screens,
  comments: initialComments,
  isOwner,
  allowComments = true,
  viewerId = null,
}: {
  shareId: string;
  screens: Screen[];
  comments: Comment[];
  isOwner: boolean;
  /** Owners can switch commenting off per share link (migration 010). */
  allowComments?: boolean;
  /** null for an anonymous visitor — used to highlight mentions of the viewer. */
  viewerId?: string | null;
}) {
  const sorted = useMemo(() => [...screens].sort((a, b) => a.order_index - b.order_index), [screens]);
  const [activeScreenId, setActiveScreenId] = useState(sorted[0]?.id ?? '');
  const [comments, setComments] = useState(initialComments);
  const [pinMode, setPinMode] = useState(false);
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const activeComments = comments.filter((c) => c.screen_id === activeScreenId);
  const topLevelPins = activeComments
    .filter((c) => !c.parent_id)
    .map((c) => ({ id: c.id, x: c.x, y: c.y, resolved: c.resolved }));

  return (
    <>
      <PrototypeViewer
        screens={sorted}
        initialScreenId={activeScreenId}
        onScreenChange={setActiveScreenId}
        pinMode={pinMode}
        onPin={(_screenId, x, y) => {
          setPendingPin({ x, y });
          setPinMode(false);
        }}
        pins={topLevelPins}
        onPinClick={(id) => setHighlightId(id)}
      />
      <CommentsPanel
        shareId={shareId}
        screenId={activeScreenId}
        comments={activeComments}
        onCommentsChange={(updater) => setComments((all) => {
          const scoped = all.filter((c) => c.screen_id === activeScreenId);
          const rest = all.filter((c) => c.screen_id !== activeScreenId);
          return [...rest, ...updater(scoped)];
        })}
        isOwner={isOwner}
        allowComments={allowComments}
        viewerId={viewerId}
        pinMode={pinMode}
        onTogglePinMode={() => { setPinMode((v) => !v); setPendingPin(null); }}
        pendingPin={pendingPin}
        onClearPendingPin={() => setPendingPin(null)}
        highlightId={highlightId}
        onHighlightHandled={() => setHighlightId(null)}
      />
    </>
  );
}
