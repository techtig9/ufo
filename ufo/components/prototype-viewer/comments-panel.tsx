'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';

interface Comment {
  id: string;
  author_name: string;
  body: string;
  created_at: string;
}

// Simplified for this pass: comments are tied to a screen, not a precise
// x/y pin position — dropping a literal pin on the sandboxed iframe needs
// extra postMessage plumbing (comment-mode toggle + coordinate capture)
// that didn't make it into today's build. Worth revisiting.
export function CommentsPanel({
  shareId,
  screenId,
  initialComments,
}: {
  shareId: string;
  screenId: string;
  initialComments: Comment[];
}) {
  const [comments, setComments] = useState(initialComments);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSubmitting(true);

    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shareId, screenId, authorName: name || 'Guest', body }),
    });
    setSubmitting(false);

    if (!res.ok) {
      toast.error('Could not post your comment');
      return;
    }
    const created = await res.json();
    setComments((c) => [created, ...c]);
    setBody('');
    toast.success('Comment added');
  }

  return (
    <Panel hover={false} className="w-full max-w-md">
      <h3 className="font-medium">Feedback on this screen</h3>
      <form onSubmit={handleSubmit} className="mt-3 space-y-2">
        <input
          placeholder="Your name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm outline-none focus:border-studio-citron"
        />
        <textarea
          placeholder="Leave a note for the team\u2026"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm outline-none focus:border-studio-citron"
        />
        <Button size="sm" type="submit" disabled={submitting}>
          {submitting ? 'Posting\u2026' : 'Post comment'}
        </Button>
      </form>
      <div className="mt-4 max-h-64 space-y-3 overflow-y-auto border-t border-white/10 pt-3">
        {!comments.length && <p className="text-xs text-white/30">No comments yet.</p>}
        {comments.map((c) => (
          <div key={c.id} className="text-sm">
            <p className="text-white/80">{c.body}</p>
            <p className="mt-0.5 text-xs text-white/30">
              {c.author_name} {'\u00b7'} {new Date(c.created_at).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
    </Panel>
  );
}
