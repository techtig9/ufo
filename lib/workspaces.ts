import { createHash, randomBytes, timingSafeEqual } from 'crypto';

/**
 * Workspace invitations, plus a re-export of the role vocabulary.
 *
 * The roles themselves live in `lib/workspace-roles.ts` so that client
 * components can import them without pulling node:crypto into the browser
 * bundle. Server code can keep importing everything from here.
 */

export type { WorkspaceRole, InvitableRole } from './workspace-roles';
export {
  WORKSPACE_ROLES,
  INVITABLE_ROLES,
  isWorkspaceRole,
  isInvitableRole,
  roleAtLeast,
  ROLE_CAPABILITIES,
} from './workspace-roles';

// ---------------------------------------------------------------------------
// Invite tokens.
//
// An invite token is a bearer credential: anyone holding it can join the
// workspace. It is therefore treated like a password — generated with a CSPRNG,
// returned to the caller exactly once, and stored only as a hash, so a database
// leak does not hand out working invitations.
// ---------------------------------------------------------------------------

export const INVITE_TTL_DAYS = 7;

export function generateInviteToken(): string {
  // 32 bytes base64url — ~256 bits, not guessable.
  return randomBytes(32).toString('base64url');
}

export function hashInviteToken(token: string): string {
  // A fast hash is correct here, unlike for a user password: the token is
  // high-entropy random, so there is nothing to brute-force, and invite
  // acceptance should not cost a bcrypt round.
  return createHash('sha256').update(token).digest('hex');
}

/** Constant-time comparison, so a token cannot be recovered from response timing. */
export function inviteTokenMatches(token: string, storedHash: string): boolean {
  const computed = Buffer.from(hashInviteToken(token));
  const stored = Buffer.from(storedHash);
  if (computed.length !== stored.length) return false;
  return timingSafeEqual(computed, stored);
}

export function inviteExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
}
