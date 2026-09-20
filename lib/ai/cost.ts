/**
 * Token cost estimation, for the budget cap.
 *
 * IMPORTANT: these rates are a CONFIGURATION, not a fact this code can know.
 * Provider pricing changes, and it changes without notifying your codebase.
 * The defaults below were the published list prices for the default models at
 * the time this was written; they are overridable per model through
 * `AI_RATE_<MODEL>` (see `rateFor`), and `docs/UNIT_ECONOMICS.md` tells the
 * operator to re-check them.
 *
 * Because the numbers can be stale, every design decision here errs towards
 * OVER-estimating spend:
 *
 *   - an unknown model is billed at the most expensive known rate, not at zero
 *     or an average. A budget cap that under-counts is a budget cap that does
 *     not exist.
 *   - a request with no token counts (a provider that omits usage, or a
 *     failure after dispatch) is billed at a nominal floor rather than free.
 *
 * Rates are USD per MILLION tokens.
 */
export interface ModelRate {
  inputPerMillion: number;
  outputPerMillion: number;
}

const DEFAULT_RATES: Record<string, ModelRate> = {
  // Open-weight 70B class, served by the fast inference providers.
  'llama-3.3-70b-versatile': { inputPerMillion: 0.59, outputPerMillion: 0.79 },
  'llama-3.3-70b': { inputPerMillion: 0.85, outputPerMillion: 1.2 },
  'meta-llama/llama-3.3-70b-instruct': { inputPerMillion: 0.6, outputPerMillion: 0.6 },
  // Frontier fallback — the expensive end of the cascade, and the reason a cap
  // matters: a Groq outage silently promotes every request to this tier.
  'claude-fable-5': { inputPerMillion: 3, outputPerMillion: 15 },
};

/** The most expensive rate we know of, used for models we do not recognise. */
const WORST_KNOWN: ModelRate = Object.values(DEFAULT_RATES).reduce(
  (worst, rate) => ({
    inputPerMillion: Math.max(worst.inputPerMillion, rate.inputPerMillion),
    outputPerMillion: Math.max(worst.outputPerMillion, rate.outputPerMillion),
  }),
  { inputPerMillion: 0, outputPerMillion: 0 }
);

/**
 * A request whose token usage the provider did not report still costs money.
 * Charged as if it were a small call rather than a free one.
 */
const UNKNOWN_USAGE_TOKENS = { prompt: 1000, completion: 1000 };

function envOverride(model: string): ModelRate | null {
  // AI_RATE_<MODEL> as "input,output" in USD per million, e.g.
  // AI_RATE_LLAMA_3_3_70B_VERSATILE="0.59,0.79"
  const key = `AI_RATE_${model.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
  const raw = process.env[key];
  if (!raw) return null;

  const [input, output] = raw.split(',').map((v) => Number(v.trim()));
  if (!Number.isFinite(input) || !Number.isFinite(output) || input < 0 || output < 0) return null;
  return { inputPerMillion: input, outputPerMillion: output };
}

export function rateFor(model: string | null | undefined): ModelRate {
  if (!model) return WORST_KNOWN;
  return envOverride(model) ?? DEFAULT_RATES[model] ?? WORST_KNOWN;
}

/** True when the model is priced by a real entry rather than the worst-case default. */
export function isKnownModel(model: string | null | undefined): boolean {
  return Boolean(model && (envOverride(model) !== null || model in DEFAULT_RATES));
}

export function estimateCostUsd(
  model: string | null | undefined,
  promptTokens: number | null | undefined,
  completionTokens: number | null | undefined
): number {
  const rate = rateFor(model);
  const prompt = promptTokens ?? UNKNOWN_USAGE_TOKENS.prompt;
  const completion = completionTokens ?? UNKNOWN_USAGE_TOKENS.completion;

  return (
    (prompt / 1_000_000) * rate.inputPerMillion +
    (completion / 1_000_000) * rate.outputPerMillion
  );
}
