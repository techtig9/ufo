import { createAdminClient } from '@/lib/supabase/admin';
import { Panel } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { StatGrid, NoData, type Stat } from '@/components/admin/stat-grid';
import { PROVIDER_CASCADE } from '@/lib/ai/providers';

/**
 * System health, webhook delivery and the credit audit log.
 *
 * Deliberately reads the same tables the app writes rather than a separate
 * metrics store: a dashboard fed by its own pipeline can disagree with reality,
 * and the whole point of this page is to be trusted during an incident.
 */

export const dynamic = 'force-dynamic';

interface LedgerRow {
  id: string;
  action: string;
  amount: number;
  balance_after: number;
  request_id: string | null;
  reason: string;
  created_at: string;
  users: { email: string } | null;
}

async function timedCount(
  run: () => PromiseLike<{ count: number | null; error: unknown }>
): Promise<{ count: number; latencyMs: number; ok: boolean }> {
  const startedAt = Date.now();
  try {
    const { count, error } = await run();
    return { count: count ?? 0, latencyMs: Date.now() - startedAt, ok: !error };
  } catch {
    return { count: 0, latencyMs: Date.now() - startedAt, ok: false };
  }
}

/** Loaded outside the component: the probe and the 24h window both depend on
 *  the current time, which `react-hooks/purity` rightly refuses in a render
 *  body. */
async function loadSystemState() {
  const admin = createAdminClient();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [dbProbe, webhooks, recentWebhooks, ledger, authEvents] = await Promise.all([
    timedCount(() => admin.from('users').select('id', { count: 'exact', head: true })),
    timedCount(() => admin.from('webhook_events').select('id', { count: 'exact', head: true })),
    admin
      .from('webhook_events')
      .select('id, provider, event_id, created_at')
      .order('created_at', { ascending: false })
      .limit(25),
    admin
      .from('credit_ledger')
      .select('id, action, amount, balance_after, request_id, reason, created_at, users(email)')
      .order('created_at', { ascending: false })
      .limit(100),
    timedCount(() =>
      admin.from('auth_events').select('id', { count: 'exact', head: true }).gte('created_at', dayAgo)
    ),
  ]);

  return { dbProbe, webhooks, recentWebhooks, ledger, authEvents };
}

export default async function AdminSystemPage() {
  const { dbProbe, webhooks, recentWebhooks, ledger, authEvents } = await loadSystemState();

  const configuredProviders = PROVIDER_CASCADE.filter((p) => p.isConfigured());

  const stats: Stat[] = [
    {
      label: 'Database',
      value: dbProbe.ok ? 'reachable' : 'unreachable',
      tone: dbProbe.ok ? (dbProbe.latencyMs > 500 ? 'warn' : 'good') : 'bad',
      hint: `${dbProbe.latencyMs} ms probe`,
    },
    {
      label: 'AI providers',
      value: `${configuredProviders.length}/${PROVIDER_CASCADE.length}`,
      tone: configuredProviders.length === 0 ? 'bad' : configuredProviders.length < PROVIDER_CASCADE.length ? 'warn' : 'good',
      hint: configuredProviders.map((p) => p.name).join(', ') || 'none configured',
    },
    {
      label: 'Webhooks received',
      value: webhooks.count,
      hint: 'deduplicated by (provider, event_id)',
    },
    {
      label: 'Auth events (24h)',
      value: authEvents.count,
      hint: 'sign-ins, resets and password changes',
    },
  ];

  const ledgerRows = (ledger.data ?? []) as unknown as LedgerRow[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium">System health</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Read from the same tables the app writes, so this page cannot disagree with reality. The
          machine-readable version is <code className="text-fg">/api/health</code>, which an uptime
          monitor can poll without a session.
        </p>
      </div>

      <StatGrid stats={stats} />

      <Panel hover={false} className="p-0">
        <h2 className="border-b border-edge px-4 py-3 font-medium">Configuration</h2>
        <ul className="divide-y divide-edge text-sm">
          {[
            ['Email (Resend)', Boolean(process.env.RESEND_API_KEY)],
            ['Billing webhook secret', Boolean(process.env.PADDLE_WEBHOOK_SECRET)],
            ['Billing API key', Boolean(process.env.PADDLE_API_KEY)],
            ['Bot protection (Turnstile)', Boolean(process.env.TURNSTILE_SECRET_KEY)],
            ['Cron secret', Boolean(process.env.CRON_SECRET)],
            ['Company details', Boolean(process.env.UFO_COMPANY_LEGAL_NAME)],
          ].map(([label, configured]) => (
            <li key={label as string} className="flex items-center justify-between px-4 py-2">
              <span>{label}</span>
              {/* Presence only — never the value. This page is behind an admin
                  check, but a secret rendered into HTML is a secret in a
                  browser cache, a screenshot and a screen share. */}
              {configured ? (
                <Badge variant="success" size="sm">configured</Badge>
              ) : (
                <Badge variant="warning" size="sm">not set</Badge>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel hover={false} className="p-0">
        <h2 className="border-b border-edge px-4 py-3 font-medium">Recent webhooks</h2>
        {(recentWebhooks.data ?? []).length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-fg-muted">
            No webhook has been received yet.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-edge text-fg-faint">
              <tr>
                <th className="px-4 py-2 font-normal">When</th>
                <th className="px-4 py-2 font-normal">Provider</th>
                <th className="px-4 py-2 font-normal">Event id</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {(recentWebhooks.data ?? []).map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap px-4 py-2 text-fg-muted">
                    {new Date(row.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">{row.provider}</td>
                  <td className="px-4 py-2 font-mono text-[11px] text-fg-faint">{row.event_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <div>
        <h2 className="mb-3 font-medium">Credit audit log</h2>
        {ledgerRows.length === 0 ? (
          <NoData
            what="credit movements"
            because="No generation has been charged or refunded yet."
          />
        ) : (
          <Panel hover={false} className="overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-edge text-fg-faint">
                <tr>
                  <th className="px-4 py-2 font-normal">When</th>
                  <th className="px-4 py-2 font-normal">User</th>
                  <th className="px-4 py-2 font-normal">Action</th>
                  <th className="px-4 py-2 font-normal">Amount</th>
                  <th className="px-4 py-2 font-normal">Balance after</th>
                  <th className="px-4 py-2 font-normal">Reason</th>
                  <th className="px-4 py-2 font-normal">Request</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge">
                {ledgerRows.map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap px-4 py-2 text-fg-muted">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-fg-muted">{row.users?.email ?? '—'}</td>
                    <td className="px-4 py-2">{row.action}</td>
                    <td className={`px-4 py-2 ${row.amount < 0 ? 'text-status-error' : 'text-status-success'}`}>
                      {row.amount > 0 ? `+${row.amount}` : row.amount}
                    </td>
                    <td className="px-4 py-2 text-fg-muted">{row.balance_after.toLocaleString()}</td>
                    <td className="px-4 py-2 text-fg-muted">{row.reason}</td>
                    {/* Same request id as the ai_requests rows and the server
                        log line, so a disputed charge can be traced end to end. */}
                    <td className="px-4 py-2 font-mono text-[11px] text-fg-faint">
                      {row.request_id ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        )}
      </div>
    </div>
  );
}
