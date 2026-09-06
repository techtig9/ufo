import Link from 'next/link';

/**
 * Shown where the product needs a database that is not configured yet.
 *
 * The alternative — letting the page render and fail on its first query — gives
 * a visitor a spinner or a 500 with nothing to act on. This says exactly what
 * is missing and what to do, which is the difference between a deployment that
 * looks broken and one that is visibly waiting on a step.
 */
export function SetupNotice({
  what = 'This part of UFO',
}: {
  /** What specifically is unavailable, e.g. "Signing in". */
  what?: string;
}) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-6 py-16">
      <div className="panel p-8">
        <p className="font-mono text-xs uppercase tracking-wider text-brand-text">Setup required</p>
        <h1 className="mt-3 font-display text-2xl font-medium text-fg">
          {what} needs a database connection
        </h1>
        <p className="mt-3 text-sm text-fg-muted">
          This deployment is running without Supabase credentials, so it can serve its public
          pages but cannot sign anyone in, store a project, or generate a design.
        </p>

        <div className="mt-6 rounded-lg border border-edge bg-surface-subtle p-4">
          <p className="text-xs font-medium text-fg-muted">Set these, then redeploy:</p>
          <ul className="mt-2 space-y-1 font-mono text-[11px] text-fg-faint">
            <li>NEXT_PUBLIC_SUPABASE_URL</li>
            <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
            <li>SUPABASE_SERVICE_ROLE_KEY</li>
            <li>GROQ_API_KEY</li>
          </ul>
          <p className="mt-3 text-[11px] leading-4 text-fg-faint">
            A redeploy is required rather than a restart: the two{' '}
            <code className="text-fg-muted">NEXT_PUBLIC_</code> values are compiled into the
            browser bundle at build time. The database migrations in{' '}
            <code className="text-fg-muted">supabase/migrations</code> also need applying — see
            GO_LIVE_READINESS.md.
          </p>
        </div>

        <Link href="/" className="mt-6 inline-block text-sm text-brand-text hover:underline">
          ← Back to the home page
        </Link>
      </div>
    </main>
  );
}
