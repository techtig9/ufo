/**
 * Escapes text before interpolation into an HTML email body.
 *
 * Kept in its own dependency-free module so it can be unit tested directly and
 * reused anywhere without dragging in the Resend client.
 *
 * The contact form previously dropped the visitor-supplied message and address
 * straight into the markup. Since /api/contact takes anonymous input and the
 * resulting mail is sent from ufo's own verified domain, that let anyone inject
 * arbitrary markup and links into mail that appears to come from us.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
