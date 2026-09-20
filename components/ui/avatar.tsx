/**
 * An avatar that never renders a broken image.
 *
 * There is no image element at all: UFO has no avatar upload, so every caller
 * was passing a name and getting initials anyway. Rendering initials directly
 * removes a network request per row and the broken-image state that follows a
 * 404 from an external gravatar-style URL.
 *
 * The background colour is derived from the name, so the same person is the
 * same colour everywhere — useful for scanning a member list or a comment
 * thread. It is a hash, not randomness: stable across renders and servers.
 */
const TONES = [
  'bg-studio-citron/20 text-brand-text',
  'bg-studio-indigo/25 text-accent-alt-text',
  'bg-studio-coral/20 text-accent-text',
  'bg-n4/40 text-fg-secondary',
] as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function toneFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return TONES[hash % TONES.length];
}

const SIZES = {
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-11 w-11 text-sm',
} as const;

export function Avatar({
  name,
  size = 'md',
}: {
  name: string;
  size?: keyof typeof SIZES;
}) {
  return (
    <span
      // The initials are decoration: the full name is almost always rendered
      // next to it, and "JS" read aloud tells a screen reader user nothing.
      // Callers that show the avatar ALONE pass a title via the wrapper.
      aria-hidden="true"
      title={name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${SIZES[size]} ${toneFor(name)}`}
    >
      {initials(name)}
    </span>
  );
}
