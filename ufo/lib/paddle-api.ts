const PADDLE_API_BASE = process.env.PADDLE_API_BASE || 'https://api.paddle.com';

/**
 * Cancels a Paddle subscription immediately (effective_from: immediately).
 * Swap PADDLE_API_BASE to https://sandbox-api.paddle.com while testing.
 * Failures are logged, not thrown — account deletion shouldn't hang on a
 * billing-provider hiccup; reconcile any stragglers from the Paddle
 * dashboard if this ever fails silently.
 */
export async function cancelPaddleSubscription(subscriptionId: string): Promise<boolean> {
  if (!process.env.PADDLE_API_KEY) {
    console.warn('PADDLE_API_KEY not set — skipping subscription cancellation');
    return false;
  }

  try {
    const res = await fetch(`${PADDLE_API_BASE}/subscriptions/${subscriptionId}/cancel`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PADDLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ effective_from: 'immediately' }),
    });
    return res.ok;
  } catch (err) {
    console.error('Paddle cancellation failed', err);
    return false;
  }
}
