import { createAdminClient } from '@/lib/supabase/admin';
import { Panel } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { StatGrid, NoData, type Stat } from '@/components/admin/stat-grid';

/**
 * Email delivery events.
 *
 * `email_events` stores a SALTED HASH of each recipient, never the address —
 * so this page can answer "did this template deliver?" and "is one recipient
 * failing repeatedly?" without turning the admin panel into a mailing list.
 * The hash is shown truncated for correlation only.
 */

export const dynamic = 'force-dynamic';

interface EmailEvent {
  id: string;
  template: string;
  recipient_hash: string;
  status: 'sent' | 'failed' | 'skipped_unconfigured';
  provider_message_id: string | null;
  error_class: string | null;
  created_at: string;
}

export default async function AdminEmailPage() {
  const admin = createAdminClient();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data } = await admin
    .from('email_events')
    .select('*')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1000);

  const rows = (data ?? []) as EmailEvent[];
  const sent = rows.filter((r) => r.status === 'sent');
  const failed = rows.filter((r) => r.status === 'failed');
  const skipped = rows.filter((r) => r.status === 'skipped_unconfigured');

  const deliveryRate = rows.length - skipped.length > 0
    ? Math.round((sent.length / (rows.length - skipped.length)) * 100)
    : null;

  const stats: Stat[] = [
    { label: 'Sent (30d)', value: sent.length },
    {
      label: 'Failed',
      value: failed.length,
      tone: failed.length === 0 ? 'good' : 'bad',
    },
    {
      label: 'Delivery rate',
      value: deliveryRate === null ? '—' : `${deliveryRate}%`,
      tone: deliveryRate === null ? 'neutral' : deliveryRate >= 98 ? 'good' : deliveryRate >= 90 ? 'warn' : 'bad',
      hint: 'excludes sends skipped because the provider is unconfigured',
    },
    {
      label: 'Skipped',
      value: skipped.length,
      tone: skipped.length ? 'warn' : 'neutral',
      hint: skipped.length ? 'RESEND_API_KEY was not set' : undefined,
    },
  ];

  // Per template, so a single broken email is visible rather than averaged away.
  const byTemplate = new Map<string, { sent: number; failed: number; skipped: number }>();
  for (const row of rows) {
    const entry = byTemplate.get(row.template) ?? { sent: 0, failed: 0, skipped: 0 };
    if (row.status === 'sent') entry.sent++;
    else if (row.status === 'failed') entry.failed++;
    else entry.skipped++;
    byTemplate.set(row.template, entry);
  }

  // Error classes, so a systemic failure is distinguishable from scattered ones.
  const byError = new Map<string, number>();
  for (const row of failed) {
    const key = row.error_class ?? 'unknown';
    byError.set(key, (byError.get(key) ?? 0) + 1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium">Email delivery</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Last 30 days. Recipients are stored as a salted hash, never as an address — this page can
          tell you a template is failing without being a list of everyone&rsquo;s email.
        </p>
      </div>

      <StatGrid stats={stats} />

      {rows.length === 0 ? (
        <NoData
          what="email events"
          because="No email has been attempted in the last 30 days, or the app has not run against a live database."
        />
      ) : (
        <>
          <Panel hover={false} className="p-0">
            <h2 className="border-b border-edge px-4 py-3 font-medium">By template</h2>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-edge text-fg-faint">
                <tr>
                  <th className="px-4 py-2 font-normal">Template</th>
                  <th className="px-4 py-2 font-normal">Sent</th>
                  <th className="px-4 py-2 font-normal">Failed</th>
                  <th className="px-4 py-2 font-normal">Skipped</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge">
                {[...byTemplate.entries()]
                  .sort((a, b) => b[1].failed - a[1].failed || b[1].sent - a[1].sent)
                  .map(([template, counts]) => (
                    <tr key={template}>
                      <td className="px-4 py-2 font-mono text-[12px]">{template}</td>
                      <td className="px-4 py-2 text-fg-muted">{counts.sent}</td>
                      <td className="px-4 py-2">
                        {counts.failed > 0 ? (
                          <Badge variant="error" size="sm">{counts.failed}</Badge>
                        ) : (
                          <span className="text-fg-faint">0</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-fg-muted">{counts.skipped}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </Panel>

          {byError.size > 0 && (
            <Panel hover={false} className="p-0">
              <h2 className="border-b border-edge px-4 py-3 font-medium">Failure reasons</h2>
              <ul className="divide-y divide-edge">
                {[...byError.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([reason, count]) => (
                    <li key={reason} className="flex justify-between px-4 py-2 text-sm">
                      <span className="font-mono text-[12px]">{reason}</span>
                      <span className="text-fg-muted">{count}</span>
                    </li>
                  ))}
              </ul>
            </Panel>
          )}

          <Panel hover={false} className="overflow-x-auto p-0">
            <h2 className="border-b border-edge px-4 py-3 font-medium">Recent events</h2>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-edge text-fg-faint">
                <tr>
                  <th className="px-4 py-2 font-normal">When</th>
                  <th className="px-4 py-2 font-normal">Template</th>
                  <th className="px-4 py-2 font-normal">Status</th>
                  <th className="px-4 py-2 font-normal">Recipient</th>
                  <th className="px-4 py-2 font-normal">Provider id</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge">
                {rows.slice(0, 100).map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap px-4 py-2 text-fg-muted">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 font-mono text-[12px]">{row.template}</td>
                    <td className="px-4 py-2">
                      <Badge
                        variant={row.status === 'sent' ? 'success' : row.status === 'failed' ? 'error' : 'neutral'}
                        size="sm"
                      >
                        {row.status === 'skipped_unconfigured' ? 'skipped' : row.status}
                      </Badge>
                    </td>
                    {/* Truncated hash: enough to spot one recipient failing
                        repeatedly, not enough to be a contact list. */}
                    <td className="px-4 py-2 font-mono text-[11px] text-fg-faint">
                      {row.recipient_hash.slice(0, 10)}…
                    </td>
                    <td className="px-4 py-2 font-mono text-[11px] text-fg-faint">
                      {row.provider_message_id ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </>
      )}
    </div>
  );
}
