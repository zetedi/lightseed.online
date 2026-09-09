// THE DOORS OF A PLACE, server side — the pure half. MIRRORS src/domain/doors.ts (the door's
// kind and the claim's refusals); tests/doors.test.ts holds them equal. index.ts owns the
// plumbing: the challenge, the DNS observation, the grant, the alias and the re-homing.
import { charter, charterOwnDomains, type Charter } from "./charter";

const HOSTNAME_RE = /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/;
export const normalizeDoor = (raw: string): string =>
    (raw || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[/?#].*$/, '');
export const isDoorName = (door: string): boolean => HOSTNAME_RE.test(door);
export type DoorKind = 'node' | 'face' | 'custom';
export const doorKind = (door: string, c: Pick<Charter, 'domain' | 'aliases' | 'faces' | 'firebase'> = charter): DoorKind => {
    const d = normalizeDoor(door);
    if (charterOwnDomains(c as Charter).includes(d)) return 'node';
    for (const f of c.faces) {
        if (d === f.door || d === `${f.site}.web.app` || d === `${f.site}.firebaseapp.com`) return 'face';
    }
    if (d === `${c.firebase.projectId}.web.app` || d === `${c.firebase.projectId}.firebaseapp.com`) return 'face';
    return 'custom';
};
export interface DoorClaimFacts {
    door: string; kind: DoorKind;
    community: { id: string; domain?: string | null; domainAliases?: readonly string[] | null };
    claimedBy: { id: string } | null;
}
export const doorClaimRefusal = (f: DoorClaimFacts): string | null => {
    const d = normalizeDoor(f.door);
    if (!isDoorName(d)) return 'door_not_hostname';
    if (f.kind === 'node') return 'door_is_node';
    if (d === normalizeDoor(f.community.domain || '')) return 'door_is_domain';
    if ((f.community.domainAliases || []).map(normalizeDoor).includes(d)) return 'door_already';
    if (f.claimedBy && f.claimedBy.id !== f.community.id) return 'door_taken';
    return null;
};
export const doorChallengeId = (communityId: string, door: string): string => `${communityId}__${normalizeDoor(door)}`;
