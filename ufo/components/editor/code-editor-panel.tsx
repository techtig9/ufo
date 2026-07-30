'use client';

import { useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import type { Screen } from '@/lib/types';

export function CodeEditorPanel({ screen }: { screen: Screen }) {
  const [code, setCode] = useState(screen.code);
  const [saving, setSaving] = useState(false);
  const originalRef = useRef(screen.code);
  const dirty = code !== originalRef.current;

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/screens/${screen.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    setSaving(false);

    if (!res.ok) {
      toast.error('Could not save — try again');
      return;
    }
    originalRef.current = code;
    toast.success('Saved');
  }

  return (
    <div className="flex h-[600px] flex-col overflow-hidden rounded-panel border border-white/10">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-2">
        <span className="text-sm text-white/60">{screen.name}.html</span>
        <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
          {saving ? 'Saving\u2026' : dirty ? 'Save' : 'Saved'}
        </Button>
      </div>
      <Editor
        height="100%"
        language="html"
        theme="vs-dark"
        value={code}
        onChange={(v) => setCode(v ?? '')}
        options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: 'on' }}
      />
    </div>
  );
}
