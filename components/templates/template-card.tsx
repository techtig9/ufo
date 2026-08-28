'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { Panel } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface TemplateCardProps {
  id: string;
  name: string;
  category: string;
  description: string | null;
  screenCount: number;
}

export function TemplateCard({ id, name, category, description, screenCount }: TemplateCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleUse() {
    setLoading(true);
    try {
      const res = await fetch(`/api/templates/${id}/use`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Could not create a project from this template');
      toast.success('Project created from template');
      router.push(`/dashboard/projects/${data.projectId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
      setLoading(false);
    }
  }

  return (
    <Panel className="flex h-full flex-col">
      <div className="aspect-[4/3] rounded-lg bg-gradient-to-br from-studio-citron/20 to-studio-coral/10" />
      <div className="mt-3 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">{name}</p>
          <Badge size="sm">{category}</Badge>
        </div>
        {description && <p className="mt-1.5 text-xs leading-5 text-white/45">{description}</p>}
        <p className="mt-2 text-[10px] text-white/30">{screenCount} screen{screenCount === 1 ? '' : 's'} · free, no credits used</p>
      </div>
      <Button size="sm" className="mt-4 w-full" onClick={handleUse} disabled={loading}>
        {loading ? 'Creating…' : 'Use this template'}
      </Button>
    </Panel>
  );
}
