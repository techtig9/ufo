import Link from 'next/link';
import { Panel } from '@/components/ui/panel';

export function ProjectCard({
  project,
}: {
  project: {
    id: string;
    name: string;
    project_type: string;
    created_at: string;
    is_favorite?: boolean | null;
    tags?: string[] | null;
  };
}) {
  return (
    <Link href={`/dashboard/projects/${project.id}`} className="group block">
      <Panel className="h-full transition-transform duration-200 group-hover:-translate-y-0.5">
        <div className="relative aspect-video overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-studio-citron/20 via-white/5 to-studio-coral/15">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,.2),transparent_35%)]" />
          <div className="absolute bottom-3 left-3 rounded-lg border border-black/10 bg-white/80 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-black/55 backdrop-blur">
            {project.project_type}
          </div>
        </div>

        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium">{project.name}</p>
            <p className="mt-1 text-xs text-white/35">
              Updated {new Date(project.created_at).toLocaleDateString()}
            </p>
          </div>
          {project.is_favorite && <span className="text-studio-indigo">★</span>}
        </div>

        {!!project.tags?.length && (
          <div className="mt-3 flex flex-wrap gap-1">
            {project.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] text-white/35">
                {tag}
              </span>
            ))}
          </div>
        )}
      </Panel>
    </Link>
  );
}
