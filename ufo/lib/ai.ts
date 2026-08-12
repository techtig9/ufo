import Anthropic from '@anthropic-ai/sdk';
import type { FollowUpAnswers, GeneratedProject } from './types';

// Model names are env-configurable on purpose — verify current model names
// and pricing for each provider before shipping; they change over time.
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const CEREBRAS_MODEL = process.env.CEREBRAS_MODEL || 'llama-3.3-70b';
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct';
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5';

interface ChatTurn {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Strips ```json fences etc. so JSON.parse doesn't choke on markdown wrapping. */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}

// ---------------------------------------------------------------------------
// Simple-task cascade: Groq -> Cerebras -> OpenRouter.
// Falls back ONLY on a 429 (rate limit). Any other error — bad key, bad
// request — surfaces immediately instead of silently retrying three
// providers against the same broken request.
// ---------------------------------------------------------------------------

class RateLimitError extends Error {}

async function callOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  messages: ChatTurn[],
  jsonMode: boolean
): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (res.status === 429) {
    throw new RateLimitError(`${baseUrl} rate limit hit`);
  }
  if (!res.ok) {
    throw new Error(`${baseUrl} request failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const content: string | undefined = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`${baseUrl} returned no content`);
  return content;
}

async function callGroq(messages: ChatTurn[], jsonMode: boolean): Promise<string> {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is not set');
  return callOpenAICompatible('https://api.groq.com/openai/v1', process.env.GROQ_API_KEY, GROQ_MODEL, messages, jsonMode);
}

async function callCerebras(messages: ChatTurn[], jsonMode: boolean): Promise<string> {
  if (!process.env.CEREBRAS_API_KEY) throw new Error('CEREBRAS_API_KEY is not set');
  return callOpenAICompatible('https://api.cerebras.ai/v1', process.env.CEREBRAS_API_KEY, CEREBRAS_MODEL, messages, jsonMode);
}

async function callOpenRouter(messages: ChatTurn[], jsonMode: boolean): Promise<string> {
  if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is not set');
  // response_format support varies by underlying OpenRouter model, so it's
  // not passed here — extractJson() is the safety net either way.
  return callOpenAICompatible('https://openrouter.ai/api/v1', process.env.OPENROUTER_API_KEY, OPENROUTER_MODEL, messages, false);
}

async function callSimple(systemPrompt: string, messages: ChatTurn[], jsonMode = false): Promise<string> {
  const full: ChatTurn[] = [{ role: 'system', content: systemPrompt }, ...messages];

  try {
    return await callGroq(full, jsonMode);
  } catch (err) {
    if (!(err instanceof RateLimitError)) throw err;
    console.warn('[ai] Groq rate limit hit — falling back to Cerebras');
  }

  try {
    return await callCerebras(full, jsonMode);
  } catch (err) {
    if (!(err instanceof RateLimitError)) throw err;
    console.warn('[ai] Cerebras rate limit hit — falling back to OpenRouter');
  }

  return callOpenRouter(full, jsonMode);
}

// ---------------------------------------------------------------------------
// Complex/big tasks: straight to Claude Sonnet 5, no cascade — this is the
// direct replacement for the old Gemini premium-model tier.
// ---------------------------------------------------------------------------

function anthropicClient() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set');
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

async function callComplex(systemPrompt: string, userPrompt: string): Promise<string> {
  const client = anthropicClient();
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 8000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });
  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') throw new Error('Claude returned no text content');
  return textBlock.text;
}

// ---------------------------------------------------------------------------
// Public API — same names/signatures as the old lib/gemini.ts.
// ---------------------------------------------------------------------------

const SYSTEM_INSTRUCTION = `You are ufo's design generation engine. You output a complete,
production-quality multi-screen UI as static HTML with Tailwind CSS classes only — no build
step, no framework runtime. Real spacing, real visual hierarchy, a coherent palette. Never use
lorem-ipsum-looking placeholder blocks; write believable, specific copy for the product described.
Every screen must share one design system (same color tokens, font tokens, spacing scale).
Tag interactive elements that should link screens together with a
data-hotspot="<target screen name>" attribute so the prototype viewer can wire up click-through
navigation. Respond with ONLY valid JSON matching the requested schema — no prose, no markdown
fences.`;

function buildGenerationPrompt(projectName: string, description: string, answers: FollowUpAnswers): string {
  return `Generate a complete multi-screen UI/UX design.

Project name: ${projectName}
Description: ${description}
Project type: ${answers.projectType}
Target device(s): ${answers.targetDevices.join(', ')}
Design style: ${answers.designStyle}
Core screens: ${answers.coreScreens.join(', ')}
Navigation pattern: ${answers.navigationPattern}
Color theme: ${answers.colorTheme.brandHex ?? answers.colorTheme.preset ?? 'designer\u2019s choice, matching the style above'}
Font pairing: ${answers.fontPairing}

Return JSON exactly matching this TypeScript shape:
{
  "tokens": {
    "colors": { "primary": "#hex", "secondary": "#hex", "accent": "#hex", "background": "#hex", "text": "#hex" },
    "fonts": { "display": "Font Name", "body": "Font Name" },
    "spacing": { "scale": [number, ...] }
  },
  "screens": [
    {
      "name": "Home",
      "orderIndex": 0,
      "code": "<full HTML document body content using Tailwind classes>",
      "hotspots": [{ "selector": "data-hotspot attribute value", "label": "Get Started", "linksToScreenName": "Onboarding" }]
    }
  ]
}

Produce every screen listed in Core Screens above, fully linked via hotspots where navigation
between them makes sense.`;
}

export async function generateFullProject(
  projectName: string,
  description: string,
  answers: FollowUpAnswers
): Promise<GeneratedProject> {
  const text = await callComplex(SYSTEM_INSTRUCTION, buildGenerationPrompt(projectName, description, answers));
  return JSON.parse(extractJson(text)) as GeneratedProject;
}

export async function generateNewScreen(
  existingTokens: GeneratedProject['tokens'],
  screenName: string,
  context: string
): Promise<GeneratedProject['screens'][number]> {
  const prompt = `Add one new screen to an existing project. Reuse these exact design tokens —
do not invent new ones: ${JSON.stringify(existingTokens)}

New screen: ${screenName}
Context: ${context}

Return JSON for a single screen matching:
{ "name": "...", "orderIndex": 0, "code": "...", "hotspots": [...] }`;

  const text = await callComplex(SYSTEM_INSTRUCTION, prompt);
  return JSON.parse(extractJson(text));
}

export async function generateComponent(instruction: string, screenCode: string): Promise<string> {
  const prompt = `Given this screen's current HTML/Tailwind code:\n\n${screenCode}\n\nApply this
change and return ONLY the full updated HTML (no JSON, no markdown fences): ${instruction}`;

  const text = await callSimple('You edit HTML/Tailwind screen code precisely per instruction.', [
    { role: 'user', content: prompt },
  ]);
  return text.trim();
}

export async function changeTheme(
  currentTokens: GeneratedProject['tokens'],
  instruction: string
): Promise<GeneratedProject['tokens']> {
  const prompt = `Current design tokens: ${JSON.stringify(currentTokens)}
Change requested: ${instruction}
Return ONLY the updated tokens JSON, same shape as the input.`;

  const text = await callSimple(
    'You update design-token JSON precisely per instruction. Respond with ONLY valid JSON.',
    [{ role: 'user', content: prompt }],
    true
  );
  return JSON.parse(extractJson(text));
}

/**
 * Voice input transcription — Groq's Whisper endpoint specifically, not the
 * chat-completions cascade above (Cerebras/OpenRouter don't do audio, so
 * there's no fallback chain for this one call).
 */
export async function transcribeVoice(audioBase64: string, mimeType: string): Promise<string> {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is not set');

  const audioBuffer = Buffer.from(audioBase64, 'base64');
  const form = new FormData();
  form.append('file', new Blob([audioBuffer], { type: mimeType }), 'audio');
  form.append('model', 'whisper-large-v3');

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: form,
  });

  if (!res.ok) throw new Error(`Groq transcription failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return (data.text ?? '').trim();
}

export async function importAndRedesign(
  sourceDescription: string,
  redesignInstruction: string,
  answers: FollowUpAnswers
): Promise<GeneratedProject> {
  const prompt = `Analyze this existing design and redesign/extend it.

Existing design source: ${sourceDescription}
Redesign/extend instruction: ${redesignInstruction}
Target device(s): ${answers.targetDevices.join(', ')}
Design style: ${answers.designStyle}
Core screens: ${answers.coreScreens.join(', ')}

Return the same JSON shape used for full project generation (tokens + screens with hotspots).`;

  const text = await callComplex(SYSTEM_INSTRUCTION, prompt);
  return JSON.parse(extractJson(text));
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export async function chatWithAssistant(systemContext: string, history: ChatMessage[]): Promise<string> {
  const turns: ChatTurn[] = history.map((m) => ({
    role: m.role === 'model' ? 'assistant' : 'user',
    content: m.text,
  }));
  const text = await callSimple(systemContext, turns);
  return text.trim();
}
