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
  const [code, setCode] = useState(screen.code);
  const [saving, setSaving] = useState(false);
  const originalRef = useRef(screen.code);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const dirty = code !== originalRef.current;

  useEffect(() => {
    setCode(screen.code);
    originalRef.current = screen.code;
  }, [screen.id, screen.code]);

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

    originalRef.current = code;
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
