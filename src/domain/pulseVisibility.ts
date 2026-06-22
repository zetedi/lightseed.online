import type { Pulse, PulseVisibility } from './pulse';
import type { Community } from './community';

// The visibility generator — the single source of truth for "who may see a pulse".
// The Firestore rules (firestore.rules → canReadPulse) mirror canView() exactly, and the
// list-query filters (queryableLevels) keep client queries to docs the rules will allow,
// so Firestore never rejects a whole query. Change this and the rules together.

export type PulseScope = 'tree' | 'community' | 'node';

export const PULSE_VISIBILITIES: PulseVisibility[] = ['public', 'node', 'community', 'circle', 'private'];

// A pulse just enough to reason about its audience — works for partial/raw docs too.
type ScopedPulse = Pick<Pulse, 'lifetreeId' | 'communityId' | 'authorId' | 'visibility'>;

const treeIdOf = (p: ScopedPulse): string | undefined => p.lifetreeId;
const visOf = (p: ScopedPulse): PulseVisibility => p.visibility || 'public';

// Scope is DERIVED from where the pulse is rooted — never stored. (The edge hiding in the node.)
export function pulseScope(p: ScopedPulse): PulseScope {
  if (treeIdOf(p)) return 'tree';
  if (p.communityId) return 'community';
  return 'node';
}

// The visibility levels a creator may choose at a given scope (drives the form selector).
export function visibilitiesForScope(scope: PulseScope): PulseVisibility[] {
  switch (scope) {
    case 'tree': return ['public', 'circle', 'private'];
    case 'community': return ['public', 'community', 'private'];
    case 'node': return ['public', 'node', 'private'];
  }
}

// Events are invitations, so they default to the widest audience; the creator narrows them.
export function defaultVisibility(_scope: PulseScope): PulseVisibility {
  return 'public';
}

// The viewer's relationship to the commons — exactly the facts the Firestore rules check.
export interface Viewer {
  uid?: string | null;
  isStaff?: boolean;
  communityIds?: string[];   // communities the viewer belongs to (member or owner)
  guardedTreeIds?: string[]; // trees the viewer guards, owns or stewards
}

// THE generator: may this viewer see that this pulse exists? Firestore's canReadPulse mirrors this.
export function canView(pulse: ScopedPulse, viewer: Viewer): boolean {
  if (viewer.isStaff) return true;
  if (viewer.uid && pulse.authorId === viewer.uid) return true; // the author always sees their own
  switch (visOf(pulse)) {
    case 'public': return true;
    case 'node': return !!viewer.uid;
    case 'community': return !!pulse.communityId && (viewer.communityIds || []).includes(pulse.communityId);
    case 'circle': { const t = treeIdOf(pulse); return !!t && (viewer.guardedTreeIds || []).includes(t); }
    case 'private': return false; // author/staff already handled above
    default: return true;
  }
}

// The levels a viewer may REQUEST in a scoped list query, so Firestore won't reject it.
// Excludes 'private' (those are reached only via author-scoped queries, which are self-safe).
// 'community'/'circle' are included ONLY when the viewer qualifies for the scope being queried —
// so a broad feed (no scope ctx) requests just public + node, and members-only pulses surface
// only in their own scoped views (a community's events tab, a tree's page).
export function queryableLevels(viewer: Viewer, ctx?: { communityId?: string; treeId?: string }): PulseVisibility[] {
  if (viewer.isStaff) return PULSE_VISIBILITIES.filter(v => v !== 'private');
  const levels: PulseVisibility[] = ['public'];
  if (viewer.uid) levels.push('node');
  if (ctx?.communityId && (viewer.communityIds || []).includes(ctx.communityId)) levels.push('community');
  if (ctx?.treeId && (viewer.guardedTreeIds || []).includes(ctx.treeId)) levels.push('circle');
  return levels;
}

// Who may edit (or delete) an event: its creator, the admin (owner) of its community when it
// is a community event, or the owner of the node (host community) when it is a node event.
// Staff always. `community` is the event's community; `hostCommunity` is the node's.
export function canEditEvent(
  event: Pick<Pulse, 'authorId' | 'communityId'>,
  viewer: Viewer,
  ctx?: { hostCommunity?: Community | null; community?: Community | null },
): boolean {
  if (!viewer.uid) return false;
  if (viewer.isStaff) return true;
  if (event.authorId === viewer.uid) return true;                  // the creator
  if (event.communityId) return ctx?.community?.ownerId === viewer.uid; // community admin
  return ctx?.hostCommunity?.ownerId === viewer.uid;               // node owner
}
