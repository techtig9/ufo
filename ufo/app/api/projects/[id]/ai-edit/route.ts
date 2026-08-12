import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateComponent } from '@/lib/ai';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const rateLimit = await checkRateLimit(user.id, 'ai-edit', 10, 600);
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Too many AI edits. Please wait a moment.' }, { status: 429 });
  }

  const body = await request.json();
  const screenId = String(body.screenId ?? '');
  const instruction = String(body.instruction ?? '').trim();

  if (!screenId || !instruction) {
    return NextResponse.json({ error: 'screenId and instruction are required' }, { status: 400 });
  }
  if (instruction.length > 1200) {
    return NextResponse.json({ error: 'Instruction is too long' }, { status: 400 });
  }

  const { data: project } = await supabase
    .from('projects')
    .select('id, name, design_style, color_theme, font_pairing')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single();

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const { data: screen } = await supabase
    .from('screens')
    .select('*')
    .eq('id', screenId)
    .eq('project_id', params.id)
    .single();

  if (!screen) return NextResponse.json({ error: 'Screen not found' }, { status: 404 });

  const context = `Project: ${project.name}
Design style: ${project.design_style ?? 'not specified'}
Color tokens: ${JSON.stringify(project.color_theme ?? {})}
Font pairing: ${project.font_pairing ?? 'not specified'}

User request: ${instruction}

Preserve the existing information architecture and working data-hotspot attributes unless the user explicitly asks to change navigation. Keep the existing design language coherent. Return the complete updated HTML only.`;

  try {
    const code = await generateComponent(context, screen.code);
    const cleanCode = code.replace(/^```html\s*/i, '').replace(/```\s*$/i, '').trim();

    return NextResponse.json({
      code: cleanCode,
      changes: [
        'Applied the requested visual/design change',
        'Preserved the existing screen structure where possible',
        'Kept the UFO HTML/Tailwind output format',
      ],
    });
  } catch (error) {
    console.error('AI edit failed', error);
    return NextResponse.json({ error: 'AI editing failed. Please try again.' }, { status: 502 });
  }
    }
