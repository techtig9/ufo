import { z } from 'zod';

/**
 * Extraction, repair and schema validation for AI JSON responses.
 *
 * The previous code did `JSON.parse(extractJson(text))` with no schema check,
 * so a model that returned valid JSON of the wrong shape produced a project
 * whose screens were `undefined` — surfacing much later as a confusing
 * database or render error rather than as "the generator returned something
 * unusable". Everything is validated at the boundary now.
 */

/** Strips markdown fences and any prose the model wrapped the JSON in. */
export function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced ? fenced[1] : text).trim();

  // Some models prepend a sentence before the JSON. Fall back to the outermost
  // balanced object/array rather than failing the whole generation over it.
  if (!candidate.startsWith('{') && !candidate.startsWith('[')) {
    const firstBrace = candidate.search(/[{[]/);
    if (firstBrace !== -1) {
      const lastBrace = Math.max(candidate.lastIndexOf('}'), candidate.lastIndexOf(']'));
      if (lastBrace > firstBrace) return candidate.slice(firstBrace, lastBrace + 1);
    }
  }
  return candidate;
}

/**
 * Best-effort repair of the malformations models actually produce.
 * Conservative on purpose: only unambiguous fixes, never anything that could
 * silently change the meaning of a valid document.
 */
export function repairJson(text: string): string {
  return text
    // Trailing comma before a close brace/bracket.
    .replace(/,(\s*[}\]])/g, '$1')
    // A stray "+" string concatenation some models emit between fragments.
    .replace(/"\s*\+\s*"/g, '')
    .trim();
}

export class AiResponseError extends Error {
  readonly stage: 'parse' | 'schema';
  readonly detail: string;
  constructor(stage: 'parse' | 'schema', detail: string) {
    super(`AI response failed ${stage} validation: ${detail}`);
    this.name = 'AiResponseError';
    this.stage = stage;
    this.detail = detail;
  }
}

/**
 * Parses and schema-validates, attempting a repair pass before giving up.
 * Throws AiResponseError, which callers treat as a failed generation — and
 * therefore refund.
 */
export function parseAiJson<T>(raw: string, schema: z.ZodType<T>): T {
  const candidate = extractJson(raw);

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    try {
      parsed = JSON.parse(repairJson(candidate));
    } catch (err) {
      throw new AiResponseError('parse', err instanceof Error ? err.message : String(err));
    }
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new AiResponseError(
      'schema',
      `${issue?.path.join('.') || '(root)'}: ${issue?.message ?? 'invalid shape'}`
    );
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Schemas for the generator's own output. These mirror lib/types.ts, which the
// rest of the app already assumes — the point is to make the model prove it
// before anything downstream trusts it.
// ---------------------------------------------------------------------------

export const designTokensSchema = z.object({
  colors: z.object({
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
    background: z.string(),
    text: z.string(),
  }),
  fonts: z.object({ display: z.string(), body: z.string() }),
  spacing: z.object({ scale: z.array(z.number()) }).default({ scale: [4, 8, 12, 16, 24, 32, 48, 64] }),
});

export const hotspotSchema = z.object({
  selector: z.string(),
  label: z.string(),
  linksToScreenName: z.string().nullable().optional(),
});

export const generatedScreenSchema = z.object({
  name: z.string().min(1),
  orderIndex: z.number().int().nonnegative().default(0),
  // A screen with no markup is a failed generation, not a valid empty screen.
  code: z.string().min(1),
  hotspots: z.array(hotspotSchema).default([]),
});

export const generatedProjectSchema = z.object({
  tokens: designTokensSchema,
  screens: z.array(generatedScreenSchema).min(1),
});

export type ValidatedProject = z.infer<typeof generatedProjectSchema>;
