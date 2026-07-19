// The care economy — lifeseed's value cycle, prepared for payments.
//
// The yearly care price is a GLOBAL PARAMETER of the instance, set by the instance
// covenant / board (the keeper's decision, 2026-07-19); 21 is its value at birth. A
// membership at that price protects exactly one tree, split along 15/3/3 proportions:
// the largest share reaches the person who tends it, one small share the community it
// stands in, one the node (which spends it on intelligence — the hosted AI first,
// node-level models later). Payments flow to people, like a gofundme with trees, not
// to a platform.
//
// Only validated trees can receive support (initiated is the validated status), and a
// grove must be a walk, not a warehouse: neighbouring supported trees of one carer stand
// at least a five-minute walk apart.
//
// Pure module: the maths and the rules, testable. The payment rail itself (webhooks,
// `supports` documents — server-written only) lands separately, and will read the live
// price from the instance config the covenant/board governs (normalizeCareParams below).

export const DEFAULT_YEARLY_TREE_SUPPORT_EUR = 21; // the birth value of the global parameter
export const YEARLY_TREE_SUPPORT_EUR = DEFAULT_YEARLY_TREE_SUPPORT_EUR; // today's live value
export const CARER_SHARE_EUR = 15;         // to the one who tends (proportion of 21)
export const COMMUNITY_SHARE_EUR = 3;      // to the community the tree stands in
export const NODE_SHARE_EUR = 3;           // to the node — spent on intelligence

// The instance-level care parameters, as the covenant/board will govern them (a config doc,
// mirrored by the coming payment rail). Missing or invalid values fall back to birth defaults;
// the 15/3/3 split stays proportional whatever the price (splitSupport).
export interface CareParams {
  yearlyTreeSupportEur: number;
}

export const DEFAULT_CARE_PARAMS: CareParams = {
  yearlyTreeSupportEur: DEFAULT_YEARLY_TREE_SUPPORT_EUR,
};

export const normalizeCareParams = (raw: any): CareParams => {
  const n = Number(raw?.yearlyTreeSupportEur);
  return { yearlyTreeSupportEur: Number.isFinite(n) && n > 0 ? n : DEFAULT_YEARLY_TREE_SUPPORT_EUR };
};

// The carer-wage cap: how many tended trees one carer may draw support from. Held at the
// first form's 144 (the old 12 + 132) when the planting cap grew to the UN roll; whether
// the wage cap should follow the new cap is its own coming ring.
export const FULL_GROVE = 144;

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
