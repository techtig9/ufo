'use client';

import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs } from '@/components/ui/tabs';

export interface Comment {
  id: string;
  author_name: string;
  body: string;
  created_at: string;
  screen_id: string;
  x: number;
  y: number;
  resolved: boolean;
  parent_id: string | null;
}

type Filter = 'all' | 'unresolved' | 'resolved';

export function CommentsPanel({
  shareId,
  screenId,
  comments,
  onCommentsChange,
  isOwner,
  pinMode,
  onTogglePinMode,
  pendingPin,
  onClearPendingPin,
  highlightId,
  onHighlightHandled,
}: {
  shareId: string;
  screenId: string;
  comments: Comment[];
  onCommentsChange: (updater: (current: Comment[]) => Comment[]) => void;
  isOwner: boolean;
  pinMode: boolean;
  onTogglePinMode: () => void;
  pendingPin: { x: number; y: number } | null;
  onClearPendingPin: () => void;
  highlightId: string | null;
  onHighlightHandled: () => void;
}) {
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const itemRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    if (!highlightId) return;
    itemRefs.current.get(highlightId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timeout = setTimeout(onHighlightHandled, 2000);
    return () => clearTimeout(timeout);
  }, [highlightId, onHighlightHandled]);

  const topLevel = comments.filter((c) => !c.parent_id);
  const repliesOf = (id: string) => comments.filter((c) => c.parent_id === id);
  const visible = topLevel.filter((c) =>
    filter === 'all' ? true : filter === 'resolved' ? c.resolved : !c.resolved
  );

  async function postComment(text: string, parentId: string | null) {
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shareId,
        screenId,
        authorName: name || 'Guest',
        body: text,
        x: parentId ? 50 : pendingPin?.x ?? 50,
        y: parentId ? 50 : pendingPin?.y ?? 50,
        parentId,
      }),
    });
    if (!res.ok) {
      toast.error('Could not post your comment');
      return false;
    }
    const created = await res.json();
    onCommentsChange((current) => [created, ...current]);
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSubmitting(true);
    const ok = await postComment(body, null);
    setSubmitting(false);
    if (ok) {
      setBody('');
      onClearPendingPin();
      toast.success('Comment added');
    }
  }

  async function handleReplySubmit(parentId: string) {
    if (!replyBody.trim()) return;
    setSubmitting(true);
    const ok = await postComment(replyBody, parentId);
    setSubmitting(false);
    if (ok) {
      setReplyBody('');
      setReplyingTo(null);
    }
  }

  async function toggleResolved(comment: Comment) {
    const res = await fetch(`/api/comments/${comment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolved: !comment.resolved }),
    });
    if (!res.ok) {
      toast.error('Could not update this comment');
      return;
    }
    onCommentsChange((current) => current.map((c) => (c.id === comment.id ? { ...c, resolved: !comment.resolved } : c)));
  }

  async function deleteComment(id: string) {
    const res = await fetch(`/api/comments/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      toast.error('Could not delete this comment');
      return;
    }
    onCommentsChange((current) => current.filter((c) => c.id !== id && c.parent_id !== id));
    toast.success('Comment deleted');
  }

  return (
    <Panel hover={false} className="w-full max-w-md">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Feedback on this screen</h3>
        <button
          type="button"
          onClick={onTogglePinMode}
          className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${pinMode ? 'border-studio-citron bg-studio-citron/10 text-brand-text' : 'border-edge text-fg-muted hover:text-fg'}`}
        >
          {pinMode ? 'Click the preview…' : '📍 Add pin'}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-3 space-y-2">
        {pendingPin && (
          <p className="text-[10px] text-brand-text">
            Pin placed ✓{' '}
            <button type="button" onClick={onClearPendingPin} className="underline">clear</button>
          </p>
        )}
        <input
          placeholder="Your name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-edge bg-surface-subtle px-3 py-1.5 text-sm outline-none focus:border-studio-citron"
        />
        <textarea
          placeholder="Leave a note for the team…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-edge bg-surface-subtle px-3 py-1.5 text-sm outline-none focus:border-studio-citron"
        />
        <Button size="sm" type="submit" disabled={submitting}>
          {submitting ? 'Posting…' : 'Post comment'}
        </Button>
      </form>

      <div className="mt-4 border-t border-edge pt-3">
        <Tabs
          tabs={[
            { id: 'all', label: 'All', content: null },
            { id: 'unresolved', label: 'Unresolved', content: null },
            { id: 'resolved', label: 'Resolved', content: null },
          ]}
          value={filter}
          onChange={(id) => setFilter(id as Filter)}
        />
      </div>

      <div className="mt-3 max-h-72 space-y-3 overflow-y-auto">
        {!visible.length && <p className="text-xs text-fg-faint">No comments yet.</p>}
        {visible.map((c) => (
          <div
            key={c.id}
            ref={(el) => { if (el) itemRefs.current.set(c.id, el); else itemRefs.current.delete(c.id); }}
            className={`rounded-lg p-2 transition-colors ${highlightId === c.id ? 'bg-studio-citron/10 ring-1 ring-studio-citron/40' : ''}`}
          >
            <div className="flex items-start justify-between gap-2 text-sm">
              <p className="text-fg-secondary">{c.body}</p>
              {c.resolved && <Badge variant="success" size="sm">Resolved</Badge>}
            </div>
            <p className="mt-0.5 text-xs text-fg-faint">
              {c.author_name} · {new Date(c.created_at).toLocaleDateString()}
            </p>
            <div className="mt-1.5 flex gap-3 text-[10px] text-fg-faint">
              <button onClick={() => setReplyingTo(replyingTo === c.id ? null : c.id)} className="hover:text-fg">Reply</button>
              {isOwner && (
                <>
                  <button onClick={() => toggleResolved(c)} className="hover:text-fg">
                    {c.resolved ? 'Reopen' : 'Resolve'}
                  </button>
                  <button onClick={() => deleteComment(c.id)} className="text-status-error/70 hover:text-status-error">Delete</button>
                </>
              )}
            </div>

            {repliesOf(c.id).map((reply) => (
              <div key={reply.id} className="mt-2 ml-4 border-l border-edge pl-3">
                <p className="text-sm text-fg-secondary">{reply.body}</p>
                <p className="mt-0.5 text-xs text-fg-faint">
                  {reply.author_name} · {new Date(reply.created_at).toLocaleDateString()}
                </p>
                {isOwner && (
                  <button onClick={() => deleteComment(reply.id)} className="mt-1 text-[10px] text-status-error/70 hover:text-status-error">Delete</button>
                )}
              </div>
            ))}

            {replyingTo === c.id && (
              <div className="mt-2 ml-4 flex gap-2">
                <input
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder="Write a reply…"
                  className="min-w-0 flex-1 rounded-lg border border-edge bg-surface-subtle px-2.5 py-1.5 text-xs outline-none focus:border-studio-citron"
                />
                <Button size="sm" onClick={() => handleReplySubmit(c.id)} disabled={submitting}>Send</Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}
