import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { ASSET_BUCKET, isScriptableType, sanitizeAssetName } from '@/lib/assets';
import { withObservability } from '@/lib/observability';

/**
 * A single asset: confirm its upload, get a viewing URL, rename it, delete it.
 *
 * Every path re-reads the row through the CALLER's session first, so the
 * policies from migration 012 decide access. The admin client is used only for
 * the Storage operations, which have no session of their own.
 */

/** Read the asset as the caller. Returns null when RLS says they cannot see it. */
async function loadAsset(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const { data } = await supabase
    .from('project_assets')
    .select('id, project_id, name, storage_path, mime_type, size_bytes, status')
    .eq('id', id)
    .maybeSingle();
  return data;
}

const patchSchema = z.object({
  /** Mark a reserved row as uploaded. */
  confirm: z.literal(true).optional(),
  /** New display name. Never moves the object — see migration 012. */
  name: z.string().min(1).max(300).optional(),
});

async function handleGET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const asset = await loadAsset(supabase, id);
  if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

  // A short-lived signed URL rather than a public one: the bucket is private
  // precisely so a file cannot be read forever by anyone who ever saw its URL.
  const admin = createAdminClient();
  const { data: signed, error } = await admin.storage
    .from(ASSET_BUCKET)
    .createSignedUrl(asset.storage_path, 3600, {
      // SVG and PDF are documents a browser will execute or navigate rather
      // than render inertly. Forcing a download turns a stored-XSS vector into
      // a file the user chose to open.
      download: isScriptableType(asset.mime_type) ? asset.name : undefined,
    });

  if (error || !signed) {
    console.error('[assets] sign failed', error?.message);
    return NextResponse.json({ error: 'Could not open this asset' }, { status: 500 });
  }

  return NextResponse.json({ url: signed.signedUrl, expiresInSeconds: 3600 });
}

async function handlePATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
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

  const parsed = patchSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid update' }, { status: 400 });
  }

  const asset = await loadAsset(supabase, id);
  if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

  const update: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) update.name = sanitizeAssetName(parsed.data.name);

  if (parsed.data.confirm) {
    // Only promote a row to `ready` once the object is genuinely in the bucket.
    // Trusting the client's word here would let a caller reserve quota-free
    // library entries pointing at nothing.
    const admin = createAdminClient();
    const folder = asset.storage_path.split('/')[0];
    const file = asset.storage_path.split('/').slice(1).join('/');
    const { data: listed } = await admin.storage
      .from(ASSET_BUCKET)
      .list(folder, { search: file, limit: 1 });

    const uploaded = (listed ?? []).some((entry) => entry.name === file);
    if (!uploaded) {
      return NextResponse.json(
        { error: 'The file has not finished uploading yet.' },
        { status: 409 }
      );
    }
    // `status` is not in the client UPDATE grant, so this write goes through
    // the admin client — after the check above, never on the client's say-so.
    await admin.from('project_assets').update({ status: 'ready' }).eq('id', id);
  }

  if (Object.keys(update).length > 0) {
    // The rename goes through the caller's session: `grant update (name)` is
    // what limits a client to the display name.
    const { error } = await supabase.from('project_assets').update(update).eq('id', id);
    if (error) {
      return NextResponse.json(
        { error: 'You need edit access to this project to rename files.' },
        { status: 403 }
      );
    }
  }

  const fresh = await loadAsset(supabase, id);
  return NextResponse.json({ asset: fresh });
}

async function handleDELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const asset = await loadAsset(supabase, id);
  if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

  // The ROW is deleted through the caller's session, so the "editors delete
  // project assets" policy authorises it. Only once that succeeds is the object
  // removed — deleting the bytes first and then failing the row would leave a
  // library entry pointing at nothing, which is the worse failure.
  const { data: deleted, error } = await supabase
    .from('project_assets')
    .delete()
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error || !deleted) {
    return NextResponse.json(
      { error: 'You need edit access to this project to delete files.' },
      { status: 403 }
    );
  }

  const admin = createAdminClient();
  const { error: storageError } = await admin.storage.from(ASSET_BUCKET).remove([asset.storage_path]);
  if (storageError) {
    // The row is gone, so the user sees the asset removed and their quota
    // freed. The orphaned object is logged for cleanup rather than reported as
    // a failure of an operation that, from the user's side, succeeded.
    console.error('[assets] orphaned object', asset.storage_path, storageError.message);
  }

  return NextResponse.json({ ok: true });
}

/**
 * Wrapped for observability: each request gets a correlation id (honouring an
 * upstream `x-request-id`), is timed and logged with its status, and a thrown
 * error becomes a 500 carrying only that id — never the exception's message,
 * which can contain a connection string or schema detail.
 */
export const GET = withObservability('assets.item', handleGET);
export const PATCH = withObservability('assets.item', handlePATCH);
export const DELETE = withObservability('assets.item', handleDELETE);
