/**
 * Mechanical HTML → JSX conversion, for the React export.
 *
 * WHY A SCANNER AND NOT A REGEX
 * -----------------------------
 * The obvious implementation is `html.replace(/class=/g, 'className=')`. It is
 * also wrong: the generated markup contains prose, and a screen whose copy
 * mentions `class="..."`, or a `<pre>` block showing markup, would be silently
 * rewritten. This walks the string and only ever touches the inside of a tag,
 * so text content is copied through untouched.
 *
 * WHAT THIS IS NOT
 * ----------------
 * It is not an HTML parser and does not pretend to be one. It handles the
 * markup this product generates — well-formed Tailwind HTML — and the cases
 * below. It does not reconcile mismatched tags, resolve entities, or
 * understand `<template>`. The export says so, because a converter that
 * quietly mangles an edge case is worse than one with stated limits.
 */

/** HTML attributes whose JSX spelling differs. Lower-case key → JSX name. */
const ATTRIBUTE_MAP: Record<string, string> = {
  class: 'className',
  for: 'htmlFor',
  tabindex: 'tabIndex',
  readonly: 'readOnly',
  maxlength: 'maxLength',
  minlength: 'minLength',
  colspan: 'colSpan',
  rowspan: 'rowSpan',
  autocomplete: 'autoComplete',
  autofocus: 'autoFocus',
  autoplay: 'autoPlay',
  srcset: 'srcSet',
  crossorigin: 'crossOrigin',
  datetime: 'dateTime',
  enctype: 'encType',
  formaction: 'formAction',
  novalidate: 'noValidate',
  spellcheck: 'spellCheck',
  contenteditable: 'contentEditable',
  accesskey: 'accessKey',
  usemap: 'useMap',
  frameborder: 'frameBorder',
  allowfullscreen: 'allowFullScreen',
  playsinline: 'playsInline',
  // SVG
  'stroke-width': 'strokeWidth',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-dasharray': 'strokeDasharray',
  'stroke-dashoffset': 'strokeDashoffset',
  'fill-rule': 'fillRule',
  'clip-rule': 'clipRule',
  'clip-path': 'clipPath',
  'stop-color': 'stopColor',
  'stop-opacity': 'stopOpacity',
  'fill-opacity': 'fillOpacity',
  'stroke-opacity': 'strokeOpacity',
  'text-anchor': 'textAnchor',
  'font-family': 'fontFamily',
  'font-size': 'fontSize',
  'font-weight': 'fontWeight',
  'xlink:href': 'xlinkHref',
  viewbox: 'viewBox',
  preserveaspectratio: 'preserveAspectRatio',
};

/** Elements that must be self-closing in JSX. */
const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

/** Attributes JSX does not accept at all, and that carry no meaning in React. */
const DROPPED = new Set(['charset', 'http-equiv']);

function toCamel(name: string): string {
  return name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

/** `color: red; font-size: 2px` → `{ color: 'red', fontSize: '2px' }` source text. */
export function styleToJsx(style: string): string {
  const entries: string[] = [];

  for (const declaration of style.split(';')) {
    const idx = declaration.indexOf(':');
    if (idx === -1) continue;

    const property = declaration.slice(0, idx).trim();
    const value = declaration.slice(idx + 1).trim();
    if (!property || !value) continue;

    // A CSS custom property keeps its exact name and must stay quoted.
    const key = property.startsWith('--') ? `'${property}'` : toCamel(property);
    entries.push(`${key}: ${JSON.stringify(value)}`);
  }

  return entries.length ? `{{ ${entries.join(', ')} }}` : '{{}}';
}

/** Text between tags. JSX treats `{` and `}` as expression delimiters. */
function escapeText(text: string): string {
  return text.replace(/[{}]/g, (c) => `{'${c}'}`);
}

interface Attribute {
  name: string;
  value: string | null;
  quote: string;
}

/** Parse the attribute section of a tag, quote-aware so `a="b>c"` is one value. */
function parseAttributes(source: string): Attribute[] {
  const attributes: Attribute[] = [];
  let i = 0;

  while (i < source.length) {
    while (i < source.length && /\s/.test(source[i])) i += 1;
    if (i >= source.length) break;

    const nameStart = i;
    while (i < source.length && !/[\s=]/.test(source[i])) i += 1;
    const name = source.slice(nameStart, i);
    if (!name) break;

    while (i < source.length && /\s/.test(source[i])) i += 1;

    if (source[i] !== '=') {
      attributes.push({ name, value: null, quote: '"' });
      continue;
    }

    i += 1; // consume '='
    while (i < source.length && /\s/.test(source[i])) i += 1;

    const quote = source[i] === '"' || source[i] === "'" ? source[i] : '';
    if (quote) {
      i += 1;
      const valueStart = i;
      while (i < source.length && source[i] !== quote) i += 1;
      attributes.push({ name, value: source.slice(valueStart, i), quote });
      i += 1; // consume closing quote
    } else {
      const valueStart = i;
      while (i < source.length && !/\s/.test(source[i])) i += 1;
      attributes.push({ name, value: source.slice(valueStart, i), quote: '"' });
    }
  }

  return attributes;
}

function renderAttribute(attr: Attribute): string | null {
  const lower = attr.name.toLowerCase();
  if (DROPPED.has(lower)) return null;

  // Inline event handlers are HTML-only; a string of JS in a JSX prop would be
  // a type error at best and dead code at worst. Dropped deliberately, and
  // noted in the export's README so nobody wonders where they went.
  if (lower.startsWith('on')) return null;

  const name =
    ATTRIBUTE_MAP[lower] ??
    // data-* and aria-* keep their hyphens in JSX; everything else camelises.
    (lower.startsWith('data-') || lower.startsWith('aria-') ? lower : toCamel(lower));

  if (attr.value === null) return name; // boolean attribute

  if (name === 'style') return `style=${styleToJsx(attr.value)}`;

  // A value containing a double quote has to switch delimiters, or the JSX
  // will not parse.
  const quote = attr.value.includes('"') ? "'" : '"';
  const value = quote === "'" ? attr.value.replace(/'/g, '&apos;') : attr.value;
  return `${name}=${quote}${value}${quote}`;
}

/** Convert an HTML fragment to JSX source text. */
export function htmlToJsx(html: string): string {
  let out = '';
  let i = 0;

  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) {
      out += escapeText(html.slice(i));
      break;
    }

    out += escapeText(html.slice(i, lt));

    // Comment → JSX comment. Also covers doctype-ish `<!...>` forms.
    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt);
      const body = end === -1 ? html.slice(lt + 4) : html.slice(lt + 4, end);
      // `*/` inside the comment would close the JSX comment early.
      out += `{/*${body.replace(/\*\//g, '* /')}*/}`;
      i = end === -1 ? html.length : end + 3;
      continue;
    }
    if (html.startsWith('<!', lt)) {
      const end = html.indexOf('>', lt);
      i = end === -1 ? html.length : end + 1; // drop doctype
      continue;
    }

    // Find the end of this tag, ignoring '>' inside quoted attribute values.
    let j = lt + 1;
    let quote: string | null = null;
    while (j < html.length) {
      const c = html[j];
      if (quote) {
        if (c === quote) quote = null;
      } else if (c === '"' || c === "'") {
        quote = c;
      } else if (c === '>') {
        break;
      }
      j += 1;
    }
    if (j >= html.length) {
      out += escapeText(html.slice(lt));
      break;
    }

    const inner = html.slice(lt + 1, j);
    i = j + 1;

    if (inner.startsWith('/')) {
      out += `</${inner.slice(1).trim().toLowerCase()}>`;
      continue;
    }

    const selfClosed = inner.endsWith('/');
    const body = selfClosed ? inner.slice(0, -1) : inner;

    const nameEnd = body.search(/[\s/]/);
    const tag = (nameEnd === -1 ? body : body.slice(0, nameEnd)).toLowerCase();
    const attrSource = nameEnd === -1 ? '' : body.slice(nameEnd);

    const rendered = parseAttributes(attrSource)
      .map(renderAttribute)
      .filter((a): a is string => a !== null);

    const attrs = rendered.length ? ` ${rendered.join(' ')}` : '';
    const close = selfClosed || VOID_ELEMENTS.has(tag) ? ' />' : '>';
    out += `<${tag}${attrs}${close}`;
  }

  return out;
}

/** A valid React component name from a screen name. */
export function componentName(screenName: string): string {
  const cleaned = screenName
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');

  // A component must start with a capital letter, or JSX treats it as an
  // intrinsic element and renders a literal <123screen> tag.
  if (!cleaned) return 'Screen';
  return /^[A-Za-z]/.test(cleaned) ? cleaned : `Screen${cleaned}`;
}

/** A complete .tsx module for one screen. */
export function screenToComponent(screenName: string, html: string): string {
  const name = componentName(screenName);
  const jsx = htmlToJsx(html).trim();

  return `/**
 * ${screenName}
 *
 * Generated by ufo from the screen's HTML. Mechanically converted: attributes
 * renamed to their JSX spellings, inline styles turned into objects, void
 * elements self-closed, inline event handlers dropped.
 *
 * Tailwind classes are preserved as-is — this expects Tailwind in the target
 * project. Tokens for it are in design-system/.
 */
export default function ${name}() {
  return (
    <>
${jsx
  .split('\n')
  .map((line) => (line.trim() ? `      ${line}` : ''))
  .join('\n')}
    </>
  );
}
`;
}
