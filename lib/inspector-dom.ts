import { pathToString } from './inspector';

/**
 * DOM-side helpers for the visual inspector. Browser-only: they need a real
 * DOMParser, which Node does not have. The logic that can be tested without a
 * DOM deliberately lives in `lib/inspector.ts` instead.
 */

export interface TreeNode {
  path: string;
  tag: string;
  /** A short label: the tag plus an id/class hint, or the text it contains. */
  label: string;
  depth: number;
  hasChildren: boolean;
}

/** Elements whose internals are not worth showing as layers. */
const OPAQUE_TAGS = new Set(['svg', 'script', 'style', 'br', 'hr', 'img', 'input', 'source']);

function labelFor(element: Element): string {
  const tag = element.tagName.toLowerCase();
  if (element.id) return `${tag}#${element.id}`;

  const firstClass = element.getAttribute('class')?.trim().split(/\s+/)[0];
  const text = (element.textContent ?? '').trim().replace(/\s+/g, ' ');
  // Prefer the element's own text when it is short and it has no element
  // children — that is what a person recognises the layer by.
  if (text && element.children.length === 0 && text.length <= 40) return `${tag} · ${text}`;
  if (firstClass) return `${tag}.${firstClass}`;
  return tag;
}

/**
 * Walk a parsed body into a flat, ordered list of layers.
 *
 * Flat rather than nested because the panel renders it as a list with
 * indentation, and a flat list makes keyboard navigation and filtering trivial.
 */
export function buildTree(root: Element, maxNodes = 500): TreeNode[] {
  const nodes: TreeNode[] = [];

  function walk(element: Element, path: number[]) {
    if (nodes.length >= maxNodes) return;
    const tag = element.tagName.toLowerCase();
    const opaque = OPAQUE_TAGS.has(tag);
    nodes.push({
      path: pathToString(path),
      tag,
      label: labelFor(element),
      depth: path.length,
      hasChildren: !opaque && element.children.length > 0,
    });
    if (opaque) return;
    for (let i = 0; i < element.children.length; i++) {
      walk(element.children[i], [...path, i]);
    }
  }

  for (let i = 0; i < root.children.length; i++) walk(root.children[i], [i]);
  return nodes;
}

/** Resolve a path to its element, or null when the tree has changed shape. */
export function elementAtPath(root: Element, path: number[]): Element | null {
  let node: Element | null = root;
  for (const index of path) {
    if (!node || index < 0 || index >= node.children.length) return null;
    node = node.children[index];
  }
  return node === root ? null : node;
}

/**
 * A copy of the markup with `data-ufo-path` on every element, for the preview
 * frame to report clicks against.
 *
 * Always a copy: these attributes are a transport detail and must never reach
 * the stored screen code.
 */
export function annotateForPreview(root: Element): string {
  const clone = root.cloneNode(true) as Element;

  function walk(element: Element, path: number[]) {
    element.setAttribute('data-ufo-path', pathToString(path));
    for (let i = 0; i < element.children.length; i++) walk(element.children[i], [...path, i]);
  }

  for (let i = 0; i < clone.children.length; i++) walk(clone.children[i], [i]);
  return clone.innerHTML;
}

/** Parse a screen's HTML. Returns the body element to walk. */
export function parseScreen(html: string): Element {
  return new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body;
}
