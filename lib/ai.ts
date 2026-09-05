import type { FollowUpAnswers, GeneratedProject } from './types';
import { route, type RouteOptions } from './ai/router';
import { parseAiJson, generatedProjectSchema, generatedScreenSchema, designTokensSchema } from './ai/json';
import type { ChatTurn } from './ai/providers';

/**
 * Public AI surface.
 *
 * The exported function names and signatures are unchanged from before Phase 2
 * — every existing call site keeps working. What changed is underneath: all of
 * these now go through lib/ai/router, which implements the Groq -> Cerebras ->
 * OpenRouter -> Claude cascade, falls back only on retryable conditions, logs
 * every attempt, and schema-validates whatever comes back.
 */

export type { ChatTurn };

/** Optional per-call context. Defaults keep old call sites working unchanged. */
export interface AiCallContext {
  requestId?: string;
  userId?: string;
  signal?: AbortSignal;
}

function ctx(task: string, c: AiCallContext | undefined, preferHighQuality: boolean): RouteOptions {
  return {
    task,
    requestId: c?.requestId ?? crypto.randomUUID().slice(0, 8),
    userId: c?.userId,
    signal: c?.signal,
    preferHighQuality,
  };
}

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
Color theme: ${answers.colorTheme.brandHex ?? answers.colorTheme.preset ?? 'designer’s choice, matching the style above'}
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
  answers: FollowUpAnswers,
  context?: AiCallContext
): Promise<GeneratedProject> {
  const { text } = await route(
    [
      { role: 'system', content: SYSTEM_INSTRUCTION },
      { role: 'user', content: buildGenerationPrompt(projectName, description, answers) },
    ],
    { ...ctx('generate_full_project', context, true), jsonMode: true, maxTokens: 8000 }
  );
  return parseAiJson(text, generatedProjectSchema) as GeneratedProject;
}

export async function generateNewScreen(
  existingTokens: GeneratedProject['tokens'],
  screenName: string,
  screenContext: string,
  context?: AiCallContext
): Promise<GeneratedProject['screens'][number]> {
  const prompt = `Add one new screen to an existing project. Reuse these exact design tokens —
do not invent new ones: ${JSON.stringify(existingTokens)}

New screen: ${screenName}
Context: ${screenContext}

Return JSON for a single screen matching:
{ "name": "...", "orderIndex": 0, "code": "...", "hotspots": [...] }`;

  const { text } = await route(
    [
      { role: 'system', content: SYSTEM_INSTRUCTION },
      { role: 'user', content: prompt },
    ],
    { ...ctx('generate_screen', context, true), jsonMode: true, maxTokens: 4000 }
  );
  return parseAiJson(text, generatedScreenSchema) as GeneratedProject['screens'][number];
}

export async function generateComponent(
  instruction: string,
  screenCode: string,
  context?: AiCallContext
): Promise<string> {
  const prompt = `Given this screen's current HTML/Tailwind code:\n\n${screenCode}\n\nApply this
change and return ONLY the full updated HTML (no JSON, no markdown fences): ${instruction}`;

  const { text } = await route(
    [
      { role: 'system', content: 'You edit HTML/Tailwind screen code precisely per instruction.' },
      { role: 'user', content: prompt },
    ],
    { ...ctx('generate_component', context, false), maxTokens: 8000 }
  );
  return text.trim();
}

export async function changeTheme(
  currentTokens: GeneratedProject['tokens'],
  instruction: string,
  context?: AiCallContext
): Promise<GeneratedProject['tokens']> {
  const prompt = `Current design tokens: ${JSON.stringify(currentTokens)}
Change requested: ${instruction}
Return ONLY the updated tokens JSON, same shape as the input.`;

  const { text } = await route(
    [
      {
        role: 'system',
        content: 'You update design-token JSON precisely per instruction. Respond with ONLY valid JSON.',
      },
      { role: 'user', content: prompt },
    ],
    { ...ctx('change_theme', context, false), jsonMode: true, maxTokens: 1000 }
  );
  return parseAiJson(text, designTokensSchema) as GeneratedProject['tokens'];
}

export async function importAndRedesign(
  sourceDescription: string,
  redesignInstruction: string,
  answers: FollowUpAnswers,
  context?: AiCallContext
): Promise<GeneratedProject> {
  const prompt = `Analyze this existing design and redesign/extend it.

Existing design source: ${sourceDescription}
Redesign/extend instruction: ${redesignInstruction}
Target device(s): ${answers.targetDevices.join(', ')}
Design style: ${answers.designStyle}
Core screens: ${answers.coreScreens.join(', ')}

Return the same JSON shape used for full project generation (tokens + screens with hotspots).`;

  const { text } = await route(
    [
      { role: 'system', content: SYSTEM_INSTRUCTION },
      { role: 'user', content: prompt },
    ],
    { ...ctx('import_redesign', context, true), jsonMode: true, maxTokens: 8000 }
  );
  return parseAiJson(text, generatedProjectSchema) as GeneratedProject;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export async function chatWithAssistant(
  systemContext: string,
  history: ChatMessage[],
  context?: AiCallContext
): Promise<string> {
  const turns: ChatTurn[] = [
    { role: 'system', content: systemContext },
    ...history.map((m) => ({
      role: (m.role === 'model' ? 'assistant' : 'user') as 'assistant' | 'user',
      content: m.text,
    })),
  ];

  const { text } = await route(turns, { ...ctx('chat', context, false), maxTokens: 2000 });
  return text.trim();
}

/**
 * Voice transcription — Groq's Whisper endpoint specifically, not the chat
 * cascade. Cerebras and OpenRouter do not expose an audio endpoint, so there is
 * genuinely nothing to fall back to; this stays a single-provider call rather
 * than pretending otherwise.
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
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) throw new Error(`Groq transcription failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return (data.text ?? '').trim();
}
