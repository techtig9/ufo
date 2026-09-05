/**
 * Authentication event vocabulary and the pure helpers that shape request
 * context for it.
 *
 * Deliberately free of imports: lib/auth-events.ts pulls in the Supabase admin
 * client and the mailer, which makes it awkward to unit test and wrong to
 * import from a client component. These pieces are pure, so they live here.
 */

export type AuthEventType =
  | 'SIGNUP'
  | 'EMAIL_VERIFIED'
  | 'PASSWORD_LOGIN'
  | 'GOOGLE_SIGN_IN'
  | 'MFA_LOGIN_SUCCESS'
  | 'PASSWORD_RESET_REQUESTED'
  | 'PASSWORD_CHANGED';

export const AUTH_EVENT_TYPES: AuthEventType[] = [
  'SIGNUP',
  'EMAIL_VERIFIED',
  'PASSWORD_LOGIN',
  'GOOGLE_SIGN_IN',
  'MFA_LOGIN_SUCCESS',
  'PASSWORD_RESET_REQUESTED',
  'PASSWORD_CHANGED',
];

export function isAuthEventType(value: unknown): value is AuthEventType {
  return typeof value === 'string' && (AUTH_EVENT_TYPES as string[]).includes(value);
}

/** Coarse, non-identifying request context. Never a token or a full fingerprint. */
export interface RequestContext {
  ipPrefix?: string;
  userAgentSummary?: string;
}

/**
 * Truncates an IP to a network prefix — /24 for IPv4, /48 for IPv6. Enough to
 * say "a different network than usual" in a notification without retaining a
 * full address for every login.
 */
export function ipPrefixOf(ip: string | null | undefined): string | undefined {
  if (!ip) return undefined;
  const first = ip.split(',')[0].trim();
  if (!first) return undefined;

  if (first.includes(':')) {
    const groups = first.split(':').filter(Boolean).slice(0, 3);
    return groups.length ? `${groups.join(':')}::/48` : undefined;
  }

  const octets = first.split('.');
  if (octets.length !== 4) return undefined;
  if (!octets.every((o) => /^\d{1,3}$/.test(o) && Number(o) <= 255)) return undefined;
  return `${octets[0]}.${octets[1]}.${octets[2]}.0/24`;
}

/** Reduces a User-Agent to "Browser on Platform". Not a fingerprint. */
export function userAgentSummaryOf(ua: string | null | undefined): string | undefined {
  if (!ua) return undefined;

  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'a browser';

  const platform = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad|iPod/.test(ua)
      ? 'iOS'
      : /Mac OS X/.test(ua)
        ? 'macOS'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'an unknown platform';

  return `${browser} on ${platform}`;
}
