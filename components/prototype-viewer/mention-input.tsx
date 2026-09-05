'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { activeMentionQuery, mentionToken } from '@/lib/mentions';

export interface Collaborator {
  id: string;
  name: string;
}

/**
 * A textarea that offers collaborators after `@`.
 *
 * When `collaborators` is empty — an anonymous visitor to a public share, or a
 * project with no workspace — this is exactly a plain textarea: no picker, no
 * hint, nothing suggesting a feature that would not work. The list is only ever
 * populated for someone the server has confirmed is a collaborator.
 */
export function MentionInput({
  value,
  onChange,
  collaborators,
  placeholder,
  rows = 2,
  className,
  onSubmit,
  ariaLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  collaborators: Collaborator[];
  placeholder?: string;
  rows?: number;
  className?: string;
  /** Enter (without Shift) submits, unless the mention picker is open. */
  onSubmit?: () => void;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const listId = useId();
  const [caret, setCaret] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const trigger = collaborators.length > 0 && !dismissed ? activeMentionQuery(value, caret) : null;

  const matches = useMemo(() => {
    if (!trigger) return [];
    const query = trigger.query.toLowerCase();
    return collaborators.filter((c) => c.name.toLowerCase().includes(query)).slice(0, 6);
  }, [trigger, collaborators]);

  const open = !!trigger && matches.length > 0;
  // Clamp rather than reset: the list shrinks as the query narrows, and an
  // index left pointing past the end would insert nothing on Enter.
  const index = Math.min(activeIndex, matches.length - 1);

  function insert(collaborator: Collaborator) {
    if (!trigger) return;
    const token = mentionToken(collaborator.id, collaborator.name);
    const next = `${value.slice(0, trigger.start)}${token} ${value.slice(caret)}`;
    onChange(next);
    setDismissed(false);
    // Put the caret after the inserted token, not back at the start.
    const nextCaret = trigger.start + token.length + 1;
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(nextCaret, nextCaret);
      setCaret(nextCaret);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (open) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((i) => (i + 1) % matches.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => (i - 1 + matches.length) % matches.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insert(matches[Math.max(index, 0)]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        // Escape closes the picker only; it must not also close the panel
        // around it, so the event stops here.
        e.stopPropagation();
        setDismissed(true);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey && onSubmit) {
      e.preventDefault();
      onSubmit();
    }
  }

  function syncCaret(e: React.SyntheticEvent<HTMLTextAreaElement>) {
    setCaret(e.currentTarget.selectionStart ?? 0);
  }

  return (
    <div className="relative">
      <textarea
        ref={ref}
        rows={rows}
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        role={open ? 'combobox' : undefined}
        aria-expanded={open || undefined}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${index}` : undefined}
        aria-autocomplete={open ? 'list' : undefined}
        onChange={(e) => {
          onChange(e.target.value);
          setCaret(e.target.selectionStart ?? 0);
          setDismissed(false);
          setActiveIndex(0);
        }}
        onKeyUp={syncCaret}
        onClick={syncCaret}
        onSelect={syncCaret}
        onKeyDown={handleKeyDown}
        className={
          className ??
          'w-full rounded-lg border border-edge bg-surface-subtle px-3 py-1.5 text-sm outline-none focus:border-studio-citron'
        }
      />

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Mention a collaborator"
          className="dropdown-surface absolute bottom-full z-30 mb-1 w-56 overflow-hidden rounded-lg border border-edge shadow-lift"
        >
          {matches.map((collaborator, i) => (
            <li key={collaborator.id} id={`${listId}-${i}`} role="option" aria-selected={i === index}>
              <button
                type="button"
                // onMouseDown, not onClick: the textarea would blur first and
                // the caret position needed for insertion would be gone.
                onMouseDown={(e) => {
                  e.preventDefault();
                  insert(collaborator);
                }}
                onMouseEnter={() => setActiveIndex(i)}
                className={`block w-full px-3 py-2 text-left text-sm transition-colors duration-micro ${
                  i === index ? 'bg-surface-raised text-fg' : 'text-fg-muted hover:text-fg'
                }`}
              >
                {collaborator.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
