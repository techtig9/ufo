import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  ASSET_BUCKET,
  assetStoragePath,
  sanitizeAssetName,
  validateAssetUpload,
  MAX_ASSET_BYTES,
  PLAN_STORAGE_BYTES,
} from '@/lib/assets';
import type { Plan } from '@/lib/types';
import { withObservability } from '@/lib/observability';

/**
 * A project's asset library: list it, and start an upload.
 *
 * Uploads are two-step. The server validates the request and reserves the space
 * by writing a `pending` row, then returns a SIGNED UPLOAD URL that the browser
 * PUTs the bytes to directly. The alternative — streaming the file through this
 * route — would put a 25 MB body through a serverless function, and most hosts
 * cap request bodies well below that.
 *
 * The reservation is the important half: quota is counted from rows including
 * pending ones, so two uploads racing cannot both pass a check that neither
 * would pass once the other landed.
 */

const startSchema = z.object({
  name: z.string().min(1).max(300),
  mimeType: z.string().min(1).max(100),
  size: z.number().int().positive().max(MAX_ASSET_BYTES),
});

/** The project, plus the role the caller holds on it. */
async function loadProject(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string
) {
  // Read through the caller's session: RLS returns nothing unless they own the
  // project or hold a workspace role on it.
  const { data } = await supabase
    .from('projects')
    .select('id, user_id, workspace_id')
    .eq('id', projectId)
    .maybeSingle();
  return data;
}

async function handleGET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const project = await loadProject(supabase, id);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const { data: assets, error } = await supabase
    .from('project_assets')
    .select('id, name, mime_type, size_bytes, width, height, status, created_at')
    .eq('project_id', id)
    .eq('status', 'ready')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[assets] list failed', error.message);
    return NextResponse.json({ error: 'Could not load assets' }, { status: 500 });
  }

  // Quota is reported against the project OWNER's plan, not the caller's — the
  // files live in the owner's account, so a collaborator on a free plan does
  // not shrink a Pro owner's library.
  const admin = createAdminClient();
  const [{ data: subscription }, { data: used }] = await Promise.all([
    admin.from('subscriptions').select('plan').eq('user_id', project.user_id).maybeSingle(),
    admin.rpc('project_storage_used', { p_owner: project.user_id }),
  ]);

  const plan = (subscription?.plan ?? 'free') as Plan;

  return NextResponse.json({
    assets: assets ?? [],
    quota: {
      plan,
      usedBytes: Number(used ?? 0),
      limitBytes: PLAN_STORAGE_BYTES[plan] ?? PLAN_STORAGE_BYTES.free,
    },
  });
}

async function handlePOST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = startSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid upload request' },
      { status: 400 }
    );
  }

  const project = await loadProject(supabase, id);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const admin = createAdminClient();
  const [{ data: subscription }, { data: used }] = await Promise.all([
    admin.from('subscriptions').select('plan').eq('user_id', project.user_id).maybeSingle(),
    admin.rpc('project_storage_used', { p_owner: project.user_id }),
  ]);

  const plan = (subscription?.plan ?? 'free') as Plan;
  const name = sanitizeAssetName(parsed.data.name);

  const invalid = validateAssetUpload({
    name,
    mimeType: parsed.data.mimeType,
    size: parsed.data.size,
    plan,
    usedBytes: Number(used ?? 0),
  });
  if (invalid) {
    // 413 for a size or quota problem, 400 for anything else — the client
    // distinguishes "too big" from "wrong kind of file".
    const status = invalid.field === 'size' || invalid.field === 'quota' ? 413 : 400;
    return NextResponse.json({ error: invalid.message, field: invalid.field }, { status });
  }

  // Inserted through the CALLER's session, so the "editors add project assets"
  // policy decides whether they may upload at all. A viewer is refused here,
  // not by a check in this file that could drift from the policy.
  const assetId = crypto.randomUUID();
  const storagePath = assetStoragePath(id, assetId, parsed.data.mimeType);

  const { data: asset, error } = await supabase
    .from('project_assets')
    .insert({
      id: assetId,
      project_id: id,
      uploaded_by: user.id,
      name,
      storage_path: storagePath,
      mime_type: parsed.data.mimeType,
      size_bytes: parsed.data.size,
      status: 'pending',
    })
    .select('id, name, mime_type, size_bytes, status, created_at')
    .single();

  if (error || !asset) {
    // RLS returns an error rather than a row when the policy refuses.
    console.error('[assets] reserve failed', error?.message);
    return NextResponse.json(
      { error: 'You need edit access to this project to upload files.' },
      { status: 403 }
    );
  }

  const { data: signed, error: signError } = await admin.storage
    .from(ASSET_BUCKET)
    .createSignedUploadUrl(storagePath);

  if (signError || !signed) {
    // Roll the reservation back rather than leave space consumed by an upload
    // that can never happen.
    await admin.from('project_assets').delete().eq('id', assetId);
    console.error('[assets] signed upload url failed', signError?.message);
    return NextResponse.json({ error: 'Could not start the upload' }, { status: 500 });
  }

  return NextResponse.json({
    asset,
    upload: { path: signed.path, token: signed.token, bucket: ASSET_BUCKET },
  });
}

/**
 * Wrapped for observability: each request gets a correlation id (honouring an
 * upstream `x-request-id`), is timed and logged with its status, and a thrown
 * error becomes a 500 carrying only that id — never the exception's message,
 * which can contain a connection string or schema detail.
 */
export const GET = withObservability('assets', handleGET);
export const POST = withObservability('assets', handlePOST);
