/**
 * The visual inspector's pure core: CSS declaration handling, the field
 * catalogue, and element-path addressing.
 *
 * Kept free of the DOM so it is unit-testable in Node, and so the rules that
 * matter for safety — what counts as an acceptable CSS value — live in one
 * place rather than being spread across event handlers.
 *
 * Why inline styles rather than editing Tailwind classes: the screens are
 * Tailwind-classed HTML, but arbitrary values (a 13px font, a #3A7BD5 border)
 * mostly have no class, so a class-editing inspector would silently refuse
 * half of what the user typed. Inline styles always apply and always win, and
 * the panel shows the element's classes alongside so the origin of an
 * unedited value is still visible.
 */

export interface InspectorField {
  /** The CSS property this control writes. */
  property: string;
  label: string;
  group: 'Typography' | 'Colours' | 'Spacing' | 'Border' | 'Effects' | 'Layout';
  kind: 'text' | 'color' | 'select';
  options?: string[];
  placeholder?: string;
}

export const INSPECTOR_FIELDS: InspectorField[] = [
  { property: 'font-size', label: 'Size', group: 'Typography', kind: 'text', placeholder: '16px' },
  {
    property: 'font-weight',
    label: 'Weight',
    group: 'Typography',
    kind: 'select',
    options: ['', '300', '400', '500', '600', '700', '800'],
  },
  { property: 'line-height', label: 'Line height', group: 'Typography', kind: 'text', placeholder: '1.5' },
  { property: 'letter-spacing', label: 'Tracking', group: 'Typography', kind: 'text', placeholder: '0.01em' },
  {
    property: 'text-align',
    label: 'Align',
    group: 'Typography',
    kind: 'select',
    options: ['', 'left', 'center', 'right', 'justify'],
  },

  { property: 'color', label: 'Text', group: 'Colours', kind: 'color' },
  { property: 'background-color', label: 'Background', group: 'Colours', kind: 'color' },

  { property: 'padding', label: 'Padding', group: 'Spacing', kind: 'text', placeholder: '12px 16px' },
  { property: 'margin', label: 'Margin', group: 'Spacing', kind: 'text', placeholder: '0 auto' },
  { property: 'gap', label: 'Gap', group: 'Spacing', kind: 'text', placeholder: '8px' },

  { property: 'border-width', label: 'Width', group: 'Border', kind: 'text', placeholder: '1px' },
  {
    property: 'border-style',
    label: 'Style',
    group: 'Border',
    kind: 'select',
    options: ['', 'solid', 'dashed', 'dotted', 'none'],
  },
  { property: 'border-color', label: 'Colour', group: 'Border', kind: 'color' },
  { property: 'border-radius', label: 'Radius', group: 'Border', kind: 'text', placeholder: '12px' },

  { property: 'box-shadow', label: 'Shadow', group: 'Effects', kind: 'text', placeholder: '0 8px 24px rgba(0,0,0,.2)' },
  { property: 'opacity', label: 'Opacity', group: 'Effects', kind: 'text', placeholder: '1' },

  {
    property: 'display',
    label: 'Display',
    group: 'Layout',
    kind: 'select',
    options: ['', 'block', 'flex', 'inline-flex', 'grid', 'inline-block', 'none'],
  },
  {
    property: 'flex-direction',
    label: 'Direction',
    group: 'Layout',
    kind: 'select',
    options: ['', 'row', 'column', 'row-reverse', 'column-reverse'],
  },
  {
    property: 'justify-content',
    label: 'Justify',
    group: 'Layout',
    kind: 'select',
    options: ['', 'flex-start', 'center', 'flex-end', 'space-between', 'space-around'],
  },
  {
    property: 'align-items',
    label: 'Align items',
    group: 'Layout',
    kind: 'select',
    options: ['', 'stretch', 'flex-start', 'center', 'flex-end', 'baseline'],
  },
];

export const INSPECTOR_GROUPS = [
  'Layout',
  'Typography',
  'Colours',
  'Spacing',
  'Border',
  'Effects',
] as const;

/** Properties the inspector is allowed to write. Anything else is refused. */
const ALLOWED_PROPERTIES = new Set(INSPECTOR_FIELDS.map((f) => f.property));

export function isInspectableProperty(property: string): boolean {
  return ALLOWED_PROPERTIES.has(property);
}

/**
 * Is this CSS value safe to write into a style attribute?
 *
 * The edited HTML is re-rendered in the preview iframe and stored as the
 * screen's code, so a value is attacker-influenced content even when the
 * attacker is the user themselves — the code is later shown to anyone with the
 * share link. Rejected:
 *
 *   * `"` and `'` and `<` `>`, which could close the attribute or the tag;
 *   * `;` and `:` outside a value, which would let one field write several
 *     declarations;
 *   * `url(`, `image-set(`, `element(` — external or same-document references,
 *     which are a request-forgery and tracking vector in a prototype;
 *   * `expression(` and `javascript:`, historical script vectors;
 *   * `/*`, which could comment out the rest of the attribute.
 *
 * An allow-list of characters would be simpler but would reject legitimate
 * values like `rgba(0,0,0,.2)` and `clamp(1rem, 2vw, 2rem)`.
 */
export function isSafeCssValue(value: string): boolean {
  if (value === '') return true;
  if (value.length > 200) return false;

  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    // Control characters, including the newline that could smuggle a newline
    // into the attribute.
    if (code < 0x20 || code === 0x7f) return false;
  }

  if (/["'<>;\\]/.test(value)) return false;
  if (value.includes('/*') || value.includes('*/')) return false;

  const lowered = value.toLowerCase().replace(/\s+/g, '');
  for (const banned of ['url(', 'expression(', 'javascript:', 'image-set(', 'element(', '@import']) {
    if (lowered.includes(banned)) return false;
  }

  return true;
}

/** Parse a `style` attribute into declarations, last one winning. */
export function parseStyleAttribute(style: string): Record<string, string> {
  const declarations: Record<string, string> = {};
  for (const part of style.split(';')) {
    const index = part.indexOf(':');
    if (index === -1) continue;
    const property = part.slice(0, index).trim().toLowerCase();
    const value = part.slice(index + 1).trim();
    if (!property || !value) continue;
    declarations[property] = value;
  }
  return declarations;
}

/** Serialize declarations back to a `style` attribute, in a stable order. */
export function serializeStyleAttribute(declarations: Record<string, string>): string {
  return Object.keys(declarations)
    .sort()
    .filter((property) => declarations[property] !== '')
    .map((property) => `${property}: ${declarations[property]}`)
    .join('; ');
}

/**
 * Set one declaration on a style attribute.
 *
 * An empty value REMOVES the declaration rather than writing an empty one, so
 * clearing a field genuinely reverts to whatever the element's classes say
 * instead of pinning it to nothing.
 *
 * Returns null when the property is not inspectable or the value is unsafe, so
 * the caller can report it rather than writing something surprising.
 */
export function setStyleDeclaration(
  style: string,
  property: string,
  value: string
): string | null {
  const normalizedProperty = property.trim().toLowerCase();
  if (!isInspectableProperty(normalizedProperty)) return null;

  const trimmed = value.trim();
  if (!isSafeCssValue(trimmed)) return null;

  const declarations = parseStyleAttribute(style);
  if (trimmed === '') delete declarations[normalizedProperty];
  else declarations[normalizedProperty] = trimmed;

  return serializeStyleAttribute(declarations);
}

// ---------------------------------------------------------------------------
// Element paths.
//
// An element is addressed by its chain of child indices from the root, e.g.
// "0.2.1". This is stable for as long as the tree shape is, needs nothing
// written into the markup, and survives the round trip through the iframe,
// which cannot share objects with this page.
// ---------------------------------------------------------------------------

export function pathToString(path: number[]): string {
  return path.join('.');
}

export function parsePath(value: string): number[] | null {
  if (value === '') return [];
  const parts = value.split('.');
  const path: number[] = [];
  for (const part of parts) {
    // Reject anything that is not a plain non-negative integer: a path arrives
    // from the sandboxed iframe by postMessage, so it is untrusted input.
    if (!/^\d+$/.test(part)) return null;
    const index = Number(part);
    if (!Number.isSafeInteger(index)) return null;
    path.push(index);
  }
  return path;
}

/** True when `path` is `ancestor` or below it — used to auto-expand the tree. */
export function isDescendantPath(path: string, ancestor: string): boolean {
  if (ancestor === '') return true;
  return path === ancestor || path.startsWith(`${ancestor}.`);
}
