import { z } from 'zod';
import type { CreditAction } from '../credits';
import { generatedScreenSchema, designTokensSchema } from './json';

/**
 * The AI action catalogue (Master Command 2.C).
 *
 * One data-driven definition per action rather than ten near-identical route
 * handlers. Several of these are the same operation seen through a different
 * lens — improve UX, improve copy, make responsive, fix accessibility all take
 * one screen and return one screen — so the differences that actually matter
 * (the instruction, the output shape, the price, the plan gate) are the only
 * things stated per action.
 *
 * `kind` drives what the route does with the result:
 *   screen_rewrite      -> returns replacement HTML for one screen
 *   new_screen          -> returns a whole new screen to append
 *   tokens              -> returns replacement design tokens
 *   analysis            -> returns findings; changes nothing
 *
 * Analyses deliberately do not mutate. A tool that silently rewrites your
 * screens when you asked it to audit them is not an audit.
 */

export type AiActionKind = 'screen_rewrite' | 'new_screen' | 'tokens' | 'analysis';

export type AiActionId =
  | 'regenerate_screen'
  | 'generate_screen'
  | 'change_theme'
  | 'improve_ux'
  | 'improve_copy'
  | 'make_responsive'
  | 'improve_accessibility'
  | 'audit_accessibility'
  | 'check_consistency'
  | 'extract_design_system';

/** A finding from one of the read-only analyses. */
export const findingSchema = z.object({
  severity: z.enum(['high', 'medium', 'low']),
  title: z.string().min(1),
  detail: z.string().min(1),
  /** Where in the screen, in plain language — models cannot be trusted with selectors. */
  location: z.string().optional(),
  suggestion: z.string().optional(),
});

export const analysisSchema = z.object({
  summary: z.string().min(1),
  findings: z.array(findingSchema).default([]),
});

export type Analysis = z.infer<typeof analysisSchema>;

/** The extracted design system is a document, not a set of findings. */
export const designSystemSchema = z.object({
  summary: z.string().min(1),
  colors: z.array(z.object({ name: z.string(), value: z.string(), usage: z.string().optional() })).default([]),
  typography: z.array(z.object({ name: z.string(), spec: z.string() })).default([]),
  spacing: z.array(z.string()).default([]),
  components: z
    .array(z.object({ name: z.string(), description: z.string(), variants: z.array(z.string()).default([]) }))
    .default([]),
});

export interface ActionContext {
  projectName: string;
  designStyle: string | null;
  colorTheme: unknown;
  fontPairing: string | null;
  /** The screen being acted on. Absent for project-wide actions. */
  screenName?: string;
  screenCode?: string;
  /** Every screen's name and code, for cross-screen analyses. */
  allScreens?: { name: string; code: string }[];
  /** Free-text detail from the user, where the action takes one. */
  instruction?: string;
  tokens?: unknown;
}

export interface AiActionDef {
  id: AiActionId;
  kind: AiActionKind;
  label: string;
  description: string;
  credit: CreditAction;
  /** Prefer Claude — used for the actions where output quality dominates cost. */
  highQuality: boolean;
  /** Whether the action needs a target screen. */
  needsScreen: boolean;
  /** Whether the user's free-text instruction is required. */
  needsInstruction: boolean;
  system: string;
  buildPrompt(ctx: ActionContext): string;
  /** Absent for screen_rewrite, whose output is raw HTML rather than JSON. */
  schema?: z.ZodTypeAny;
}

const HTML_SYSTEM = `You edit static HTML that uses Tailwind CSS utility classes only — no build
step, no framework runtime, no <script> tags. Preserve every existing data-hotspot attribute
unless explicitly asked to change navigation, because those wire up the clickable prototype.
Return ONLY the complete updated HTML for the screen body. No prose, no markdown fences.`;

const ANALYSIS_SYSTEM = `You are a senior product designer reviewing a UI. Be specific and
concrete: cite what you actually see in the markup rather than giving generic advice. Respond
with ONLY valid JSON matching the requested schema — no prose, no markdown fences.`;

function projectHeader(ctx: ActionContext): string {
  return `Project: ${ctx.projectName}
Design style: ${ctx.designStyle ?? 'not specified'}
Color tokens: ${JSON.stringify(ctx.colorTheme ?? {})}
Font pairing: ${ctx.fontPairing ?? 'not specified'}`;
}

const ANALYSIS_SHAPE = `{
  "summary": "one paragraph",
  "findings": [
    { "severity": "high|medium|low", "title": "...", "detail": "...", "location": "where in the screen", "suggestion": "what to change" }
  ]
}`;

export const AI_ACTIONS: Record<AiActionId, AiActionDef> = {
  regenerate_screen: {
    id: 'regenerate_screen',
    kind: 'screen_rewrite',
    label: 'Regenerate screen',
    description: 'Rebuild this screen from scratch, keeping the project’s design system.',
    credit: 'regenerate_screen',
    highQuality: true,
    needsScreen: true,
    needsInstruction: false,
    system: HTML_SYSTEM,
    buildPrompt: (ctx) => `${projectHeader(ctx)}

Rebuild the "${ctx.screenName}" screen from scratch. Keep the same purpose and the same
navigation targets, but improve the layout, hierarchy and copy. Reuse the project's existing
colour and font tokens exactly — do not invent a new palette.

${ctx.instruction ? `Additional direction from the user: ${ctx.instruction}\n` : ''}
Current version, for reference:
${ctx.screenCode}`,
  },

  generate_screen: {
    id: 'generate_screen',
    kind: 'new_screen',
    label: 'Generate a new screen',
    description: 'Add a screen to this project using the existing design system.',
    credit: 'generate_screen',
    highQuality: true,
    needsScreen: false,
    needsInstruction: true,
    system: `You design one screen of a multi-screen prototype as static HTML with Tailwind
classes. Reuse the supplied design tokens exactly. Respond with ONLY valid JSON — no prose,
no markdown fences.`,
    buildPrompt: (ctx) => `${projectHeader(ctx)}

Existing screens: ${(ctx.allScreens ?? []).map((s) => s.name).join(', ') || 'none yet'}

Add one new screen described as: ${ctx.instruction}

Return JSON matching:
{ "name": "...", "orderIndex": 0, "code": "<html body content>", "hotspots": [{ "selector": "...", "label": "...", "linksToScreenName": "..." }] }`,
    schema: generatedScreenSchema,
  },

  change_theme: {
    id: 'change_theme',
    kind: 'tokens',
    label: 'Change the theme',
    description: 'Rework the project’s colour and font tokens.',
    credit: 'change_theme',
    highQuality: false,
    needsScreen: false,
    needsInstruction: true,
    system: 'You update design-token JSON precisely per instruction. Respond with ONLY valid JSON.',
    buildPrompt: (ctx) => `Current design tokens: ${JSON.stringify(ctx.tokens ?? {})}
Change requested: ${ctx.instruction}
Return ONLY the updated tokens JSON, same shape as the input.`,
    schema: designTokensSchema,
  },

  improve_ux: {
    id: 'improve_ux',
    kind: 'screen_rewrite',
    label: 'Improve the UX',
    description: 'Tighten hierarchy, flow and affordances on this screen.',
    credit: 'improve_ux',
    highQuality: true,
    needsScreen: true,
    needsInstruction: false,
    system: HTML_SYSTEM,
    buildPrompt: (ctx) => `${projectHeader(ctx)}

Improve the user experience of the "${ctx.screenName}" screen. Focus on visual hierarchy, the
clarity of the primary action, grouping and spacing, empty and error affordances, and reducing
anything that competes with the main task. Keep the same content and purpose — this is a
refinement, not a redesign.

${ctx.instruction ? `The user specifically wants: ${ctx.instruction}\n` : ''}
Current screen:
${ctx.screenCode}`,
  },

  improve_copy: {
    id: 'improve_copy',
    kind: 'screen_rewrite',
    label: 'Improve the copy',
    description: 'Rewrite the words without touching the layout.',
    credit: 'improve_copy',
    highQuality: false,
    needsScreen: true,
    needsInstruction: false,
    system: HTML_SYSTEM,
    buildPrompt: (ctx) => `${projectHeader(ctx)}

Rewrite the copy on the "${ctx.screenName}" screen: headings, body text, button labels, empty
states and helper text. Make it specific and believable for this product — no lorem ipsum, no
generic filler, no exclamation marks. Keep every element, class and attribute exactly as it is;
change ONLY the text content.

${ctx.instruction ? `Tone/direction requested: ${ctx.instruction}\n` : ''}
Current screen:
${ctx.screenCode}`,
  },

  make_responsive: {
    id: 'make_responsive',
    kind: 'screen_rewrite',
    label: 'Make it responsive',
    description: 'Add responsive behaviour across mobile, tablet and desktop.',
    credit: 'make_responsive',
    highQuality: false,
    needsScreen: true,
    needsInstruction: false,
    system: HTML_SYSTEM,
    buildPrompt: (ctx) => `${projectHeader(ctx)}

Make the "${ctx.screenName}" screen work at every width from 320px up. Use Tailwind's responsive
prefixes (sm:, md:, lg:, xl:). Requirements: no horizontal scrolling at any width, touch targets
at least 44px on small screens, readable type sizes, and layouts that reflow rather than shrink.
Keep the desktop appearance essentially unchanged.

${ctx.instruction ? `Additional direction: ${ctx.instruction}\n` : ''}
Current screen:
${ctx.screenCode}`,
  },

  improve_accessibility: {
    id: 'improve_accessibility',
    kind: 'screen_rewrite',
    label: 'Fix accessibility issues',
    description: 'Apply accessibility corrections to this screen.',
    credit: 'improve_accessibility',
    highQuality: false,
    needsScreen: true,
    needsInstruction: false,
    system: HTML_SYSTEM,
    buildPrompt: (ctx) => `${projectHeader(ctx)}

Fix the accessibility problems on the "${ctx.screenName}" screen. Apply: semantic elements
instead of generic divs where one exists, an accessible name for every control and image,
correct heading order, visible focus styles, form labels tied to their inputs, WCAG AA contrast,
and ARIA only where a native element cannot express the meaning. Keep the visual design
recognisably the same.

Current screen:
${ctx.screenCode}`,
  },

  audit_accessibility: {
    id: 'audit_accessibility',
    kind: 'analysis',
    label: 'Accessibility audit',
    description: 'Report accessibility problems without changing anything.',
    credit: 'audit_accessibility',
    highQuality: false,
    needsScreen: true,
    needsInstruction: false,
    system: ANALYSIS_SYSTEM,
    buildPrompt: (ctx) => `Audit the "${ctx.screenName}" screen against WCAG 2.2 AA. Check contrast,
accessible names, heading order, focus visibility, form labelling, touch target size, and
keyboard operability. Report only problems you can actually see in this markup.

Return JSON matching:
${ANALYSIS_SHAPE}

Screen:
${ctx.screenCode}`,
    schema: analysisSchema,
  },

  check_consistency: {
    id: 'check_consistency',
    kind: 'analysis',
    label: 'Check design consistency',
    description: 'Find where screens drift from one another.',
    credit: 'check_consistency',
    highQuality: true,
    needsScreen: false,
    needsInstruction: false,
    system: ANALYSIS_SYSTEM,
    buildPrompt: (ctx) => `${projectHeader(ctx)}

Review these screens together and report where they are inconsistent with each other: differing
spacing scales, button styles, type sizes, colour usage, corner radii, heading patterns or
component treatments for the same idea.

Return JSON matching:
${ANALYSIS_SHAPE}

Screens:
${(ctx.allScreens ?? []).map((s) => `--- ${s.name} ---\n${s.code}`).join('\n\n')}`,
    schema: analysisSchema,
  },

  extract_design_system: {
    id: 'extract_design_system',
    kind: 'analysis',
    label: 'Extract the design system',
    description: 'Document the tokens and components these screens already use.',
    credit: 'extract_design_system',
    highQuality: true,
    needsScreen: false,
    needsInstruction: false,
    system: ANALYSIS_SYSTEM,
    buildPrompt: (ctx) => `${projectHeader(ctx)}

Read these screens and document the design system they actually use — not one you would
recommend. List the colours with their roles, the type scale, the spacing values in use, and the
recurring components with their variants.

Return JSON matching:
{
  "summary": "one paragraph",
  "colors": [{ "name": "primary", "value": "#hex", "usage": "where it is used" }],
  "typography": [{ "name": "H1", "spec": "32px/1.2 semibold" }],
  "spacing": ["4px", "8px"],
  "components": [{ "name": "Primary button", "description": "...", "variants": ["default", "disabled"] }]
}

Screens:
${(ctx.allScreens ?? []).map((s) => `--- ${s.name} ---\n${s.code}`).join('\n\n')}`,
    schema: designSystemSchema,
  },
};

export const AI_ACTION_IDS = Object.keys(AI_ACTIONS) as AiActionId[];

export function isAiActionId(value: unknown): value is AiActionId {
  return typeof value === 'string' && (AI_ACTION_IDS as string[]).includes(value);
}
