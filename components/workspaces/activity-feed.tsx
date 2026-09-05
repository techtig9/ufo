'use client';

import Link from 'next/link';
import { EmptyState } from '@/components/ui/empty-state';

export interface ActivityEntry {
  id: string;
  action: string;
  detail: string | null;
  created_at: string;
  project_id: string | null;
  actor: { id: string; name: string | null; email: string } | null;
}

/**
 * Verbs for the actions the app actually writes. An unknown action falls back
 * to its raw key rather than being hidden — an audit trail that silently drops
 * entries it does not recognise is worse than one that shows a raw string.
 */
const VERBS: Record<string, string> = {
  'workspace.created': 'created the workspace',
  'workspace.renamed': 'renamed the workspace',
  'member.invited': 'invited',
  'member.joined': 'joined the workspace as',
  'member.removed': 'removed a member',
  'member.left': 'left the workspace',
  'member.role_changed': 'changed a role',
  'project.published': 'published a prototype',
  'project.unpublished': 'unpublished a prototype',
  'project.moved_in': 'added a project to the workspace',
  'project.moved_out': 'removed a project from the workspace',
  'comment.created': 'commented',
  'comment.assigned': 'assigned a comment',
  'comment.resolved': 'resolved a comment',
};

function relative(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function ActivityFeed({ activity }: { activity: ActivityEntry[] }) {
  if (activity.length === 0) {
    return (
      <EmptyState
        title="No activity yet"
        description="Invitations, membership changes and publishing all appear here."
      />
    );
  }

  return (
    <ul className="space-y-3">
      {activity.map((entry) => {
        const who = entry.actor?.name || entry.actor?.email || 'Someone';
        return (
          <li key={entry.id} className="flex gap-3 text-sm">
            <span
              aria-hidden="true"
              className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-studio-citron"
            />
            <div className="min-w-0">
              <p className="text-fg-secondary">
                <span className="text-fg">{who}</span> {VERBS[entry.action] ?? entry.action}
                {entry.detail && <span className="text-fg-muted"> {entry.detail}</span>}
                {entry.project_id && (
                  <>
                    {' — '}
                    <Link
                      href={`/dashboard/projects/${entry.project_id}`}
                      className="text-brand-text hover:underline"
                    >
                      open project
                    </Link>
                  </>
                )}
              </p>
              <time dateTime={entry.created_at} className="text-xs text-fg-faint">
                {relative(entry.created_at)}
              </time>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
