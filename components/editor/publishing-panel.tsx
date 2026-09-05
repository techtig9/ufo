'use client';

import { useCallback, useEffect, useState } from 'react';
import { Panel } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { publishStatus } from '@/lib/publishing';

/**
 * Publishing: the real status, real view numbers, and a real publish log —
 * plus a plain statement of what UFO does not do.
 *
 * The Master Command's publishing list is conditional on real hosting. UFO does
 * not host: publishing makes a link live at /proto/<slug> on UFO's own domain.
 * Custom domains, SSL, subdomains and deployment rollback are properties of
 * infrastructure that does not exist here, so they are named as unavailable
 * rather than shown as controls that would not work.
 */

interface PublishEvent {
  id: string;
  action: string;
  had_password: boolean;
  expires_at: string | null;
  allow_comments: boolean;
  created_at: string;
  actor: { name: string | null; email: string } | null;
}

interface PublishingData {
  stats: { totalViews: number; recentViews: number; lastViewedAt: string | null; activeDays: number };
  sample: { size: number; referrers: [string, number][]; devices: [string, number][] };
  events: PublishEvent[];
}

const ACTION_LABEL: Record<string, string> = {
  published: 'Published',
  unpublished: 'Unpublished',
  settings_changed: 'Link settings changed',
};

export function PublishingPanel({
  projectId,
  share,
}: {
  projectId: string;
  share: { is_public: boolean; expires_at: string | null; hasPassword: boolean; published_at: string | null };
}) {
  const [data, setData] = useState<PublishingData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/publishing`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load, share.is_public, share.hasPassword, share.expires_at]);

  const status = publishStatus(share);
  const statusVariant =
    status.state === 'live' ? 'success' : status.state === 'expired' ? 'error' : status.state === 'locked' ? 'info' : 'neutral';

  return (
    <Panel hover={false} className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-medium">Publishing</h3>
        <Badge variant={statusVariant} dot>
          {status.label}
        </Badge>
      </div>
      <p className="text-xs text-fg-muted">{status.detail}</p>

      {loading ? (
        <Skeleton className="h-20 w-full" />
      ) : (
        data && (
          <>
            <div className="grid grid-cols-3 gap-2 border-t border-edge pt-3">
              <Stat label="Views" value={data.stats.totalViews} />
              <Stat label="Last 30 days" value={data.stats.recentViews} />
              <Stat label="Days viewed" value={data.stats.activeDays} />
            </div>
            <p className="text-[10px] leading-4 text-fg-faint">
              Views, not visitors: nothing that identifies a viewer is stored, so repeat visits from
              one person cannot be told apart. Your own visits are not counted.
              {data.stats.lastViewedAt && (
                <> Last opened {new Date(data.stats.lastViewedAt).toLocaleString()}.</>
              )}
            </p>

            {data.sample.referrers.length > 0 && (
              <div className="border-t border-edge pt-3">
                <p className="text-[9px] font-semibold uppercase tracking-[.18em] text-fg-faint">
                  Opened from — last {data.sample.size} views
                </p>
                <ul className="mt-2 space-y-1">
                  {data.sample.referrers.map(([host, count]) => (
                    <li key={host} className="flex justify-between text-xs text-fg-muted">
                      <span className="truncate">{host}</span>
                      <span className="text-fg-faint">{count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="border-t border-edge pt-3">
              <p className="text-[9px] font-semibold uppercase tracking-[.18em] text-fg-faint">
                Publish history
              </p>
              {data.events.length === 0 ? (
                <p className="mt-2 text-xs text-fg-faint">This project has not been published yet.</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {data.events.map((event) => (
                    <li key={event.id} className="text-xs text-fg-muted">
                      <span className="text-fg">{ACTION_LABEL[event.action] ?? event.action}</span>
                      {event.actor && (
                        <span className="text-fg-faint">
                          {' '}
                          by {event.actor.name || event.actor.email}
                        </span>
                      )}
                      <span className="text-fg-faint">
                        {' · '}
                        {new Date(event.created_at).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )
      )}

      <p className="border-t border-edge pt-3 text-[10px] leading-4 text-fg-faint">
        UFO publishes a shareable prototype link on its own domain — it does not host a site.
        Custom domains, SSL certificates, subdomains and deployment rollback are not available,
        because there is no deployment behind the link. Screen-level version history and restore
        are in the History panel.
      </p>
    </Panel>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-surface-subtle p-2 text-center">
      <p className="font-display text-lg text-fg">{value.toLocaleString()}</p>
      <p className="text-[10px] text-fg-faint">{label}</p>
    </div>
  );
}
