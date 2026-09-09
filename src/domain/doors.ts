import type { DomainKey } from './words';
import type { Charter } from './charter';

// THE DOORS OF A PLACE (ring 2026-09-09). A community answers at its canonical domain and at
// its DOORS — the hostnames its `domainAliases` name. Three doors this week were claimed by a
// steward's script; a keeper had no hand. This law gives them one, and keeps the one danger
// out: an alias is a CLAIM on a hostname the shell resolves to a community, so a keeper who
// typed another place's door would capture it. Hence a door is claimed by PROOF, like the
// canonical domain — a TXT record at the door's own name that the server observes — except a
// FACE door of this node (perauset.web.app…), which no keeper's DNS can prove: that one is
// granted by the node's steward (a named staff hand, door_grant), the charter's faces saying
// which community a face door belongs to.
//
// Plain contract — guaranteed: doorKind names every hostname 'node' | 'face' | 'custom' from
// the charter alone; doorClaimRefusal answers why a claim may not be made (or null) from the
// facts alone — hostname, the community's own names, and whether another place already claims
// it; doorChallengeId is deterministic. Not guaranteed: who is a keeper, and the DNS
// observation — the server's (functions startDoorClaim / checkDoorClaim / grantDoor).

const HOSTNAME_RE = /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/;

export const normalizeDoor = (raw: string): string =>
  (raw || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[/?#].*$/, '');

export const isDoorName = (door: string): boolean => HOSTNAME_RE.test(door);

export type DoorKind = 'node' | 'face' | 'custom';

// A face door is one the charter names as a face's door, or the project's own web.app /
// firebaseapp.com hostname of a face's site.
export const doorKind = (door: string, c: Pick<Charter, 'domain' | 'aliases' | 'faces' | 'firebase'>): DoorKind => {
  const d = normalizeDoor(door);
  if ([c.domain, ...c.aliases].map(normalizeDoor).includes(d)) return 'node';
  for (const f of c.faces) {
    if (d === f.door || d === `${f.site}.web.app` || d === `${f.site}.firebaseapp.com`) return 'face';
  }
  if (d === `${c.firebase.projectId}.web.app` || d === `${c.firebase.projectId}.firebaseapp.com`) return 'face';
  return 'custom';
};

export interface DoorClaimFacts {
  door: string;
  kind: DoorKind;
  community: { id: string; domain?: string | null; domainAliases?: readonly string[] | null };
  // Another community that already names this hostname (its domain or an alias), if any.
  claimedBy: { id: string } | null;
}

export const doorClaimRefusal = (f: DoorClaimFacts): DomainKey | null => {
  const d = normalizeDoor(f.door);
  if (!isDoorName(d)) return 'door_not_hostname';
  if (f.kind === 'node') return 'door_is_node';
  if (d === normalizeDoor(f.community.domain || '')) return 'door_is_domain';
  if ((f.community.domainAliases || []).map(normalizeDoor).includes(d)) return 'door_already';
  if (f.claimedBy && f.claimedBy.id !== f.community.id) return 'door_taken';
  return null;
};

export const doorChallengeId = (communityId: string, door: string): string => `${communityId}__${normalizeDoor(door)}`;

// What the panel shows for each door: the alias already answering, or a claim in flight.
export type DoorState = 'open' | 'waiting_proof' | 'waiting_grant';
export interface DoorRow { door: string; state: DoorState; kind: DoorKind; recordName?: string; recordValue?: string }
export const doorRows = (
  community: { domainAliases?: readonly string[] | null },
  claims: readonly { door: string; kind: DoorKind; recordName?: string; recordValue?: string }[],
): DoorRow[] => {
  const open = (community.domainAliases || []).map(normalizeDoor).filter(Boolean);
  const rows: DoorRow[] = open.map((door) => ({ door, state: 'open', kind: 'custom' }));
  for (const c of claims) {
    const door = normalizeDoor(c.door);
    if (open.includes(door)) continue;
    rows.push({ door, kind: c.kind, state: c.kind === 'face' ? 'waiting_grant' : 'waiting_proof', recordName: c.recordName, recordValue: c.recordValue });
  }
  return rows;
};
