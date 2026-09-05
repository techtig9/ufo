import { ProviderError } from './errors';
import {
  PROVIDER_CASCADE,
  anthropic,
  type CallOptions,
  type CallResult,
  type ChatTurn,
  type Provider,
  type ProviderName,
} from './providers';

/**
 * The centralized AI provider router (Master Command 2.A).
 *
 * Required cascade: Groq -> Cerebras -> OpenRouter -> Anthropic Claude, with
 * fallback ONLY on retryable conditions and explicit, observable behaviour.
 *
 * Before this, two separate paths existed: `callSimple` cascaded Groq ->
 * Cerebras -> OpenRouter and fell back on 429 alone, while `callComplex` went
 * straight to Claude whenever ANTHROPIC_API_KEY was set and otherwise
 * delegated to the simple cascade. So Claude was never a fallback (it was
 * either first or absent), and a provider outage or a bad key was fatal
 * instead of failing over.
 */

export interface RouteOptions extends CallOptions {
  /** Correlates every attempt of one logical request. */
  requestId: string;
  /** Names the operation in the logs, e.g. 'generate_full_project'. */
  task: string;
  /** Attributes provider spend to a user. Absent for unauthenticated paths. */
  userId?: string;
  /**
   * Prefer Claude for work where quality matters more than cost. Still a
   * PREFERENCE, not a bypass: if Claude is unconfigured or failing, the
   * cascade continues through the cheaper providers rather than hard-failing.
   * The Master Command asks for this to be explicit and configurable.
   */
  preferHighQuality?: boolean;
}

export interface RouteResult extends CallResult {
  provider: ProviderName;
  /** Providers that were tried and fell through, in order. */
  attempts: number;
}

/**
 * Records one ATTEMPT. A request that falls back writes several rows sharing a
 * request_id, which is what makes "how often does Groq rate limit us" and
 * "what is p95 latency per provider" answerable.
 *
 * Never awaited by the caller and never allowed to throw: telemetry must not
 * be able to fail a generation that worked.
 */
function recordAttempt(row: {
  userId?: string;
  requestId: string;
  task: string;
  provider: ProviderName;
  model: string | null;
  outcome: 'success' | 'retryable_failure' | 'fatal_failure';
  httpStatus?: number;
  latencyMs: number;
  fallbackReason?: string;
  promptTokens?: number;
  completionTokens?: number;
}): void {
  // Structured line first — this works even when the database does not.
  console.log(
    JSON.stringify({
      scope: 'ai',
      requestId: row.requestId,
      task: row.task,
      provider: row.provider,
      model: row.model,
      outcome: row.outcome,
      httpStatus: row.httpStatus,
      latencyMs: row.latencyMs,
      fallbackReason: row.fallbackReason,
      promptTokens: row.promptTokens,
      completionTokens: row.completionTokens,
    })
  );

  void (async () => {
    try {
      // Imported lazily so the router carries no database dependency at module
      // load. That keeps it importable anywhere — including a bare Node test
      // process with no Supabase configured, where this import simply fails
      // and telemetry is skipped, exactly as intended for a best-effort sink.
      const { createAdminClient } = await import('../supabase/admin');
      const admin = createAdminClient();
      await admin.from('ai_requests').insert({
        user_id: row.userId ?? null,
        request_id: row.requestId,
        task: row.task,
        provider: row.provider,
        model: row.model,
        outcome: row.outcome,
        http_status: row.httpStatus ?? null,
        latency_ms: row.latencyMs,
        fallback_reason: row.fallbackReason ?? null,
        prompt_tokens: row.promptTokens ?? null,
        completion_tokens: row.completionTokens ?? null,
      });
    } catch {
      // Telemetry is best-effort by design.
    }
  })();
}

/** Orders the cascade for this request. */
function cascadeFor(options: RouteOptions): Provider[] {
  if (!options.preferHighQuality) return PROVIDER_CASCADE;
  // Claude first, then the standard order minus Claude — so a Claude outage
  // still degrades to the cheaper providers instead of failing the request.
  return [anthropic, ...PROVIDER_CASCADE.filter((p) => p.name !== 'anthropic')];
}

export class AllProvidersFailedError extends Error {
  readonly failures: { provider: ProviderName; kind: string; message: string }[];
  constructor(failures: { provider: ProviderName; kind: string; message: string }[]) {
    super(
      failures.length
        ? `All AI providers failed: ${failures.map((f) => `${f.provider}(${f.kind})`).join(', ')}`
        : 'No AI provider is configured'
    );
    this.name = 'AllProvidersFailedError';
    this.failures = failures;
  }
}

/**
 * Runs the cascade and returns the first success.
 *
 * Skips providers with no API key configured rather than counting them as
 * failures — an unset key is a deployment choice, not an outage, and treating
 * it as a failure would make the logs useless for spotting real problems.
 */
export async function route(
  messages: ChatTurn[],
  options: RouteOptions
): Promise<RouteResult> {
  const providers = cascadeFor(options);
  const failures: { provider: ProviderName; kind: string; message: string }[] = [];
  let attempts = 0;

  for (const provider of providers) {
    if (!provider.isConfigured()) continue;

    attempts++;
    const startedAt = Date.now();

    try {
      const result = await provider.call(messages, options);

      recordAttempt({
        userId: options.userId,
        requestId: options.requestId,
        task: options.task,
        provider: provider.name,
        model: result.model,
        outcome: 'success',
        latencyMs: Date.now() - startedAt,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
      });

      return { ...result, provider: provider.name, attempts };
    } catch (err) {
      const perr =
        err instanceof ProviderError
          ? err
          : new ProviderError('temporary', provider.name, String(err));

      const fatal = !perr.shouldFallback;

      recordAttempt({
        userId: options.userId,
        requestId: options.requestId,
        task: options.task,
        provider: provider.name,
        model: provider.model(),
        outcome: fatal ? 'fatal_failure' : 'retryable_failure',
        httpStatus: perr.httpStatus,
        latencyMs: Date.now() - startedAt,
        fallbackReason: perr.kind,
      });

      // An invalid request or a caller cancellation cannot be fixed by trying
      // somewhere else — surface it immediately instead of burning the rest of
      // the cascade on a request that can never succeed.
      if (fatal) throw perr;

      failures.push({ provider: provider.name, kind: perr.kind, message: perr.message });
    }
  }

  throw new AllProvidersFailedError(failures);
}
