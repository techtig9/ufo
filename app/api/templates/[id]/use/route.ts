import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkRateLimit } from '@/lib/rate-limit';

function randomSlug(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 10);
}

interface TemplateScreen {
  name: string;
  code: string;
}

/**
 * Creates a new project by copying a template's screens verbatim — no AI call, so no
 * credits are charged (mirrors the "duplicate project" route's pattern, not /api/generate's).
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // Light rate limit — this creates real project rows, same protection class as duplicate.
  const rateLimit = await checkRateLimit(user.id, 'use-template', 20, 3600);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Too many projects created — please wait a bit and try again.' }, { status: 429 });
  }

  const { data: template } = await supabase
    .from('templates')
    .select('id, name, category, screens')
    .eq('id', params.id)
    .single();

  if (!template) return NextResponse.json({ error: 'Template not found' }, { status: 404 });

  const templateScreens = Array.isArray(template.screens) ? (template.screens as TemplateScreen[]) : [];
  if (!templateScreens.length) {
    return NextResponse.json({ error: 'This template has no content yet' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: project, error: projectError } = await admin
    .from('projects')
    .insert({
      user_id: user.id,
      name: template.name,
      project_type: 'web',
    })
    .select()
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: 'Could not create the project' }, { status: 500 });
  }

  const { error: screensError } = await admin.from('screens').insert(
    templateScreens.map((s, i) => ({
      project_id: project.id,
      name: s.name,
      order_index: i,
      code: s.code,
    }))
  );

  if (screensError) {
    await admin.from('projects').delete().eq('id', project.id);
    return NextResponse.json({ error: 'Could not copy the template screens' }, { status: 500 });
  }

  const { error: shareError } = await admin
    .from('shares')
    .insert({ project_id: project.id, slug: randomSlug(), is_public: false });

  if (shareError) {
    await admin.from('screens').delete().eq('project_id', project.id);
    await admin.from('projects').delete().eq('id', project.id);
    return NextResponse.json({ error: 'The project could not be initialized completely' }, { status: 500 });
  }

  return NextResponse.json({ projectId: project.id });
}
