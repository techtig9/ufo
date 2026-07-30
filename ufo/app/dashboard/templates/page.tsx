import { createClient } from '@/lib/supabase/server';
import { Panel } from '@/components/ui/panel';

export default async function TemplatesPage() {
  const supabase = createClient();
  const { data: templates } = await supabase.from('templates').select('*').order('category');

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4">
      <h1 className="font-display text-2xl font-semibold">Templates</h1>
      <p className="text-white/50">
        Start a new project from a seed template instead of a blank description.
      </p>

      {!templates?.length ? (
        <Panel className="text-center text-white/50">
          No templates seeded yet. Add 3{'\u2013'}5 rows to the <code>templates</code> table to get
          started — enough to validate the generator (see Phase 1 scope).
        </Panel>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {templates.map((t) => (
            <Panel key={t.id}>
              <div className="aspect-[4/3] rounded-lg bg-gradient-to-br from-studio-citron/20 to-studio-coral/10" />
              <p className="mt-3 text-sm font-medium">{t.name}</p>
              <p className="text-xs capitalize text-white/40">{t.category}</p>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
