'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ProjectCard } from './project-card';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';

interface Project {
  id: string;
  name: string;
  project_type: string;
  created_at: string;
  is_favorite?: boolean | null;
  tags?: string[] | null;
  archived_at?: string | null;
}

type SortOrder = 'newest' | 'oldest' | 'name';

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'name', label: 'Name A–Z' },
];

export function ProjectSearch({ projects }: { projects: Project[] }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'favorites' | 'archived'>('all');
  const [sort, setSort] = useState<SortOrder>('newest');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result = projects.filter((project) => {
      const matchesQuery =
        !q ||
        project.name.toLowerCase().includes(q) ||
        project.project_type.toLowerCase().includes(q) ||
        project.tags?.some((tag) => tag.toLowerCase().includes(q));

      if (filter === 'archived') return matchesQuery && !!project.archived_at;
      // "All" and "Favorites" both exclude archived projects — archived is its own tab,
      // the same way most project-management tools keep it out of the default view.
      if (project.archived_at) return false;
      const matchesFilter = filter === 'all' || project.is_favorite;
      return matchesQuery && matchesFilter;
    });

    return [...result].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name);
      const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      return sort === 'newest' ? diff : -diff;
    });
  }, [projects, query, filter, sort]);

  const archivedCount = projects.filter((p) => p.archived_at).length;

  return (
    <>
      <div className="flex flex-col gap-3 rounded-panel border border-white/10 bg-white/[0.02] p-3 sm:flex-row sm:items-center">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search projects, type, tags…"
          aria-label="Search projects"
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none placeholder:text-white/25 focus:border-studio-citron/50"
        />
        <div className="flex rounded-lg bg-white/5 p-1" role="tablist" aria-label="Filter projects">
          <button
            role="tab"
            aria-selected={filter === 'all'}
            onClick={() => setFilter('all')}
            className={`rounded-md px-3 py-1.5 text-xs ${filter === 'all' ? 'bg-white/15 text-white' : 'text-white/40'}`}
          >
            All
          </button>
          <button
            role="tab"
            aria-selected={filter === 'favorites'}
            onClick={() => setFilter('favorites')}
            className={`rounded-md px-3 py-1.5 text-xs ${filter === 'favorites' ? 'bg-white/15 text-white' : 'text-white/40'}`}
          >
            Favorites
          </button>
          <button
            role="tab"
            aria-selected={filter === 'archived'}
            onClick={() => setFilter('archived')}
            className={`rounded-md px-3 py-1.5 text-xs ${filter === 'archived' ? 'bg-white/15 text-white' : 'text-white/40'}`}
          >
            Archived {archivedCount > 0 && `(${archivedCount})`}
          </button>
        </div>
        <Select
          hideLabel
          label="Sort projects"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOrder)}
          options={SORT_OPTIONS}
          containerClassName="sm:w-44"
        />
      </div>

      {!filtered.length ? (
        query ? (
          <div className="rounded-panel border border-dashed border-white/10 p-10 text-center text-sm text-white/35">
            No projects match your search.
          </div>
        ) : filter === 'archived' ? (
          <EmptyState title="No archived projects" description="Projects you archive will show up here." />
        ) : filter === 'favorites' ? (
          <EmptyState title="No favorites yet" description="Star a project from its menu to pin it here." />
        ) : (
          <EmptyState
            title="No projects yet"
            description="Generate your first AI prototype to get started."
            action={<Link href="/dashboard/ai-designer" className="text-sm text-studio-coral hover:underline">Open AI Designer →</Link>}
          />
        )
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project) => <ProjectCard key={project.id} project={project} />)}
        </div>
      )}
    </>
  );
}
