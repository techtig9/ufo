/**
 * Provider error classification.
 *
 * The Master Command (2.A) is explicit about this: fall back only for
 * retryable conditions (429, quota/rate limit, temporary 5xx, timeout), and
 * NOT for an invalid API key, an invalid request, a schema error, or an
 * authorization failure that cannot succeed elsewhere.
 *
 * The distinction matters for cost and for diagnosis. The previous
 * implementation fell back on a bare `RateLimitError` only, so a malformed
 * request surfaced immediately (correct) — but an expired key on the first
 * provider also surfaced immediately instead of failing over (wrong), and a
 * 500 from a provider was fatal when it should have been retried elsewhere.
 * Conversely, falling back on everything would burn a request against all four
 * providers for a prompt that can never succeed, and would mask a bad key as a
 * generic outage.
 */

export type FailureKind =
  /** 429 or an explicit quota/rate-limit signal. Try the next provider. */
  | 'rate_limited'
  /** Provider-side 5xx or a transport error. Try the next provider. */
  | 'temporary'
  /** Request exceeded our timeout. Try the next provider. */
  | 'timeout'
  /** Caller aborted. Stop — this is not a failure to route around. */
  | 'cancelled'
  /** 401/403, or a missing key. The next provider may still work. */
  | 'auth'
  /** 400/422 — the request itself is wrong. No provider will accept it. */
  | 'invalid_request'
  /** Provider returned success but the body was unusable. */
  | 'bad_response';

export class ProviderError extends Error {
  readonly kind: FailureKind;
  readonly provider: string;
  readonly httpStatus?: number;

  constructor(
    kind: FailureKind,
    provider: string,
    message: string,
    httpStatus?: number
  ) {
    super(message);
    this.name = 'ProviderError';
    this.kind = kind;
    this.provider = provider;
    this.httpStatus = httpStatus;
  }

  /**
   * Whether to try the NEXT provider.
   *
   * `auth` is retryable across providers but not within one: a bad Groq key
   * says nothing about the Cerebras key, so failing over is right, while
   * retrying Groq is pointless.
   *
   * `invalid_request` is never retryable — the prompt or parameters are wrong,
   * so every provider will reject it identically and trying them all just
   * costs time and money.
   *
   * `cancelled` is never retryable: the caller has gone away.
   */
  get shouldFallback(): boolean {
    switch (this.kind) {
      case 'rate_limited':
      case 'temporary':
      case 'timeout':
      case 'auth':
      case 'bad_response':
        return true;
      case 'invalid_request':
      case 'cancelled':
        return false;
    }
  }
}

/** Classifies an HTTP response status from an OpenAI-compatible provider. */
export function classifyHttpStatus(status: number): FailureKind {
  if (status === 429) return 'rate_limited';
  if (status === 401 || status === 403) return 'auth';
  if (status === 400 || status === 422 || status === 404) return 'invalid_request';
  if (status >= 500) return 'temporary';
  return 'temporary';
}

/** Classifies a thrown fetch/transport error. */
export function classifyThrown(err: unknown): FailureKind {
  if (err instanceof ProviderError) return err.kind;
  if (err instanceof Error) {
    if (err.name === 'AbortError') return 'timeout';
    if (err.name === 'TimeoutError') return 'timeout';
  }
  // DNS failure, connection reset, TLS problem — all worth trying elsewhere.
  return 'temporary';
}
