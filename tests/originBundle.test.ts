// THE ORIGIN LEAVES (ring 2026-11-03): the first node's Firestore soil becomes the same sealed bundle an
// independent node exports — one plan, one map, one landing law — and what cannot travel is named.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { portableValue, originSnapshot, originIdentities, pruneBrokenChains, ORIGIN_GROUPS, type OriginReader, type OriginRecord } from '../src/domain/originBundle';
import { crossingCharterProblem } from '../src/domain/crossingCharter';
import { verifyBundle, type NodeBundle } from '../src/domain/bundle';
import { bundleInsertOf } from '../src/domain/seedBundle.mjs';
import { buildBundle } from '../seed/api/bundle.mjs';

const LID = (n: number) => `019a0000-0000-7000-8000-${String(n).padStart(12, '0')}`;
// A Timestamp as the Admin SDK hands it: seconds and nanoseconds live, toMillis beside them.
const stamp = (iso: string, micro = 0) => ({ seconds: Math.floor(Date.parse(iso) / 1000), nanoseconds: micro * 1000, toMillis() { return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6); } });

// A reader over a soil written as { path: data }: roots, root documents, collection groups, and the
// survey of subcollection names under a document.
const readerOf = (soil: Record<string, Record<string, unknown>>, survey: Record<string, string[]> = {}): OriginReader => {
  const records = (): OriginRecord[] => Object.entries(soil).map(([path, data]) => ({ path, data }));
  return {
    roots: async () => [...new Set(Object.keys(soil).map(path => path.split('/')[0]))],
    docs: async name => records().filter(r => r.path.split('/').length === 2 && r.path.startsWith(`${name}/`)),
    group: async name => records().filter(r => { const s = r.path.split('/'); return s.length >= 4 && s[s.length - 2] === name; }),
    subcollections: async path => survey[path] ?? [],
  };
};

const soil = {
  'users/u1': { lid: LID(1), displayName: 'Alice', createdAt: stamp('2026-01-01T00:00:00Z', 123456) },
  'persons/u1': { uid: 'u1', lid: LID(1), displayName: 'Alice' },
  'users/u2': { lid: LID(2), displayName: 'Bob' },
  'persons/u2': { uid: 'u2', lid: LID(2) },
  'lifetrees/t1': { lid: LID(11), anchorUid: 'u1', name: 'Nur', treeType: 'LIGHTTREE', visibility: 'public', genesisHash: 'g1', latestHash: 'h1', blockHeight: 1, createdAt: stamp('2026-01-02T00:00:00Z'), place: { latitude: 50.8, longitude: 4.3 }, tags: ['a', 'b'] },
  'lifetrees/t1/loves/u2': { uid: 'u2', at: stamp('2026-03-01T00:00:00Z') },
  'lifetrees/t1/occupancy/s1': { stayId: 's1', from: '2026-05-01', to: '2026-05-03' },
  'pulses/p1': { lid: LID(21), authorId: 'u1', lifetreeId: 't1', type: 'tree_growth', visibility: 'public', hash: 'h1', previousHash: 'g1', createdAt: stamp('2026-02-01T00:00:00Z') },
  'links/u1__keeper__t1': { lid: LID(61), type: 'link', rel: 'keeper', from: 'u1', to: 't1', createdAt: stamp('2026-01-02T00:00:00Z', 7) },
  'config/superadmin': { uid: 'u1' },
  'config/dataAuthority': { nodeLid: LID(900), custodian: 'x' },
  [`beings/${LID(1)}`]: { kind: 'person', ref: 'u1' },
  'mail/m1': { to: 'someone', body: 'a letter' },
  'organisations/lightseed.online': { name: 'Lightseed', ownerId: 'u1' },
};

describe('the origin leaves', () => {
  it('turns Firestore values into the shape the far side stores, and refuses what only means something here', () => {
    expect(portableValue(stamp('2026-01-01T00:00:00Z', 123456))).toEqual({ ok: true, value: '2026-01-01T00:00:00.123456Z' });
    expect(portableValue({ seconds: 1767225600, nanoseconds: 0 })).toEqual({ ok: true, value: '2026-01-01T00:00:00.000000Z' });
    expect(portableValue({ toMillis: () => 1767225600500 })).toEqual({ ok: true, value: '2026-01-01T00:00:00.500Z' });
    expect(portableValue(new Date('2026-01-01T00:00:00.250Z'))).toEqual({ ok: true, value: '2026-01-01T00:00:00.250Z' });
    expect(portableValue({ a: [1, 'two', null, { at: stamp('2026-01-01T00:00:00Z') }], b: true, c: undefined })).toEqual({ ok: true, value: { a: [1, 'two', null, { at: '2026-01-01T00:00:00.000000Z' }], b: true, c: null } });
    expect(portableValue({ seconds: 1, nanoseconds: 2, note: 'a map that merely looks like a stamp' })).toEqual({ ok: true, value: { seconds: 1, nanoseconds: 2, note: 'a map that merely looks like a stamp' } });
    expect(portableValue({ n: Number.NaN })).toEqual({ ok: false, issue: 'number_not_finite', at: 'n' });
    expect(portableValue({ deep: [{ n: Number.POSITIVE_INFINITY }] })).toEqual({ ok: false, issue: 'number_not_finite', at: 'deep[0].n' });
    expect(portableValue({ ref: { path: 'users/u1', id: 'u1', firestore: {} } })).toEqual({ ok: false, issue: 'reference_not_portable', at: 'ref' });
    expect(portableValue({ raw: new Uint8Array([1, 2]) })).toEqual({ ok: false, issue: 'bytes_not_portable', at: 'raw' });
    expect(portableValue({ point: new (class GeoPoint { latitude = 1; longitude = 2; })() })).toEqual({ ok: false, issue: 'value_not_portable', at: 'point' });
    expect(portableValue({ when: { seconds: 1, nanoseconds: 2e9 } })).toEqual({ ok: false, issue: 'stamp_unsound', at: 'when' });
    expect(portableValue({ when: new Date('nope') })).toEqual({ ok: false, issue: 'stamp_unsound', at: 'when' });
  });

  it('gathers every mapped collection and group at the plan\'s word, leaves the excluded with their reasons, and rebuilds the witness', async () => {
    const snapshot = await originSnapshot(readerOf(soil, { 'users/u1': ['pushSubscriptions'] }), { survey: true });
    expect(snapshot.unknown).toEqual(['organisations'].filter(() => false));
    expect(snapshot.docs.map(d => d.path)).toEqual(['config/superadmin', 'lifetrees/t1', 'lifetrees/t1/loves/u2', 'lifetrees/t1/occupancy/s1', 'links/u1__keeper__t1', 'persons/u1', 'persons/u2', 'pulses/p1', 'users/u1', 'users/u2']);
    expect(snapshot.docs.find(d => d.path === 'users/u1')?.data).toEqual({ lid: LID(1), displayName: 'Alice', createdAt: '2026-01-01T00:00:00.123456Z' });
    expect(snapshot.docs.find(d => d.path === 'links/u1__keeper__t1')?.data).toEqual({ lid: LID(61), type: 'link', rel: 'keeper', from: 'u1', to: 't1', createdAt: '2026-01-02T00:00:00.000007Z' });
    expect(snapshot.docs.find(d => d.path === 'lifetrees/t1')?.data).toMatchObject({ place: { latitude: 50.8, longitude: 4.3 }, tags: ['a', 'b'], createdAt: '2026-01-02T00:00:00.000000Z' });
    expect(snapshot.rebuilt).toEqual(['beings']);
    expect(snapshot.left.map(l => l.path)).toEqual(['mail', 'organisations', 'users/*/pushSubscriptions', 'config/dataAuthority']);
    expect(snapshot.left.every(l => l.reason.length > 20)).toBe(true);
    expect(snapshot.unlandable).toEqual([]);
    for (const doc of snapshot.docs) expect(bundleInsertOf(doc), doc.path).not.toBeNull();
    expect([...ORIGIN_GROUPS].sort()).toEqual(['keyEvents', 'keyRecoveries', 'keys', 'loves', 'occupancy', 'signatures', 'witnesses']);
  });

  it('stops at a collection the plan has never named, unless the hand leaves it knowingly', async () => {
    const strange = { ...soil, 'fossils/f1': { bones: 1 }, 'communities/c1': { lid: LID(31), anchorUid: 'u1', name: 'Circle' }, 'communities/c1/signatures/u1': { sig: 's' } };
    const refused = await originSnapshot(readerOf(strange, { 'users/u1': ['secrets'] }), { survey: true });
    expect(refused.unknown).toEqual(['communities/*/signatures', 'fossils', 'users/*/secrets']);
    const allowed = await originSnapshot(readerOf(strange, { 'users/u1': ['secrets'] }), { survey: true, leave: ['fossils', 'communities/*/signatures', 'users/*/secrets'] });
    expect(allowed.unknown).toEqual([]);
    expect(allowed.left.filter(l => l.reason === 'left behind by the exporting hand').map(l => l.path)).toEqual(['fossils', 'communities/*/signatures', 'users/*/secrets']);
    expect(allowed.docs.map(d => d.path)).toContain('communities/c1');
    // Without the survey, a subcollection the groups never ask for stays unseen — the survey is the honest walk.
    expect((await originSnapshot(readerOf(strange, { 'users/u1': ['secrets'] }))).unknown).toEqual(['communities/*/signatures', 'fossils']);
  });

  it('names every record that could never land instead of carrying it', async () => {
    const broken = {
      ...soil,
      'links/u2__keeper__t1': { type: 'link', rel: 'keeper', from: 'u2', to: 't1', createdAt: stamp('2026-01-02T00:00:00Z') }, // no lid
      'visions/v1': { lid: LID(41), authorId: 'u1', weight: Number.NaN },
      'pulses/p2': { lid: LID(22), authorId: 'u1', at: { path: 'pulses/p1', id: 'p1', firestore: {} } },
      // Firestore keeps a subcollection under a deleted parent: a love on a block nobody carries, and a love on the refused p2.
      'pulses/deleted/loves/u1': { uid: 'u1', at: stamp('2026-04-01T00:00:00Z') },
      'pulses/p2/loves/u1': { uid: 'u1', at: stamp('2026-04-01T00:00:00Z') },
    };
    const snapshot = await originSnapshot(readerOf(broken));
    expect(snapshot.unlandable).toEqual([
      { path: 'links/u2__keeper__t1', reason: 'cannot_land' },
      { path: 'pulses/p2', reason: 'reference_not_portable at at' },
      { path: 'visions/v1', reason: 'number_not_finite at weight' },
      { path: 'pulses/deleted/loves/u1', reason: 'parent_not_carried' },
      { path: 'pulses/p2/loves/u1', reason: 'parent_not_carried' },
    ]);
    expect(snapshot.docs.map(d => d.path)).not.toContain('visions/v1');
    expect(snapshot.docs.map(d => d.path)).toContain('lifetrees/t1/loves/u2');
  });

  it('leaves the debris of deleted beings behind by the closure law itself, to a fixpoint, and names every block', async () => {
    const debris = {
      ...soil,
      'pulses/p2': { lid: LID(22), authorId: 'u1', lifetreeId: 't1', type: 'tree_growth', visibility: 'public', hash: 'h2', previousHash: 'h1', createdAt: stamp('2026-02-02T00:00:00Z') },
      // The tree 'gone' was deleted at the origin; its two blocks still stand, the first pointing at a genesis nobody carries.
      'pulses/g1': { lid: LID(23), authorId: 'u1', lifetreeId: 'gone', type: 'tree_growth', visibility: 'public', hash: 'x1', previousHash: 'genesis-of-gone', createdAt: stamp('2026-02-03T00:00:00Z') },
      'pulses/g2': { lid: LID(24), authorId: 'u1', lifetreeId: 'gone', type: 'tree_growth', visibility: 'public', hash: 'x2', previousHash: 'x1', createdAt: stamp('2026-02-04T00:00:00Z') },
      // A block whose predecessor was unminted away: the hole severs it alone.
      'pulses/h1': { lid: LID(25), authorId: 'u1', lifetreeId: 't1', type: 'tree_growth', visibility: 'public', hash: 'h9', previousHash: 'h-unminted', createdAt: stamp('2026-02-05T00:00:00Z') },
      'pulses/g2/loves/u2': { uid: 'u2', at: stamp('2026-02-06T00:00:00Z') },
    };
    const snapshot = await originSnapshot(readerOf(debris));
    const pruned = pruneBrokenChains(snapshot.docs);
    expect(pruned.broken.map(b => b.path)).toEqual(['pulses/g1', 'pulses/h1', 'pulses/g2', 'pulses/g2/loves/u2']);
    expect(pruned.broken.at(-1)?.reason).toBe('parent_left_behind');
    expect(pruned.broken[0].reason).toContain('genesis-of-g');
    expect(pruned.docs.map(d => d.path).filter(p => p.startsWith('pulses/'))).toEqual(['pulses/p1', 'pulses/p2']);
    expect(pruneBrokenChains(pruned.docs).broken).toEqual([]);
    const origin = JSON.parse(readFileSync(resolve('src/config/charter.json'), 'utf8'));
    const bundle = await buildBundle({ snapshot: pruned.docs, charter: origin, exportCommit: 'a'.repeat(40), charterHashes: { genesisMd: '0'.repeat(64), linMd: '1'.repeat(64) }, withoutAuthority: true });
    expect((await verifyBundle(bundle as unknown as NodeBundle)).ok).toBe(true);
    const unpruned = await buildBundle({ snapshot: snapshot.docs, charter: origin, exportCommit: 'a'.repeat(40), charterHashes: { genesisMd: '0'.repeat(64), linMd: '1'.repeat(64) }, withoutAuthority: true });
    expect((await verifyBundle(unpruned as unknown as NodeBundle)).issues.map(i => i.code)).toEqual(['chain_break', 'chain_break']);
  });

  it('does not mistake the node\'s own credential holder for a person', async () => {
    const node = { ...soil, 'communities/lightseed.online': { lid: LID(31), anchorUid: 'u1', name: 'Lightseed', domain: 'lightseed.online' }, 'intelligences/i1': { lid: LID(51), anchorUid: 'u1', credentialHolderUid: 'lightseed.online', name: 'Aspen' } };
    const { ghosts } = originIdentities((await originSnapshot(readerOf(node))).docs);
    expect(ghosts).toEqual([]);
  });

  it('counts the identities the far side must bind, and the ghosts it cannot', async () => {
    const haunted = { ...soil, 'pulses/p3': { lid: LID(23), authorId: 'departed', lifetreeId: 't1', recipientUid: 'gone' }, 'users/u3': { lid: LID(3) }, 'persons/u3': { uid: 'u3', lid: LID(4) }, 'users/u4': { displayName: 'No lid' }, 'persons/u4': { uid: 'u4' }, 'pulses/p4': { lid: LID(24), authorId: 'u3', seenBy: ['u4'] } };
    const { identities, ghosts } = originIdentities((await originSnapshot(readerOf(haunted))).docs);
    expect(identities).toEqual([{ sourceUid: 'u1', targetUid: 'u1', personLid: LID(1) }, { sourceUid: 'u2', targetUid: 'u2', personLid: LID(2) }]);
    expect(ghosts).toEqual([{ uid: 'gone', reason: 'person_missing' }, { uid: 'u3', reason: 'lid_disagrees' }, { uid: 'u4', reason: 'lid_missing' }]);
  });

  it('lets the origin\'s own version-1 charter sign a head, as a sound version-2 charter does', async () => {
    const origin = JSON.parse(readFileSync(resolve('src/config/charter.json'), 'utf8'));
    expect(crossingCharterProblem(origin)).toBeNull();
    expect(crossingCharterProblem({ ...origin, nodeLid: 'nope' })).toBe('charter_node_lid');
    expect(crossingCharterProblem({ ...origin, name: 7 })).toBe('shape');
    const independent = { ...JSON.parse(readFileSync(resolve('seed/node.example.json'), 'utf8')), nodeLid: LID(900) };
    expect(crossingCharterProblem(independent)).toBeNull();
    expect(crossingCharterProblem({ ...independent, version: 3 })).toBe('version');
    for (const value of [null, [], 'charter', 7]) expect(crossingCharterProblem(value)).toBe('shape');
    const snapshot = await originSnapshot(readerOf(soil));
    const bundle = await buildBundle({ snapshot: snapshot.docs, charter: origin, exportCommit: 'a'.repeat(40), charterHashes: { genesisMd: '0'.repeat(64), linMd: '1'.repeat(64) }, withoutAuthority: true });
    expect(bundle.head).toMatchObject({ nodeLid: origin.nodeLid, domain: 'lightseed.online' });
    expect((await verifyBundle(bundle as unknown as NodeBundle)).ok).toBe(true);
    expect(bundle.docs.map(d => d.path)).toEqual(expect.arrayContaining(['beings/' + LID(1), 'beings/' + LID(11), 'beings/' + LID(21)]));
    expect(bundle.docs.map(d => d.path)).not.toContain('config/superadmin');
  });
});
