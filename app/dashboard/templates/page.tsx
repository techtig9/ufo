import { createClient } from '@/lib/supabase/server';
import { EmptyState } from '@/components/ui/empty-state';
import { TemplateCard } from '@/components/templates/template-card';

interface TemplateRow {
  id: string;
  category: string;
  name: string;
  description: string | null;
  screens: unknown;
}

export default async function TemplatesPage() {
  const supabase = await createClient();
  const { data: templates } = await supabase
    .from('templates')
    .select('id, category, name, description, screens')
    .order('category');

  const rows = (templates ?? []) as TemplateRow[];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">Templates</h1>
        <p className="mt-1 text-white/50">
          Start a new project from a ready-made template instead of a blank description — free, no AI credits used.
        </p>
      </div>

      {!rows.length ? (
        <EmptyState
          title="No templates yet"
          description="Templates will show up here once they're seeded."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {rows.map((t) => (
            <TemplateCard
              key={t.id}
              id={t.id}
              name={t.name}
              category={t.category}
              description={t.description}
              screenCount={Array.isArray(t.screens) ? t.screens.length : 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
