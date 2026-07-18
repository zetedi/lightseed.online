// The care economy — lifeseed's value cycle, prepared for payments.
//
// One tree costs about €21 a year to sustain. A membership (€21/yr) protects exactly one
// tree: €15 reaches the person who tends it, €3 the community it stands in, €3 the node
// (which spends it on intelligence — the hosted AI first, node-level models later).
// A full grove is 144 tended trees: at €15 each that is a real wage in many places —
// and payments flow to people, like a gofundme with trees, not to a platform.
//
// Only validated trees can receive support (initiated is the validated status), and a
// grove must be a walk, not a warehouse: neighbouring supported trees of one carer stand
// at least a five-minute walk apart.
//
// Pure module: the maths and the rules, testable. The payment rail itself (webhooks,
// `supports` documents — server-written only) lands separately.

export const YEARLY_TREE_SUPPORT_EUR = 21; // sustains one tree for one year
export const CARER_SHARE_EUR = 15;         // to the one who tends
export const COMMUNITY_SHARE_EUR = 3;      // to the community the tree stands in
export const NODE_SHARE_EUR = 3;           // to the node — spent on intelligence

export const FULL_GROVE = 144;             // 12 + 132 — a full carer's grove

// Grove spacing: at least a five-minute walk between one carer's supported trees
// (~70 m/min on foot → 350 m).
export const MIN_TREE_WALK_MIN = 5;
export const MIN_TREE_SPACING_M = 350;

export type SupportChoice = 'supporter' | 'ai_need'; // chosen by the member, or by need

// A year of support for one tree — the document the payment rail will write.
export interface TreeSupport {
  id: string;
  supporterUid: string;
  lifetreeId: string;
  eur: number;            // YEARLY_TREE_SUPPORT_EUR at v1
  choice: SupportChoice;
  periodStartMs: number;
  periodEndMs: number;
}

// Split an amount along the 15/3/3 proportions, in cents, without losing a cent:
// the carer receives the remainder after the community and node shares round down.
export const splitSupport = (eur: number = YEARLY_TREE_SUPPORT_EUR): { carer: number; community: number; node: number } => {
  const cents = Math.round(eur * 100);
  const community = Math.floor((cents * COMMUNITY_SHARE_EUR) / YEARLY_TREE_SUPPORT_EUR);
  const node = Math.floor((cents * NODE_SHARE_EUR) / YEARLY_TREE_SUPPORT_EUR);
  return { carer: (cents - community - node) / 100, community: community / 100, node: node / 100 };
};

// A carer's yearly income at full care, capped at the grove.
export const carerYearlyEur = (tendedTrees: number): number =>
  Math.max(0, Math.min(tendedTrees, FULL_GROVE)) * CARER_SHARE_EUR;

// Only validated trees can receive support.
export const canReceiveSupport = (tree: { validated?: boolean }): boolean => tree.validated === true;

// Great-circle distance in metres (haversine) — the spacing rule's ruler.
export const distanceM = (a: { lat: number; lng: number }, b: { lat: number; lng: number }): number => {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

// May this tree join the carer's grove? True when it stands at least a walk away from
// every tree the carer already tends. (Unplaced trees are the caller's concern.)
export const spacingOk = (
  candidate: { lat: number; lng: number },
  grove: { lat: number; lng: number }[],
): boolean => grove.every(t => distanceM(candidate, t) >= MIN_TREE_SPACING_M);
