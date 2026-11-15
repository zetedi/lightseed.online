// THE DOORS OF A PLACE, server side (2026-11-14: no longer a mirror). The law is src/domain/doors's,
// compiled into this build; the one thing added here is WHICH charter a door is read against — this
// node's own. domains.ts owns the plumbing: the challenge, the DNS observation, the grant, the re-homing.
import { charter } from "./charter";
import { doorKind as doorKindUnder, type DoorKind } from '../../src/domain/doors';
export { normalizeDoor, isDoorName, type DoorKind, type DoorClaimFacts, doorClaimRefusal, doorChallengeId } from '../../src/domain/doors';

export const doorKind = (door: string, c: Parameters<typeof doorKindUnder>[1] = charter): DoorKind => doorKindUnder(door, c);
