'use client';

import { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import {
  INSPECTOR_FIELDS,
  INSPECTOR_GROUPS,
  parseStyleAttribute,
  parsePath,
  setStyleDeclaration,
  type InspectorField,
} from '@/lib/inspector';
import { elementAtPath, parseScreen, type TreeNode } from '@/lib/inspector-dom';

/**
 * Layers + visual inspector.
 *
 * Edits are written as inline styles on the selected element(s) and the whole
 * screen is re-serialised. That choice is explained in `lib/inspector.ts`: the
 * markup is Tailwind-classed, and most arbitrary values have no Tailwind class,
 * so a class-editing inspector would silently drop half of what is typed. The
 * element's existing classes are shown alongside, so an unedited value's origin
 * stays visible.
 *
 * Every write goes through `setStyleDeclaration`, which refuses properties
 * outside the catalogue and values that could escape the attribute.
 */
export function VisualInspector({
  code,
  tree,
  selected,
  onSelectedChange,
  onChange,
  disabled,
}: {
  /** The screen's current HTML. */
  code: string;
  tree: TreeNode[];
  selected: string[];
  onSelectedChange: (paths: string[]) => void;
  onChange: (nextCode: string) => void;
  disabled?: boolean;
}) {
  const [filter, setFilter] = useState('');

  const visible = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return tree;
    return tree.filter((node) => node.label.toLowerCase().includes(query));
  }, [tree, filter]);

  // The declarations shown in the fields. With several elements selected, a
  // property is only shown when they all agree — otherwise the field would
  // claim a value that is only true of one of them.
  const { declarations, mixed, classNames } = useMemo(() => {
    const root = parseScreen(code);
    const elements = selected
      .map((path) => parsePath(path))
      .filter((path): path is number[] => path !== null)
      .map((path) => elementAtPath(root, path))
      .filter((el): el is Element => el !== null);

    if (elements.length === 0) {
      return { declarations: {} as Record<string, string>, mixed: new Set<string>(), classNames: '' };
    }

    const first = parseStyleAttribute(elements[0].getAttribute('style') ?? '');
    const mixedProps = new Set<string>();

    for (const element of elements.slice(1)) {
      const other = parseStyleAttribute(element.getAttribute('style') ?? '');
      for (const property of new Set([...Object.keys(first), ...Object.keys(other)])) {
        if (first[property] !== other[property]) mixedProps.add(property);
      }
    }

    return {
      declarations: first,
      mixed: mixedProps,
      classNames: elements.length === 1 ? elements[0].getAttribute('class') ?? '' : '',
    };
  }, [code, selected]);

  const apply = useCallback(
    (property: string, value: string) => {
      const root = parseScreen(code);
      let changed = 0;
      let refused = false;

      for (const path of selected) {
        const parsed = parsePath(path);
        if (!parsed) continue;
        const element = elementAtPath(root, parsed);
        if (!element) continue;

        const next = setStyleDeclaration(element.getAttribute('style') ?? '', property, value);
        if (next === null) {
          refused = true;
          continue;
        }
        if (next) element.setAttribute('style', next);
        else element.removeAttribute('style');
        changed++;
      }

      if (refused) {
        toast.error('That value is not allowed here. Try a plain CSS value like 16px or #3A7BD5.');
        return;
      }
      if (changed === 0) return;
      onChange(root.innerHTML);
    },
    [code, selected, onChange]
  );

  function toggle(path: string, additive: boolean) {
    if (!additive) {
      onSelectedChange([path]);
      return;
    }
    onSelectedChange(
      selected.includes(path) ? selected.filter((p) => p !== path) : [...selected, path]
    );
  }

  const nothingSelected = selected.length === 0;

  return (
    <Panel hover={false} className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Layers &amp; styles</h3>
        {selected.length > 0 && (
          <button
            onClick={() => onSelectedChange([])}
            className="text-[10px] text-fg-faint hover:text-fg"
          >
            Clear selection
          </button>
        )}
      </div>

      <input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter layers…"
        aria-label="Filter layers"
        className="w-full rounded-lg border border-edge bg-surface-subtle px-3 py-1.5 text-xs outline-none focus:border-studio-citron"
      />

      <ul
        role="listbox"
        aria-label="Layers"
        aria-multiselectable="true"
        className="max-h-52 overflow-y-auto rounded-lg border border-edge bg-surface-subtle p-1"
      >
        {visible.length === 0 && (
          <li className="px-2 py-3 text-xs text-fg-faint">
            {tree.length === 0 ? 'This screen has no elements yet.' : 'No layer matches that filter.'}
          </li>
        )}
        {visible.map((node) => {
          const isSelected = selected.includes(node.path);
          return (
            <li key={node.path} role="option" aria-selected={isSelected}>
              <button
                type="button"
                onClick={(e) => toggle(node.path, e.shiftKey || e.metaKey || e.ctrlKey)}
                style={{ paddingLeft: `${Math.min(node.depth, 8) * 10 + 8}px` }}
                className={`block w-full truncate rounded py-1 pr-2 text-left text-[11px] transition-colors duration-micro ${
                  isSelected ? 'bg-studio-citron/15 text-brand-text' : 'text-fg-muted hover:bg-surface-raised hover:text-fg'
                }`}
              >
                {node.label}
              </button>
            </li>
          );
        })}
      </ul>

      {nothingSelected ? (
        <p className="text-xs text-fg-faint">
          Pick a layer above, or click an element in the preview. Hold Shift to select several and
          edit them together.
        </p>
      ) : (
        <>
          <p className="text-[10px] text-fg-faint">
            {selected.length === 1
              ? `Editing 1 element`
              : `Editing ${selected.length} elements together`}
          </p>

          {classNames && (
            <p className="truncate rounded bg-surface-subtle px-2 py-1 text-[10px] text-fg-faint" title={classNames}>
              class=&quot;{classNames}&quot;
            </p>
          )}

          <div className="space-y-4">
            {INSPECTOR_GROUPS.map((group) => {
              const fields = INSPECTOR_FIELDS.filter((f) => f.group === group);
              if (!fields.length) return null;
              return (
                <fieldset key={group} className="border-t border-edge pt-3">
                  <legend className="text-[9px] font-semibold uppercase tracking-[.18em] text-fg-faint">
                    {group}
                  </legend>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {fields.map((field) => (
                      <InspectorControl
                        key={field.property}
                        field={field}
                        value={declarations[field.property] ?? ''}
                        isMixed={mixed.has(field.property)}
                        disabled={disabled}
                        onCommit={(value) => apply(field.property, value)}
                      />
                    ))}
                  </div>
                </fieldset>
              );
            })}
          </div>

          <p className="border-t border-edge pt-3 text-[10px] leading-4 text-fg-faint">
            This panel edits styles. Reordering elements by drag, extracting reusable
            components, and binding a value to a design token are not available — they need a
            document model this editor does not have yet. Use the Code tab for structural changes.
          </p>

          <div className="border-t border-edge pt-3">
            <Button
              size="sm"
              variant="ghost"
              disabled={disabled}
              onClick={() => {
                // Clearing every inspector-owned property, not the whole style
                // attribute: the markup may carry styles this panel does not
                // manage, and wiping those would be a surprise.
                const root = parseScreen(code);
                for (const path of selected) {
                  const parsed = parsePath(path);
                  const element = parsed && elementAtPath(root, parsed);
                  if (!element) continue;
                  let style = element.getAttribute('style') ?? '';
                  for (const field of INSPECTOR_FIELDS) {
                    style = setStyleDeclaration(style, field.property, '') ?? style;
                  }
                  if (style) element.setAttribute('style', style);
                  else element.removeAttribute('style');
                }
                onChange(root.innerHTML);
              }}
            >
              Reset these styles
            </Button>
          </div>
        </>
      )}
    </Panel>
  );
}

/**
 * One field. Text inputs commit on blur and Enter rather than on every
 * keystroke, so typing "16px" does not push four intermediate values ("1",
 * "16", "16p") through the undo stack.
 */
function InspectorControl({
  field,
  value,
  isMixed,
  disabled,
  onCommit,
}: {
  field: InspectorField;
  value: string;
  isMixed: boolean;
  disabled?: boolean;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (isMixed ? '' : value);

  const label = (
    <label htmlFor={`inspect-${field.property}`} className="block text-[10px] text-fg-faint">
      {field.label}
      {isMixed && <span className="ml-1 text-fg-faint">(mixed)</span>}
    </label>
  );

  if (field.kind === 'select') {
    return (
      <div>
        {label}
        <select
          id={`inspect-${field.property}`}
          value={shown}
          disabled={disabled}
          onChange={(e) => onCommit(e.target.value)}
          className="mt-0.5 w-full rounded border border-edge bg-surface-subtle px-1.5 py-1 text-[11px] text-fg outline-none focus:border-studio-citron disabled:opacity-50"
        >
          {field.options?.map((option) => (
            <option key={option} value={option}>
              {option || '—'}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div>
      {label}
      <div className="mt-0.5 flex gap-1">
        {field.kind === 'color' && (
          <input
            type="color"
            aria-label={`${field.label} colour picker`}
            // A colour input cannot represent `transparent` or a CSS variable,
            // so it sits BESIDE the text field rather than replacing it — the
            // text field stays the source of truth.
            value={/^#[0-9a-fA-F]{6}$/.test(shown) ? shown : '#000000'}
            disabled={disabled}
            onChange={(e) => onCommit(e.target.value)}
            className="h-[26px] w-7 shrink-0 rounded border border-edge bg-surface-subtle"
          />
        )}
        <input
          id={`inspect-${field.property}`}
          value={shown}
          disabled={disabled}
          placeholder={field.placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft !== null && draft !== value) onCommit(draft);
            setDraft(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            } else if (e.key === 'Escape') {
              setDraft(null);
              e.currentTarget.blur();
            }
          }}
          className="min-w-0 flex-1 rounded border border-edge bg-surface-subtle px-1.5 py-1 text-[11px] text-fg outline-none focus:border-studio-citron disabled:opacity-50"
        />
      </div>
    </div>
  );
}
