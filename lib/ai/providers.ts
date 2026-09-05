import { ProviderError, classifyHttpStatus, classifyThrown } from './errors';

/**
 * Provider definitions and the raw call for each.
 *
 * Model names stay env-configurable, as they were before — provider model
 * names change, and pinning them in code means a rename becomes a deploy.
 */

export type ProviderName = 'groq' | 'cerebras' | 'openrouter' | 'anthropic';

export interface ChatTurn {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CallOptions {
  jsonMode?: boolean;
  maxTokens?: number;
  /** Per-attempt budget. Each provider gets its own, not a shared deadline. */
  timeoutMs?: number;
  /** Caller-supplied cancellation (a closed browser tab, a route abort). */
  signal?: AbortSignal;
}

export interface CallResult {
  text: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
}

export interface Provider {
  name: ProviderName;
  model(): string;
  isConfigured(): boolean;
  call(messages: ChatTurn[], options: CallOptions): Promise<CallResult>;
}

const DEFAULT_TIMEOUT_MS = 90_000;

/**
 * Combines our per-attempt timeout with any caller cancellation, so a provider
 * that hangs cannot pin the whole cascade and a caller that goes away stops the
 * work immediately.
 */
function withTimeout(timeoutMs: number, signal?: AbortSignal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeoutMs);

  const onAbort = () => controller.abort(new Error('cancelled'));
  if (signal) {
    if (signal.aborted) controller.abort(new Error('cancelled'));
    else signal.addEventListener('abort', onAbort, { once: true });
  }

  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    },
  };
}

/** Shared implementation for the three OpenAI-compatible providers. */
async function callOpenAICompatible(
  provider: ProviderName,
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: ChatTurn[],
  options: CallOptions
): Promise<CallResult> {
  const { signal, cleanup } = withTimeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, options.signal);

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
        ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal,
    });

    if (!res.ok) {
      // The body often names the real cause (expired key, unknown model) and
      // is worth carrying into the log, but it is truncated so a provider
      // cannot bloat our logs.
      const body = (await res.text().catch(() => '')).slice(0, 500);
      throw new ProviderError(
        classifyHttpStatus(res.status),
        provider,
        `${provider} ${res.status}: ${body}`,
        res.status
      );
    }

    const data = await res.json();
    const text: string | undefined = data.choices?.[0]?.message?.content;
    if (!text) {
      throw new ProviderError('bad_response', provider, `${provider} returned no content`);
    }

    return {
      text,
      model,
      promptTokens: data.usage?.prompt_tokens,
      completionTokens: data.usage?.completion_tokens,
    };
  } catch (err) {
    if (err instanceof ProviderError) throw err;
    // Distinguish our timeout from the caller cancelling: the first should
    // fall through to the next provider, the second must stop the cascade.
    if (err instanceof Error && err.name === 'AbortError') {
      const cancelled = options.signal?.aborted;
      throw new ProviderError(
        cancelled ? 'cancelled' : 'timeout',
        provider,
        cancelled ? `${provider} call cancelled by caller` : `${provider} timed out`
      );
    }
    throw new ProviderError(classifyThrown(err), provider, `${provider}: ${String(err)}`);
  } finally {
    cleanup();
  }
}

function makeOpenAICompatible(
  name: ProviderName,
  baseUrl: string,
  envKey: string,
  modelEnv: string,
  defaultModel: string,
  /** OpenRouter's json-mode support varies by underlying model. */
  supportsJsonMode = true
): Provider {
  return {
    name,
    model: () => process.env[modelEnv] || defaultModel,
    isConfigured: () => !!process.env[envKey],
    call(messages, options) {
      const key = process.env[envKey];
      if (!key) {
        throw new ProviderError('auth', name, `${envKey} is not set`);
      }
      return callOpenAICompatible(
        name,
        baseUrl,
        key,
        process.env[modelEnv] || defaultModel,
        messages,
        supportsJsonMode ? options : { ...options, jsonMode: false }
      );
    },
  };
}

export const groq = makeOpenAICompatible(
  'groq',
  'https://api.groq.com/openai/v1',
  'GROQ_API_KEY',
  'GROQ_MODEL',
  'llama-3.3-70b-versatile'
);

export const cerebras = makeOpenAICompatible(
  'cerebras',
  'https://api.cerebras.ai/v1',
  'CEREBRAS_API_KEY',
  'CEREBRAS_MODEL',
  'llama-3.3-70b'
);

export const openrouter = makeOpenAICompatible(
  'openrouter',
  'https://openrouter.ai/api/v1',
  'OPENROUTER_API_KEY',
  'OPENROUTER_MODEL',
  'meta-llama/llama-3.3-70b-instruct',
  false
);

/** Anthropic uses its own message format, so it does not share the helper. */
export const anthropic: Provider = {
  name: 'anthropic',
  model: () => process.env.CLAUDE_MODEL || 'claude-fable-5',
  isConfigured: () => !!process.env.ANTHROPIC_API_KEY,

  async call(messages, options) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new ProviderError('auth', 'anthropic', 'ANTHROPIC_API_KEY is not set');

    const model = process.env.CLAUDE_MODEL || 'claude-fable-5';
    const { signal, cleanup } = withTimeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS, options.signal);

    // Anthropic takes the system prompt as a top-level field rather than a
    // message, so the turns are split rather than passed through.
    const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
    const rest = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model,
          max_tokens: options.maxTokens ?? 8000,
          ...(system ? { system } : {}),
          messages: rest,
        }),
        signal,
      });

      if (!res.ok) {
        const body = (await res.text().catch(() => '')).slice(0, 500);
        throw new ProviderError(
          classifyHttpStatus(res.status),
          'anthropic',
          `anthropic ${res.status}: ${body}`,
          res.status
        );
      }

      const data = await res.json();
      const block = data.content?.find((b: { type?: string }) => b.type === 'text');
      if (!block?.text) {
        throw new ProviderError('bad_response', 'anthropic', 'anthropic returned no text content');
      }

      return {
        text: block.text as string,
        model,
        promptTokens: data.usage?.input_tokens,
        completionTokens: data.usage?.output_tokens,
      };
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        const cancelled = options.signal?.aborted;
        throw new ProviderError(
          cancelled ? 'cancelled' : 'timeout',
          'anthropic',
          cancelled ? 'anthropic call cancelled by caller' : 'anthropic timed out'
        );
      }
      throw new ProviderError(classifyThrown(err), 'anthropic', `anthropic: ${String(err)}`);
    } finally {
      cleanup();
    }
  },
};

/**
 * The cascade required by the Master Command: Groq, then Cerebras, then
 * OpenRouter, then Claude.
 *
 * The previous behaviour differed in two ways. Simple tasks stopped at
 * OpenRouter and never reached Claude; complex tasks went straight to Claude
 * and never used the cheaper providers at all. Both are now one ordered list,
 * so cost falls to the cheapest provider that works while Claude remains the
 * last resort.
 */
export const PROVIDER_CASCADE: Provider[] = [groq, cerebras, openrouter, anthropic];
