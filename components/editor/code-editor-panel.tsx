'use client';

import { useEffect, useRef, useState } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Dropdown, type DropdownItem } from '@/components/ui/dropdown';
import { COMPONENT_SNIPPETS } from '@/lib/component-snippets';
import type { Screen } from '@/lib/types';

export function CodeEditorPanel({
  screen,
  onSaved,
}: {
  screen: Screen;
  onSaved?: (screen: Screen) => void;
}) {
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  /**
   * The user's unsaved edit, or null when they have not touched this screen.
   *
   * Previously the saved text lived in a ref and `dirty` was computed from it
   * during render — refs are not reactive, so the Save button could stay
   * enabled after a save until something else re-rendered the panel. The
   * baseline is now state, and both `code` and `dirty` are derived from it.
   */
  const [draft, setDraft] = useState<string | null>(null);
  /** What is on the server for this screen. `dirty` is the draft against this. */
  const [baseline, setBaseline] = useState({ id: screen.id, code: screen.code });

  // Adjusting state during render is React's documented way to reset derived
  // state when a prop changes; the previous effect cost an extra render pass
  // and could show the old text for a frame.
  if (screen.id !== baseline.id) {
    // A different screen entirely.
    setBaseline({ id: screen.id, code: screen.code });
    setDraft(null);
  } else if (draft === null && screen.code !== baseline.code) {
    // The same screen changed underneath us — the AI copilot applying an edit,
    // or a version being restored — and there is nothing unsaved to lose.
    //
    // Guarded on `draft === null` deliberately. The previous version keyed its
    // effect on [screen.id, screen.code] with no such guard, so an AI edit
    // landing while the user had unsaved changes in the editor discarded them
    // silently. Their work now survives; the save button stays enabled and the
    // decision is theirs.
    setBaseline({ id: screen.id, code: screen.code });
  }

  const code = draft ?? baseline.code;
  const dirty = draft !== null && draft !== baseline.code;
  const setCode = (next: string | ((current: string) => string)) =>
    setDraft((current) => (typeof next === 'function' ? next(current ?? baseline.code) : next));

  // Warn before leaving the tab/browser with unsaved edits — a real, honest signal
  // (the browser only fires this for actual navigation/close, never fabricated).
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty]);

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/screens/${screen.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      toast.error(data.error ?? 'Could not save — try again');
      return;
    }

    // The saved text IS the new server state. Set it here rather than waiting
    // for the parent to echo it back through `screen`, so the editor never
    // flashes the pre-save text between the response and the parent updating.
    setBaseline({ id: screen.id, code });
    setDraft(null);
    onSaved?.(data.screen);
    toast.success('Saved');
  }

  function insertSnippet(html: string) {
    const editor = editorRef.current;
    if (!editor) {
      // Fallback: append to the end if the editor instance isn't mounted yet.
      setCode((current) => `${current}\n${html}\n`);
      return;
    }
    const position = editor.getPosition();
    const model = editor.getModel();
    if (!position || !model) return;
    editor.executeEdits('insert-component', [
      { range: { startLineNumber: position.lineNumber, startColumn: position.column, endLineNumber: position.lineNumber, endColumn: position.column }, text: `\n${html}\n` },
    ]);
    setCode(model.getValue());
    editor.focus();
  }

  const snippetItems: DropdownItem[] = COMPONENT_SNIPPETS.map((snippet) => ({
    id: snippet.id,
    label: snippet.name,
    onSelect: () => insertSnippet(snippet.html),
  }));

  return (
    <div className="flex h-[680px] flex-col overflow-hidden rounded-panel border border-edge bg-black/10">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-edge bg-surface-subtle px-4 py-2">
        <div>
          <span className="text-sm text-fg-secondary">{screen.name}.html</span>
          <span className="ml-2 text-[10px] text-fg-faint">HTML + Tailwind</span>
        </div>
        <div className="flex items-center gap-2">
          <Dropdown
            align="right"
            triggerLabel="Insert a component"
            items={snippetItems}
            trigger={
              <span className="rounded-lg border border-edge px-2.5 py-1.5 text-xs text-fg-muted hover:border-studio-citron/50 hover:text-fg">
                + Insert component
              </span>
            }
          />
          <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
            {saving ? 'Saving…' : dirty ? 'Save version' : 'Saved'}
          </Button>
        </div>
      </div>
      <Editor
        height="100%"
        language="html"
        theme="vs-dark"
        value={code}
        onMount={(editor) => { editorRef.current = editor; }}
        onChange={(v) => setCode(v ?? '')}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          wordWrap: 'on',
          padding: { top: 12 },
          automaticLayout: true,
        }}
      />
    </div>
  );
}
