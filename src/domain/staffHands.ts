import type { DomainKey } from './words';

// THE STAFF HANDS (ring 2026-09-09). The node's staff — its superadmin and admins — hold hands
// that reach into other beings' things: standing a tree in a garden that is not theirs,
// editing a tree they do not carry, watering it, editing a community they do not keep. Until
// now those hands were scattered: `isStaff()` in ninety-odd places across the rules, the
// storage rules and the functions, each granted where it was needed and recorded nowhere.
// This is the RECORD. Every hand is named here once, with the sentence it allows and where it
// is enforced; the ones marked switchable are wired through the rules' `staffHand('id')` and
// read `config/staffHands` — a switch the superadmin flips from the admin panel — so a hand
// lent for the moving season can be narrowed later without a deploy. A hand not yet
// switchable is still recorded, so nothing is granted in the dark.
//
// Plain contract — guaranteed: STAFF_HANDS is the closed list; staffHandOn answers the
// switch's value, or the hand's default when the switch is unset or the record missing;
// tests/staffHands.test.ts holds every switchable id present in firestore.rules as
// staffHand('id') and every staffHand('…') in the rules present here. Not guaranteed: that a
// non-switchable hand can be narrowed without editing the rule that grants it — that is what
// "not yet switchable" says.

export interface StaffHand {
  id: string;
  // The sentence the hand allows — a domain key, spoken in the reader's tongue.
  key: DomainKey;
  // Where the hand is enforced (a rule, a storage rule, a function, a client gate).
  enforcedBy: string[];
  // Wired through staffHand('id') in firestore.rules and config/staffHands.
  switchable: boolean;
  defaultOn: boolean;
  since: string;
}

export const STAFF_HANDS: readonly StaffHand[] = [
  { id: 'link_mint', key: 'hand_link_mint', enforcedBy: ['firestore.rules links create (every rel but grows_in)'], switchable: true, defaultOn: true, since: '2026-05' },
  { id: 'garden_stand', key: 'hand_garden_stand', enforcedBy: ['firestore.rules links create grows_in', 'LifetreeDetail canEdit → TreeGardens'], switchable: true, defaultOn: true, since: '2026-09-08' },
  { id: 'tree_edit', key: 'hand_tree_edit', enforcedBy: ['firestore.rules lifetrees update (both staff branches)'], switchable: true, defaultOn: true, since: '2026-06' },
  { id: 'tree_water', key: 'hand_tree_water', enforcedBy: ['firestore.rules pulses create care:watering'], switchable: true, defaultOn: true, since: '2026-07-20' },
  { id: 'community_edit', key: 'hand_community_edit', enforcedBy: ['firestore.rules communities update'], switchable: true, defaultOn: true, since: '2026-05' },
  { id: 'community_assets', key: 'hand_community_assets', enforcedBy: ['storage.rules /{allPaths=**} write (the two-document budget forbids a switch there)'], switchable: false, defaultOn: true, since: '2026-05' },
  { id: 'being_delete', key: 'hand_being_delete', enforcedBy: ['firestore.rules lifetrees/visions/communities/users delete', 'functions deleteUserAsAdmin'], switchable: false, defaultOn: true, since: '2026-05' },
  { id: 'pulse_mend', key: 'hand_pulse_mend', enforcedBy: ['firestore.rules pulses create/update/delete staff branches', 'mendPulseDomain / mendVisionDomain'], switchable: false, defaultOn: true, since: '2026-08' },
  { id: 'letters', key: 'hand_letters', enforcedBy: ['functions sendNewsletterEmails (the node place)', 'firestore.rules subscriptions/mail read'], switchable: false, defaultOn: true, since: '2026-07' },
  { id: 'people_read', key: 'hand_people_read', enforcedBy: ['firestore.rules users/persons/usage read', 'functions listUsersAsAdmin'], switchable: false, defaultOn: true, since: '2026-05' },
  { id: 'node_config', key: 'hand_node_config', enforcedBy: ['firestore.rules config/limits, config/staffHands, initiates, admins'], switchable: false, defaultOn: true, since: '2026-05' },
];

export type StaffHandSwitches = Partial<Record<string, boolean>>;

export const staffHandById = (id: string): StaffHand | undefined => STAFF_HANDS.find((h) => h.id === id);

// Is this hand lent right now? The switch, else the hand's default.
export const staffHandOn = (switches: StaffHandSwitches | null | undefined, id: string): boolean => {
  const hand = staffHandById(id);
  if (!hand) return false;
  const v = switches?.[id];
  return typeof v === 'boolean' ? v : hand.defaultOn;
};
