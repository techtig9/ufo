import { GoogleGenerativeAI } from '@google/generative-ai';
import type { FollowUpAnswers, GeneratedProject } from './types';

// Intelligent AI Routing: premium model for expensive/structural generation,
// a lower-cost model for cheap edits — see "AI Cost Optimisation" in the
// Pricing Plans & Cost Optimisation Strategy section of the build doc.
// Model names are env-configurable on purpose: verify current Gemini model
// names/pricing before shipping, they change over time.
const PREMIUM_MODEL = process.env.GEMINI_PREMIUM_MODEL || 'gemini-1.5-pro';
const FLASH_MODEL = process.env.GEMINI_FLASH_MODEL || 'gemini-1.5-flash';

function client() {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set');
  }
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

/** Strips ```json fences etc. so JSON.parse doesn't choke on markdown wrapping. */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
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

function buildGenerationPrompt(
  projectName: string,
  description: string,
  answers: FollowUpAnswers
): string {
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
  const genAI = client();
  const model = genAI.getGenerativeModel({
    model: PREMIUM_MODEL,
    systemInstruction: SYSTEM_INSTRUCTION,
  });

  const result = await model.generateContent(
    buildGenerationPrompt(projectName, description, answers)
  );
  const parsed = JSON.parse(extractJson(result.response.text())) as GeneratedProject;
  return parsed;
}

export async function generateNewScreen(
  existingTokens: GeneratedProject['tokens'],
  screenName: string,
  context: string
): Promise<GeneratedProject['screens'][number]> {
  const genAI = client();
  const model = genAI.getGenerativeModel({
    model: PREMIUM_MODEL, // reuses the project's design system, still worth premium quality
    systemInstruction: SYSTEM_INSTRUCTION,
  });

  const prompt = `Add one new screen to an existing project. Reuse these exact design tokens —
do not invent new ones: ${JSON.stringify(existingTokens)}

New screen: ${screenName}
Context: ${context}

Return JSON for a single screen matching:
{ "name": "...", "orderIndex": 0, "code": "...", "hotspots": [...] }`;

  const result = await model.generateContent(prompt);
  return JSON.parse(extractJson(result.response.text()));
}

export async function generateComponent(instruction: string, screenCode: string): Promise<string> {
  const genAI = client();
  const model = genAI.getGenerativeModel({ model: FLASH_MODEL });

  const prompt = `Given this screen's current HTML/Tailwind code:\n\n${screenCode}\n\nApply this
change and return ONLY the full updated HTML (no JSON, no markdown fences): ${instruction}`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

export async function changeTheme(
  currentTokens: GeneratedProject['tokens'],
  instruction: string
): Promise<GeneratedProject['tokens']> {
  const genAI = client();
  const model = genAI.getGenerativeModel({ model: FLASH_MODEL });

  const prompt = `Current design tokens: ${JSON.stringify(currentTokens)}
Change requested: ${instruction}
Return ONLY the updated tokens JSON, same shape as the input.`;

  const result = await model.generateContent(prompt);
  return JSON.parse(extractJson(result.response.text()));
}

/**
 * Voice input transcription — only called on sessions that actually use
 * voice input (paid tiers only). A text-only session never triggers this.
 */
export async function transcribeVoice(audioBase64: string, mimeType: string): Promise<string> {
  const genAI = client();
  const model = genAI.getGenerativeModel({ model: FLASH_MODEL });

  const result = await model.generateContent([
    { inlineData: { data: audioBase64, mimeType } },
    { text: 'Transcribe this audio exactly. Return only the transcript text.' },
  ]);
  return result.response.text().trim();
}

/**
 * Import & redesign: analyzes a URL/screenshot/Figma link description and
 * produces a full project, same shape as generateFullProject. Kept
 * separate because it's a heavier premium-model call (extra analysis pass)
 * and costs more credits — see CREDIT_COSTS.import_redesign.
 */
export async function importAndRedesign(
  sourceDescription: string,
  redesignInstruction: string,
  answers: FollowUpAnswers
): Promise<GeneratedProject> {
  const genAI = client();
  const model = genAI.getGenerativeModel({
    model: PREMIUM_MODEL,
    systemInstruction: SYSTEM_INSTRUCTION,
  });

  const prompt = `Analyze this existing design and redesign/extend it.

Existing design source: ${sourceDescription}
Redesign/extend instruction: ${redesignInstruction}
Target device(s): ${answers.targetDevices.join(', ')}
Design style: ${answers.designStyle}
Core screens: ${answers.coreScreens.join(', ')}

Return the same JSON shape used for full project generation (tokens + screens with hotspots).`;

  const result = await model.generateContent(prompt);
  return JSON.parse(extractJson(result.response.text()));
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

/**
 * Advisory chat (the "Compass" widget) — help deciding between plans,
 * whether a feature fits, etc. Always the cheap model: this is a text
 * conversation, not structural generation, and it's the one AI surface a
 * signed-out visitor's curiosity could otherwise turn into unbounded cost
 * if it were routed to the premium model.
 */
export async function chatWithAssistant(
  systemContext: string,
  history: ChatMessage[]
): Promise<string> {
  const genAI = client();
  const model = genAI.getGenerativeModel({
    model: FLASH_MODEL,
    systemInstruction: systemContext,
  });

  const chat = model.startChat({
    history: history.slice(0, -1).map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
  });

  const last = history[history.length - 1];
  const result = await chat.sendMessage(last.text);
  return result.response.text().trim();
}
