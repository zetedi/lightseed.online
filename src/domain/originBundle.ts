// THE ORIGIN LEAVES (ring 2026-11-03): how the first node's Firestore soil becomes the same sealed
// bundle an independent node exports — one travel plan (domain/bundle TRAVEL_PLAN), one crossing map
// (domain/seedBundle SEED_BUNDLE_TABLES), one landing law (bundleInsertOf). Pure: the reader is
// handed in and asked collection by collection at one moment; this law decides what travels, in
// which shape, and names out loud what it leaves behind. A collection the plan has never named
// stops the export until the hand leaves it knowingly, and a record that could never land on the
// far side is named rather than carried — silence would be loss.
import { TRAVEL_PLAN, travelRuleFor, localUidCensus, chainClosureIssues, type BundleDoc } from './bundle';
import { isLid } from './dataAuthority';
import { SEED_BUNDLE_TABLES, bundleSignature, bundleInsertOf, portableSegment } from './seedBundle.mjs';

export interface OriginRecord { path: string; data: Record<string, unknown> }
export interface OriginReader {
  roots(): Promise<string[]>;                       // the root collections that exist in the soil
  docs(collection: string): Promise<OriginRecord[]>; // one root collection, every document
  group(name: string): Promise<OriginRecord[]>;      // every subcollection of this name, wherever it hangs
  subcollections?(path: string): Promise<string[]>;  // the survey: the subcollection names under one document
}
export interface OriginLeft { path: string; reason: string }
export interface OriginSnapshot {
  docs: BundleDoc[];        // what travels, sorted by path, in the shape the far side lands
  left: OriginLeft[];       // what stays, each with the plan's reason or the hand's
  rebuilt: string[];        // witnesses the far side computes from the body (beings)
  unknown: string[];        // collections the plan has never named — the export must not proceed
  unlandable: OriginLeft[]; // records that could never land on the far side, each with why
}

export type OriginValueIssue = 'number_not_finite' | 'reference_not_portable' | 'bytes_not_portable' | 'value_not_portable' | 'stamp_unsound';
export type PortableValue = { ok: true; value: unknown } | { ok: false; issue: OriginValueIssue; at: string };

class Unportable extends Error {
  constructor(readonly issue: OriginValueIssue, readonly at: string) { super(issue); }
}

// A Firestore moment in the node's own written form: UTC, six fractional digits (the soil keeps
// microseconds; Firestore carries no finer), exactly as seed.stamp writes one.
const isoOf = (seconds: number, nanoseconds: number, at: string): string => {
  if (!Number.isSafeInteger(seconds) || !Number.isInteger(nanoseconds) || nanoseconds < 0 || nanoseconds >= 1e9) throw new Unportable('stamp_unsound', at);
  const whole = new Date(seconds * 1000);
  if (Number.isNaN(whole.getTime())) throw new Unportable('stamp_unsound', at);
  return whole.toISOString().replace(/\.000Z$/, `.${String(Math.floor(nanoseconds / 1000)).padStart(6, '0')}Z`);
};

const walk = (value: unknown, at: string): unknown => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Unportable('number_not_finite', at);
    return value;
  }
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value !== 'object') throw new Unportable('value_not_portable', at);
  if (Array.isArray(value)) return value.map((item, index) => walk(item, `${at}[${index}]`));
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw new Unportable('stamp_unsound', at);
    return value.toISOString();
  }
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) throw new Unportable('bytes_not_portable', at);
  const v = value as Record<string, unknown>;
  // A Timestamp in flight ({ seconds, nanoseconds } with toMillis live, or raw with nothing else).
  if (typeof v.seconds === 'number' && typeof v.nanoseconds === 'number' && (typeof v.toMillis === 'function' || Object.keys(v).length === 2)) {
    return isoOf(v.seconds, v.nanoseconds, at);
  }
  if (typeof v.toMillis === 'function') {
    const ms = (v.toMillis as () => unknown)();
    if (typeof ms !== 'number' || !Number.isFinite(ms)) throw new Unportable('stamp_unsound', at);
    return new Date(ms).toISOString();
  }
  // A document reference points into THIS soil; on the far side it would point at nothing.
  if (typeof v.path === 'string' && typeof v.id === 'string' && v.firestore !== undefined) throw new Unportable('reference_not_portable', at);
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) throw new Unportable('value_not_portable', at);
  return Object.fromEntries(Object.entries(v).map(([key, item]) => [key, walk(item, at ? `${at}.${key}` : key)]));
};

// A Firestore value in the shape the far side stores: moments as ISO strings, maps and arrays as
// they are, nothing that only means something inside this soil.
export const portableValue = (value: unknown): PortableValue => {
  try { return { ok: true, value: walk(value, '') }; }
  catch (error) {
    if (error instanceof Unportable) return { ok: false, issue: error.issue, at: error.at };
    throw error;
  }
};

// The subcollection names the crossing map knows, asked for as collection groups.
export const ORIGIN_GROUPS: readonly string[] = [...new Set(Object.keys(SEED_BUNDLE_TABLES)
  .filter(signature => signature.includes('/')).map(signature => signature.split('/*/').pop() as string))];

const mapped = (signature: string): boolean => Object.prototype.hasOwnProperty.call(SEED_BUNDLE_TABLES, signature);
const SURVEY_BREADTH = 16;
const segmentsOf = (path: string): string[] => path.split('/');

export async function originSnapshot(reader: OriginReader, options: { survey?: boolean; leave?: readonly string[] } = {}): Promise<OriginSnapshot> {
  const leave = new Set(options.leave ?? []);
  const left: OriginLeft[] = [];
  const rebuilt: string[] = [];
  const unknown: string[] = [];
  const unlandable: OriginLeft[] = [];
  const candidates: OriginRecord[] = [];
  const leftOnce = new Set<string>();
  const unknownOnce = new Set<string>();
  const leaveBehind = (path: string, reason: string) => {
    if (leftOnce.has(path)) return;
    leftOnce.add(path);
    left.push({ path, reason });
  };
  const stranger = (signature: string) => {
    if (leave.has(signature)) { leaveBehind(signature, 'left behind by the exporting hand'); return; }
    if (unknownOnce.has(signature)) return;
    unknownOnce.add(signature);
    unknown.push(signature);
  };
  for (const name of [...await reader.roots()].sort()) {
    const rule = TRAVEL_PLAN.find(r => r.path === name);
    if (!rule) { stranger(name); continue; }
    if (rule.mode === 'excluded') { leaveBehind(name, rule.reason ?? 'excluded by the travel plan'); continue; }
    if (!mapped(name)) { rebuilt.push(name); continue; }
    candidates.push(...await reader.docs(name));
  }
  for (const group of ORIGIN_GROUPS) {
    for (const record of await reader.group(group)) {
      const signature = bundleSignature(record.path);
      if (mapped(signature)) { candidates.push(record); continue; }
      const rule = travelRuleFor(record.path);
      if (rule?.mode === 'excluded') leaveBehind(signature, rule.reason ?? 'excluded by the travel plan');
      else stranger(signature);
    }
  }
  if (options.survey && reader.subcollections) {
    // The survey asks every gathered document for its subcollections — a few at a time, in path order.
    const ask = reader.subcollections.bind(reader);
    for (let start = 0; start < candidates.length; start += SURVEY_BREADTH) {
      const batch = candidates.slice(start, start + SURVEY_BREADTH);
      const names = await Promise.all(batch.map(record => ask(record.path)));
      batch.forEach((record, index) => {
        for (const name of names[index]) {
          const signature = `${bundleSignature(record.path)}/*/${name}`;
          if (mapped(signature)) continue;
          const rule = travelRuleFor(`${record.path}/${name}/x`);
          if (rule?.mode === 'excluded') leaveBehind(signature, rule.reason ?? 'excluded by the travel plan');
          else stranger(signature);
        }
      });
    }
  }
  const docs: BundleDoc[] = [];
  for (const record of candidates) {
    const rule = travelRuleFor(record.path);
    if (!rule) { stranger(bundleSignature(record.path)); continue; }
    if (rule.mode === 'excluded') { leaveBehind(record.path, rule.reason ?? 'excluded by the travel plan'); continue; }
    const segments = segmentsOf(record.path);
    if (segments.length % 2 !== 0 || !segments.every(portableSegment)) { unlandable.push({ path: record.path, reason: 'id_not_portable' }); continue; }
    if (!record.data || typeof record.data !== 'object' || Array.isArray(record.data)) { unlandable.push({ path: record.path, reason: 'value_not_portable at .' }); continue; }
    const portable = portableValue(record.data);
    if (!portable.ok) { unlandable.push({ path: record.path, reason: `${portable.issue} at ${portable.at || '.'}` }); continue; }
    const doc: BundleDoc = { path: record.path, data: portable.value as Record<string, unknown> };
    if (rule.mode !== 'witness' && !bundleInsertOf(doc)) { unlandable.push({ path: record.path, reason: 'cannot_land' }); continue; }
    docs.push(doc);
  }
  // Firestore keeps a subcollection alive under a deleted parent; the soil's tables keep no such
  // thing. A love or a signature whose parent is not carried is debris, named like the rest.
  const carried = new Set(docs.map(doc => doc.path));
  for (let settled = false; !settled;) {
    settled = true;
    for (const doc of [...docs]) {
      const segments = segmentsOf(doc.path);
      if (segments.length < 4 || carried.has(segments.slice(0, -2).join('/'))) continue;
      carried.delete(doc.path);
      docs.splice(docs.indexOf(doc), 1);
      unlandable.push({ path: doc.path, reason: 'parent_not_carried' });
      settled = false;
    }
  }
  docs.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  unknown.sort();
  return { docs, left, rebuilt, unknown, unlandable };
}

// THE DEBRIS OF DELETED BEINGS: a block whose predecessor is not carried (its being deleted at the
// origin, its chain left standing) fails the far side's closure law (domain/bundle
// chainClosureIssues) and would block the whole crossing. This prunes by that very law, to a
// fixpoint — a block that descended from a pruned one loses its predecessor and goes with it — and
// names every block it left, so the hand decides knowingly and the origin keeps what it keeps.
export const pruneBrokenChains = (docs: BundleDoc[]): { docs: BundleDoc[]; broken: OriginLeft[] } => {
  let kept = docs;
  const broken: OriginLeft[] = [];
  for (;;) {
    const issues = chainClosureIssues(kept);
    if (issues.length === 0) break;
    const paths = new Set(issues.map(issue => issue.path));
    for (const issue of issues) broken.push({ path: issue.path ?? '', reason: issue.detail ?? issue.code });
    // What hung under a pruned block (its loves, its signatures, its witnesses) goes with it.
    const under = (path: string) => [...paths].some(parent => path.startsWith(`${parent}/`));
    for (const doc of kept) if (under(doc.path)) broken.push({ path: doc.path, reason: 'parent_left_behind' });
    kept = kept.filter(doc => !paths.has(doc.path) && !under(doc.path));
  }
  return { docs: kept, broken };
};

// THE CENSUS OF IDENTITIES: every uid the bundle names, with the person LID it must be anchored to on
// the far side (domain/bundleMerge asks that users/{uid} and persons/{uid} agree on it). The uids are
// kept — signed history cannot be renamed — so each entry binds a uid to itself; what the receiving
// installation adds is the login it vouches for. A uid without a person, or whose records disagree,
// is a ghost: it cannot be bound and will block the crossing until the hand decides.
export interface OriginIdentity { sourceUid: string; targetUid: string; personLid: string }
export type OriginGhostReason = 'person_missing' | 'lid_missing' | 'lid_disagrees';
export interface OriginGhost { uid: string; reason: OriginGhostReason }

export const originIdentities = (docs: BundleDoc[]): { identities: OriginIdentity[]; ghosts: OriginGhost[] } => {
  const byPath = new Map(docs.map(doc => [doc.path, doc.data]));
  const identities: OriginIdentity[] = [];
  const ghosts: OriginGhost[] = [];
  for (const uid of localUidCensus(docs)) {
    const records = [byPath.get(`persons/${uid}`), byPath.get(`users/${uid}`)].filter((record): record is Record<string, unknown> => record !== undefined);
    if (records.length === 0) { ghosts.push({ uid, reason: 'person_missing' }); continue; }
    const lids = records.map(record => record.lid);
    if (lids.some(lid => typeof lid !== 'string' || !isLid(lid))) { ghosts.push({ uid, reason: 'lid_missing' }); continue; }
    if (new Set(lids).size !== 1) { ghosts.push({ uid, reason: 'lid_disagrees' }); continue; }
    identities.push({ sourceUid: uid, targetUid: uid, personLid: lids[0] as string });
  }
  return { identities, ghosts };
};
