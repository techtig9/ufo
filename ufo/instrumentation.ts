export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
    const { validateEnv } = await import('./lib/validate-env');
    try {
      validateEnv();
    } catch (err) {
      const Sentry = await import('@sentry/nextjs');
      Sentry.captureException(err);
      throw err; // still fail the boot — just report it first
    }
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}
