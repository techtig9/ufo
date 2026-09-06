import { createAdminClient } from '@/lib/supabase/admin';
import { Panel } from '@/components/ui/panel';
import { Badge } from '@/components/ui/badge';
import { StatGrid, NoData, type Stat } from '@/components/admin/stat-grid';
import { PROVIDER_CASCADE } from '@/lib/ai/providers';

/**
 * AI usage, provider health and failed generations.
 *
 * Every number here is computed from `ai_requests`, which the router writes on
 * every real call — so provider health is measured from what actually happened
 * rather than by probing the providers, which would cost money on each page
 * load and still only tell you about that one moment.
 */

export const dynamic = 'force-dynamic';

interface AiRequest {
  id: string;
  request_id: string;
  task: string;
  provider: string;
  model: string | null;
  outcome: 'success' | 'retryable_failure' | 'fatal_failure';
  http_status: number | null;
  latency_ms: number | null;
  fallback_reason: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  created_at: string;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

export default async function AdminAiPage() {
  const admin = createAdminClient();

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: recent }, { count: totalAll }] = await Promise.all([
    admin
      .from('ai_requests')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(2000),
    admin.from('ai_requests').select('id', { count: 'exact', head: true }),
  ]);

  const rows = (recent ?? []) as AiRequest[];
  const successes = rows.filter((r) => r.outcome === 'success');
  const failures = rows.filter((r) => r.outcome !== 'success');
  const latencies = successes.map((r) => r.latency_ms ?? 0).filter((n) => n > 0);

  // A request is one generation; several ai_requests rows can belong to it when
  // the cascade fell through, so "requests" and "attempts" are different
  // numbers and are labelled as such rather than conflated.
  const generations = new Set(rows.map((r) => r.request_id)).size;
  const tokensIn = successes.reduce((sum, r) => sum + (r.prompt_tokens ?? 0), 0);
  const tokensOut = successes.reduce((sum, r) => sum + (r.completion_tokens ?? 0), 0);

  const successRate = rows.length ? Math.round((successes.length / rows.length) * 100) : 0;

  const stats: Stat[] = [
    { label: 'Generations (7d)', value: generations, hint: `${rows.length.toLocaleString()} provider attempts` },
    {
      label: 'Attempt success rate',
      value: rows.length ? `${successRate}%` : '—',
      tone: !rows.length ? 'neutral' : successRate >= 95 ? 'good' : successRate >= 80 ? 'warn' : 'bad',
      hint: `${failures.length.toLocaleString()} failed attempts`,
    },
    {
      label: 'Median latency',
      value: latencies.length ? `${median(latencies).toLocaleString()} ms` : '—',
      hint: latencies.length ? `p95 ${percentile(latencies, 95).toLocaleString()} ms` : 'no successful calls yet',
    },
    {
      label: 'Tokens (7d)',
      value: (tokensIn + tokensOut).toLocaleString(),
      hint: `${tokensIn.toLocaleString()} in · ${tokensOut.toLocaleString()} out`,
    },
  ];

  // Per-provider health, measured.
  const providerNames = PROVIDER_CASCADE.map((p) => p.name);
  const providerHealth = providerNames.map((name) => {
    const attempts = rows.filter((r) => r.provider === name);
    const ok = attempts.filter((r) => r.outcome === 'success');
    const providerLatencies = ok.map((r) => r.latency_ms ?? 0).filter((n) => n > 0);
    const provider = PROVIDER_CASCADE.find((p) => p.name === name)!;
    return {
      name,
      configured: provider.isConfigured(),
      attempts: attempts.length,
      successes: ok.length,
      rate: attempts.length ? Math.round((ok.length / attempts.length) * 100) : null,
      medianLatency: providerLatencies.length ? median(providerLatencies) : null,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium">AI usage &amp; provider health</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Measured from the last 7 days of real calls
          {totalAll ? ` (${totalAll.toLocaleString()} recorded all time)` : ''}. Nothing here is
          sampled or estimated.
        </p>
      </div>

      <StatGrid stats={stats} />

      <Panel hover={false} className="p-0">
        <h2 className="border-b border-edge px-4 py-3 font-medium">Providers</h2>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-edge text-fg-faint">
            <tr>
              <th className="px-4 py-2 font-normal">Provider</th>
              <th className="px-4 py-2 font-normal">Configured</th>
              <th className="px-4 py-2 font-normal">Attempts (7d)</th>
              <th className="px-4 py-2 font-normal">Success</th>
              <th className="px-4 py-2 font-normal">Median latency</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge">
            {providerHealth.map((p, index) => (
              <tr key={p.name}>
                <td className="px-4 py-2">
                  {p.name}
                  {index === 0 && <span className="ml-2 text-[10px] text-fg-faint">primary</span>}
                </td>
                <td className="px-4 py-2">
                  {p.configured ? (
                    <Badge variant="success" size="sm">yes</Badge>
                  ) : (
                    <Badge variant="neutral" size="sm">no key</Badge>
                  )}
                </td>
                <td className="px-4 py-2 text-fg-muted">{p.attempts.toLocaleString()}</td>
                <td className="px-4 py-2">
                  {p.rate === null ? (
                    <span className="text-fg-faint">—</span>
                  ) : (
                    <Badge variant={p.rate >= 95 ? 'success' : p.rate >= 80 ? 'warning' : 'error'} size="sm">
                      {p.rate}%
                    </Badge>
                  )}
                </td>
                <td className="px-4 py-2 text-fg-muted">
                  {p.medianLatency === null ? '—' : `${p.medianLatency.toLocaleString()} ms`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-edge px-4 py-2 text-xs text-fg-faint">
          A provider with no attempts is not unhealthy — the cascade tries them in order and stops
          at the first that succeeds, so the later ones are only reached when an earlier one fails.
        </p>
      </Panel>

      <div>
        <h2 className="mb-3 font-medium">Failed generations</h2>
        {failures.length === 0 ? (
          <NoData
            what="failures"
            because="Either nothing has failed in the last 7 days, or no generation has run yet."
          />
        ) : (
          <Panel hover={false} className="overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-edge text-fg-faint">
                <tr>
                  <th className="px-4 py-2 font-normal">When</th>
                  <th className="px-4 py-2 font-normal">Task</th>
                  <th className="px-4 py-2 font-normal">Provider</th>
                  <th className="px-4 py-2 font-normal">Outcome</th>
                  <th className="px-4 py-2 font-normal">HTTP</th>
                  <th className="px-4 py-2 font-normal">Reason</th>
                  <th className="px-4 py-2 font-normal">Request</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge">
                {failures.slice(0, 100).map((row) => (
                  <tr key={row.id}>
                    <td className="whitespace-nowrap px-4 py-2 text-fg-muted">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2">{row.task}</td>
                    <td className="px-4 py-2 text-fg-muted">{row.provider}</td>
                    <td className="px-4 py-2">
                      <Badge variant={row.outcome === 'fatal_failure' ? 'error' : 'warning'} size="sm">
                        {row.outcome === 'fatal_failure' ? 'fatal' : 'retried'}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 text-fg-muted">{row.http_status ?? '—'}</td>
                    <td className="max-w-xs truncate px-4 py-2 text-fg-muted" title={row.fallback_reason ?? ''}>
                      {row.fallback_reason ?? '—'}
                    </td>
                    {/* The request id is what ties this to the credit ledger
                        row and the server log line for the same generation. */}
                    <td className="px-4 py-2 font-mono text-[11px] text-fg-faint">{row.request_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {failures.length > 100 && (
              <p className="border-t border-edge px-4 py-2 text-xs text-fg-faint">
                Showing the 100 most recent of {failures.length.toLocaleString()}.
              </p>
            )}
          </Panel>
        )}
      </div>
    </div>
  );
}
