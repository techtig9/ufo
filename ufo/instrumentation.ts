export async function register() {
  // Only in the Node runtime (not the edge runtime, which some routes may
  // opt into and which doesn't get instrumentation the same way).
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnv } = await import('./lib/validate-env');
    validateEnv();
  }
}
