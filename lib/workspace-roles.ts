/**
 * Workspace roles — the pure half, with no imports at all.
 *
 * Split out of `lib/workspaces.ts` because that module imports node:crypto for
 * invite tokens, and a client component that only needs `roleAtLeast` must not
 * drag node crypto into the browser bundle. Same reasoning as
 * `lib/auth-event-types.ts`.
 *
 * The rank order is duplicated in SQL (workspace_role_rank in migration 010)
 * because RLS policies must answer "at least editor?" without a round trip to
 * the app. The tests assert the two against each other, so they cannot drift
 * apart silently.
 */

export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer';

/** Roles that can be granted by invitation. Ownership transfers separately. */
export type InvitableRole = Exclude<WorkspaceRole, 'owner'>;

export const WORKSPACE_ROLES: WorkspaceRole[] = ['owner', 'admin', 'editor', 'viewer'];
export const INVITABLE_ROLES: InvitableRole[] = ['admin', 'editor', 'viewer'];

const RANK: Record<WorkspaceRole, number> = {
  owner: 4,
  admin: 3,
  editor: 2,
  viewer: 1,
};

export function isWorkspaceRole(value: unknown): value is WorkspaceRole {
  return typeof value === 'string' && (WORKSPACE_ROLES as string[]).includes(value);
}

export function isInvitableRole(value: unknown): value is InvitableRole {
  return typeof value === 'string' && (INVITABLE_ROLES as string[]).includes(value);
}

/** True when `role` is at least `minimum`. */
export function roleAtLeast(role: WorkspaceRole | null | undefined, minimum: WorkspaceRole): boolean {
  if (!role) return false;
  return RANK[role] >= RANK[minimum];
}

/** What each role may do, so the UI can state it rather than imply it. */
export const ROLE_CAPABILITIES: Record<WorkspaceRole, string> = {
  owner: 'Full control, including deleting the workspace.',
  admin: 'Manage members and invitations, plus everything an editor can do.',
  editor: 'Create and edit the workspace’s projects, but not manage people.',
  viewer: 'Read-only: open projects and comment, but not change them.',
};
