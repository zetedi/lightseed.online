// THE WORLD OF A COMMUNITY (ring 2026-11-03): which records travel when ONE community leaves a node
// — the adoption ladder's last rung, a community crossing to its own node by the same bundle law.
// Pure over bundle documents. Three belongings, each said out loud:
//   the CIRCLE — the anchor, the keeper mirror, every member, keeper and steward link — travels
//     whole: their account and person records, their keys;
//   everything a member ANCHORS travels with them (Zoltán's word, 2026-11-03: a keeper of many places
//     carries their whole garden wherever they are a member): their trees of every kind with their
//     whole chains — a chain is never cut — their loves, their occupancy, their visions, offerings,
//     light houses and intelligences;
//   every being PLACED in the community — its place of record (`domain`, resolved through the faces'
//     aliases by the injected resolver) names this community — travels whatever its anchor: the trees
//     planted at the place, the visions, the light houses, the chain-less blocks (events, decisions)
//     by id or place.
// Then what belongs by field (the community's invitations, glow, rays of its trees, subscribers of
// its domain), every EDGE whose both ends travel, and — because signed history names people — the
// PUBLIC person record of everyone the travelling records name, so the far side can bind them.
// A guest tree that merely grows in this forest stays home (the garden law keeps its domain and
// ownership), and each such edge is named as left with its reason. The rest of the node is simply
// not this community's world.
import { localUidCensus, type BundleDoc } from './bundle';
import { bundleSignature } from './seedBundle.mjs';

export const CIRCLE_RELS: readonly string[] = ['member', 'keeper', 'steward'];
export interface CommunityLeft { path: string; reason: string }
export interface CommunityCrossing {
  docs: BundleDoc[];     // the community's world, sorted by path
  members: string[];     // the circle: anchor, keepers, members, stewards
  named: string[];       // everyone else the world names — their public person record travels
  left: CommunityLeft[]; // what touches the community but stays, with why
}
export type CommunityCrossingProblem = 'community_missing';
// A record's place of record → the community it names, or null when the place names none.
export type PlaceResolver = (domain: string | null) => string | null;

const text = (value: unknown): string | null => (typeof value === 'string' && value.length > 0 ? value : null);
const texts = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);
const idOf = (path: string): string => path.split('/')[1];
const rootOf = (path: string): string => path.split('/')[0];
const lower = (value: string): string => value.trim().toLowerCase().replace(/^www\./, '');

// The resolver from the soil and the charter: every community's own domain, and for the face whose
// door or domains carry that domain, every alias of that face; the hand may add aliases of its own
// (an old door the charter no longer names).
export const placeResolverOf = (
  docs: BundleDoc[],
  faces: ReadonlyArray<{ door?: unknown; domains?: unknown }> = [],
  aliases: ReadonlyArray<{ alias: string; communityId: string }> = [],
): PlaceResolver => {
  const places = new Map<string, string>();
  for (const doc of docs) {
    if (!/^communities\/[^/]+$/.test(doc.path)) continue;
    const domain = text(doc.data.domain);
    if (!domain) continue;
    const id = idOf(doc.path);
    places.set(lower(domain), id);
    for (const face of faces) {
      const names = [text(face.door), ...texts(face.domains)].filter((name): name is string => name !== null).map(lower);
      if (names.includes(lower(domain))) for (const name of names) if (!places.has(name)) places.set(name, id);
    }
  }
  for (const { alias, communityId } of aliases) places.set(lower(alias), communityId);
  return domain => (domain === null ? null : places.get(lower(domain)) ?? null);
};

export function communityCrossing(docs: BundleDoc[], communityId: string, options: { placeOf?: PlaceResolver } = {}): CommunityCrossing | CommunityCrossingProblem {
  const byPath = new Map(docs.map(doc => [doc.path, doc.data]));
  const community = byPath.get(`communities/${communityId}`);
  if (!community) return 'community_missing';
  const placeOf = options.placeOf ?? placeResolverOf(docs);
  const placedHere = (data: Record<string, unknown>): boolean => placeOf(text(data.domain)) === communityId;
  const roots = new Map<string, BundleDoc[]>();
  for (const doc of docs) {
    if (doc.path.split('/').length !== 2) continue;
    const list = roots.get(rootOf(doc.path)) ?? [];
    list.push(doc);
    roots.set(rootOf(doc.path), list);
  }
  const top = (collection: string): BundleDoc[] => roots.get(collection) ?? [];
  const edges = [...top('links'), ...top('secretLinks')];
  const left: CommunityLeft[] = [];

  // The circle.
  const members = new Set<string>();
  const anchor = text(community.anchorUid);
  if (anchor) members.add(anchor);
  for (const uid of texts(community.keeperUids)) members.add(uid);
  for (const edge of edges) {
    const from = text(edge.data.from), rel = text(edge.data.rel);
    if (edge.data.to === communityId && from && rel && CIRCLE_RELS.includes(rel)) members.add(from);
  }
  const ofMember = (data: Record<string, unknown>, field: string): boolean => members.has(text(data[field]) ?? '');

  // Everything a member anchors, and every being placed here.
  const trees = new Set(top('lifetrees').filter(doc => ofMember(doc.data, 'anchorUid') || placedHere(doc.data)).map(doc => idOf(doc.path)));
  const visions = new Set(top('visions').filter(doc => ofMember(doc.data, 'authorId') || trees.has(text(doc.data.lifetreeId) ?? '') || placedHere(doc.data)).map(doc => idOf(doc.path)));
  const houses = new Set(top('lightHouses').filter(doc => ofMember(doc.data, 'anchorUid') || placedHere(doc.data)).map(doc => idOf(doc.path)));
  const pulses = new Set<string>();
  for (const doc of top('pulses')) {
    const tree = text(doc.data.lifetreeId);
    if (tree) { if (trees.has(tree)) pulses.add(idOf(doc.path)); continue; }
    // Chain-less blocks (events, offerings, decisions): by the community's id or place, or by a member's hand.
    if (doc.data.communityId === communityId || placedHere(doc.data) || ofMember(doc.data, 'authorId')) pulses.add(idOf(doc.path));
  }
  for (const doc of top('pulses')) {
    if (!pulses.has(idOf(doc.path)) && doc.data.communityId === communityId) left.push({ path: doc.path, reason: 'block_of_a_tree_outside_the_circle' });
  }
  const alignments = new Set(top('alignments').filter(doc => trees.has(text(doc.data.initiatorTreeId) ?? '') && trees.has(text(doc.data.targetTreeId) ?? '')).map(doc => idOf(doc.path)));
  for (const doc of top('alignments')) {
    if (alignments.has(idOf(doc.path))) continue;
    if (trees.has(text(doc.data.initiatorTreeId) ?? '') || trees.has(text(doc.data.targetTreeId) ?? '')) left.push({ path: doc.path, reason: 'alignment_with_a_tree_outside_the_circle' });
  }
  const covenants = new Set(top('covenants').filter(doc => alignments.has(text(doc.data.alignmentId) ?? '')).map(doc => idOf(doc.path)));
  const beings = new Map<string, Set<string>>([
    ['communities', new Set([communityId])], ['lifetrees', trees], ['visions', visions], ['lightHouses', houses], ['pulses', pulses], ['alignments', alignments], ['covenants', covenants],
  ]);
  const isBeing = (id: string): boolean => [...beings.values()].some(set => set.has(id));

  // What belongs by field.
  const selected = new Set<string>();
  const take = (doc: BundleDoc) => selected.add(doc.path);
  for (const [collection, ids] of beings) for (const id of ids) if (byPath.has(`${collection}/${id}`)) selected.add(`${collection}/${id}`);
  for (const doc of top('rays')) if (trees.has(text(doc.data.treeId) ?? '')) take(doc);
  if (byPath.has(`glow/${communityId}`)) selected.add(`glow/${communityId}`);
  for (const doc of top('gifts')) if (pulses.has(text(doc.data.offeringId) ?? idOf(doc.path).split('__')[0])) take(doc);
  for (const doc of top('spends')) if (ofMember(doc.data, 'spentBy')) take(doc);
  for (const doc of top('stays')) {
    if (houses.has(text(doc.data.lightHouseId) ?? '')) take(doc);
    else if (trees.has(text(doc.data.guestTreeId) ?? '')) left.push({ path: doc.path, reason: 'stay_at_a_house_outside_the_circle' });
  }
  for (const collection of ['communityInvites', 'communityKeeperInvites', 'communityTreeInvites']) for (const doc of top(collection)) if (doc.data.communityId === communityId) take(doc);
  for (const doc of top('treeKeepingInvites')) if (trees.has(text(doc.data.lifetreeId) ?? '')) take(doc);
  for (const doc of top('networkInvites')) if (doc.data.nodeCommunityId === communityId) take(doc);
  for (const doc of top('subscriptions')) if (placedHere(doc.data)) take(doc);
  for (const doc of top('intelligences')) if (ofMember(doc.data, 'anchorUid') || ofMember(doc.data, 'authorId')) take(doc);

  // Edges: both ends travel — a being of the world, or a person (member or named).
  const isPerson = (id: string): boolean => byPath.has(`users/${id}`) || byPath.has(`persons/${id}`);
  const endTravels = (id: string): boolean => id === communityId || isBeing(id) || isPerson(id);
  for (const edge of edges) {
    const from = text(edge.data.from), to = text(edge.data.to);
    if (!from || !to) continue;
    const touches = from === communityId || to === communityId || isBeing(from) || isBeing(to) || members.has(from) || members.has(to);
    if (!touches) continue;
    if (endTravels(from) && endTravels(to)) take(edge);
    else left.push({ path: edge.path, reason: 'edge_to_a_being_outside_the_circle' });
  }

  // People: the circle whole, everyone named by their public record alone.
  for (const uid of members) for (const collection of ['users', 'persons']) if (byPath.has(`${collection}/${uid}`)) selected.add(`${collection}/${uid}`);
  const chosen = () => docs.filter(doc => selected.has(doc.path));
  const named = new Set<string>();
  for (let settled = false; !settled;) {
    settled = true;
    for (const uid of localUidCensus(chosen())) {
      if (members.has(uid) || named.has(uid)) continue;
      named.add(uid);
      if (byPath.has(`persons/${uid}`)) { selected.add(`persons/${uid}`); settled = false; }
    }
  }
  // What hangs under a travelling record travels with it (loves, occupancy, signatures, witnesses, keys).
  for (const doc of docs) {
    const segments = doc.path.split('/');
    if (segments.length < 4) continue;
    const parent = segments.slice(0, 2).join('/');
    const personal = rootOf(parent) === 'persons' && members.has(idOf(parent));
    if (personal || (rootOf(parent) !== 'persons' && selected.has(parent) && bundleSignature(doc.path) !== 'users/*/pushSubscriptions')) selected.add(doc.path);
  }
  const world = docs.filter(doc => selected.has(doc.path)).sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  left.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { docs: world, members: [...members].sort(), named: [...named].sort(), left };
}
