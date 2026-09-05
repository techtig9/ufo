import { ImageResponse } from 'next/og';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const alt = 'An interactive prototype on ufo';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * The card people see when a prototype link is pasted into Slack, a DM or a
 * ticket.
 *
 * A password-protected or expired prototype gets a deliberately blank card:
 * link unfurling happens without the visitor's password, so putting the project
 * name here would leak it to anyone the link was forwarded to — the same reason
 * generateMetadata withholds the title.
 */
export default async function ProtoOGImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let name: string | null = null;
  try {
    const admin = createAdminClient();
    const { data: share } = await admin
      .from('shares')
      .select('project_id, is_public, expires_at, password_hash')
      .eq('slug', slug)
      .maybeSingle();

    const live =
      share?.is_public &&
      !share.password_hash &&
      (!share.expires_at || new Date(share.expires_at).getTime() > Date.now());

    if (live) {
      const { data: project } = await admin
        .from('projects')
        .select('name')
        .eq('id', share.project_id)
        .maybeSingle();
      name = project?.name ?? null;
    }
  } catch {
    // A card is not worth failing a page load over — fall through to the
    // generic one.
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          backgroundColor: '#101114',
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.10) 2px, transparent 2px)',
          backgroundSize: '32px 32px',
          padding: '80px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '20px',
              height: '20px',
              borderRadius: '999px',
              backgroundColor: '#D4FF4F',
              display: 'flex',
            }}
          />
          <div style={{ color: '#737D8F', fontSize: '26px', letterSpacing: '0.22em', display: 'flex' }}>
            UFO PROTOTYPE
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            color: '#FFFFFF',
            fontSize: name && name.length > 34 ? '62px' : '82px',
            fontWeight: 600,
            lineHeight: 1.1,
            marginTop: '28px',
            maxWidth: '1000px',
          }}
        >
          {name ?? 'An interactive prototype'}
        </div>

        <div style={{ display: 'flex', color: '#B5B7C0', fontSize: '30px', marginTop: '24px' }}>
          Click through the flow and leave feedback.
        </div>
      </div>
    ),
    size
  );
}
