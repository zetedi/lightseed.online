import { describe, expect, it } from 'vitest';
import {
  buildCensus, manifestHashOf, type BundleDoc, type CharterHead, type NodeBundle,
} from '../src/domain/bundle';
import { mergeSnapshotDigest, planBundleMerge } from '../src/domain/bundleMerge';

const lid = '019f6381-48fd-7fcc-9382-e99d923f38aa';
const otherLid = '019f6381-48fd-7fcc-9382-e99d923f38ab';
const anchor = { fingerprint: 'pinned-key', publicKeyB64: 'resolved-outside-bundle' };
const acceptSeal = async () => true; // Signature cryptography is covered by bundle/signing tests.
const record = (path: string, data: Record<string, unknown> = {}): BundleDoc => ({ path, data });
const bundle = async (docs: BundleDoc[]): Promise<NodeBundle> => {
  const head: CharterHead = {
    formatVersion: 1, nodeLid: lid, domain: 'source.example', exportedAtMs: 1,
    exportCommit: 'test', charterHashes: { genesisMd: 'genesis', linMd: 'lin' },
    genesisTree: null, census: await buildCensus(docs),
  };
  return {
    head, manifestHash: await manifestHashOf(head), docs,
    seal: { fingerprint: anchor.fingerprint, signature: 'signature' },
  };
};

describe('additive bundle merging', () => {
  it('adds disjoint records and leaves both input snapshots untouched', async () => {
    const incoming = await bundle([record('lifetrees/a', { lid, name: 'Oak' })]);
    const current = [record('lifetrees/b', { lid: otherLid, name: 'Willow' })];
    const before = structuredClone({ incoming, current });
    const plan = await planBundleMerge(incoming, current, anchor, acceptSeal);
    expect(plan.ready).toBe(true);
    expect(plan.inserts).toEqual(incoming.docs);
    expect(plan.destinationDigest).toBe(await mergeSnapshotDigest(current));
    plan.inserts[0].data.name = 'Changed proposal';
    expect({ incoming, current }).toEqual(before);
  });

  it('reimporting identical content is idempotent regardless of object key order', async () => {
    const incoming = await bundle([record('lifetrees/a', { lid, name: 'Oak' })]);
    const current = [record('lifetrees/a', { name: 'Oak', lid })];
    const plan = await planBundleMerge(incoming, current, anchor, acceptSeal);
    expect(plan.ready).toBe(true);
    expect(plan.inserts).toEqual([]);
    expect(plan.unchanged).toEqual(['lifetrees/a']);
  });

  it('never applies last-write-wins, including to an advanced chain head', async () => {
    const incoming = await bundle([record('lifetrees/a', { lid, latestHash: 'new', blockHeight: 2 })]);
    const current = [record('lifetrees/a', { lid, latestHash: 'old', blockHeight: 1 })];
    const plan = await planBundleMerge(incoming, current, anchor, acceptSeal);
    expect(plan.ready).toBe(false);
    expect(plan.inserts).toEqual([]);
    expect(plan.issues).toContainEqual(expect.objectContaining({ code: 'content_conflict', path: 'lifetrees/a' }));
    expect(current[0].data.latestHash).toBe('old');
  });

  it('detects one portable name at two addresses, including within the source', async () => {
    const incoming = await bundle([record('lifetrees/a', { lid })]);
    const plan = await planBundleMerge(incoming, [record('lifetrees/b', { lid })], anchor, acceptSeal);
    expect(plan.ready).toBe(false);
    expect(plan.issues.some(i => i.code === 'lid_conflict')).toBe(true);
    const doubled = await planBundleMerge(await bundle([
      record('lifetrees/a', { lid }), record('communities/b', { lid }),
    ]), [], anchor, acceptSeal);
    expect(doubled.ready).toBe(false);
    expect(doubled.issues.some(i => i.code === 'lid_conflict')).toBe(true);
  });

  it('rejects tampering and missing or unanchored signatures before proposing writes', async () => {
    const incoming = await bundle([record('lifetrees/a', { lid })]);
    incoming.docs[0].data.name = 'tampered';
    const tampered = await planBundleMerge(incoming, [], anchor, acceptSeal);
    expect(tampered.inserts).toEqual([]);
    expect(tampered.issues.some(i => i.code === 'invalid_bundle')).toBe(true);
    const unsigned = await bundle([]);
    delete unsigned.seal;
    expect((await planBundleMerge(unsigned, [], anchor, acceptSeal)).issues).toEqual([
      { code: 'untrusted_bundle', detail: 'seal_missing' },
    ]);
    const untrusted = await bundle([]);
    untrusted.seal!.fingerprint = 'stranger';
    expect((await planBundleMerge(untrusted, [], anchor, acceptSeal)).ready).toBe(false);
    expect((await planBundleMerge(await bundle([]), [], anchor, async () => false)).ready).toBe(false);
  });

  it('will not import local authority or excluded records', async () => {
    const plan = await planBundleMerge(await bundle([
      record('admins/stranger'), record('config/superadmin', { uid: 'stranger' }),
    ]), [], anchor, acceptSeal);
    expect(plan.inserts).toEqual([]);
    expect(plan.issues.filter(i => i.code === 'local_authority')).toHaveLength(2);
    const excluded = await planBundleMerge(await bundle([
      record('config/dataAuthority', { nodeLid: lid }),
    ]), [], anchor, acceptSeal);
    expect(excluded.ready).toBe(false);
    expect(excluded.inserts).toEqual([]);
  });

  it('requires an existing identity binding, without trusting matching uid or email', async () => {
    const person = record('users/a', { lid, email: 'same@example.org' });
    const incoming = await bundle([person, record('persons/a', { lid })]);
    const unbound = await planBundleMerge(incoming, [person], anchor, acceptSeal);
    expect(unbound.issues.some(i => i.code === 'identity_unbound')).toBe(true);
    const binding = { sourceUid: 'a', targetUid: 'a', personLid: lid };
    const bound = await planBundleMerge(incoming, [person], anchor, acceptSeal, [binding]);
    expect(bound.ready).toBe(true); // users + persons legitimately share one LID.
    const collision = await planBundleMerge(incoming, [
      record('users/a', { lid: otherLid, email: 'same@example.org' }),
    ], anchor, acceptSeal, [binding]);
    expect(collision.issues.some(i => i.code === 'identity_conflict')).toBe(true);
    const absent = await planBundleMerge(incoming, [], anchor, acceptSeal, [binding]);
    expect(absent.ready).toBe(false);
  });

  it('refuses renaming identities and ambiguous bindings', async () => {
    const incoming = await bundle([record('users/a', { lid })]);
    const renamed = await planBundleMerge(incoming, [], anchor, acceptSeal, [
      { sourceUid: 'a', targetUid: 'b', personLid: lid },
    ]);
    expect(renamed.issues.some(i => i.code === 'identity_rewrite_required')).toBe(true);
    const ambiguous = await planBundleMerge(incoming, [], anchor, acceptSeal, [
      { sourceUid: 'a', targetUid: 'a', personLid: lid },
      { sourceUid: 'a', targetUid: 'a', personLid: lid },
    ]);
    expect(ambiguous.issues.some(i => i.code === 'identity_conflict')).toBe(true);
  });

  it('does not mistake a nested witness naming its signer for a duplicate being', async () => {
    const person = record('users/a', { lid });
    const plan = await planBundleMerge(await bundle([
      person, record('pulses/p/witnesses/a', { lid, uid: 'a' }),
    ]), [person], anchor, acceptSeal, [{ sourceUid: 'a', targetUid: 'a', personLid: lid }]);
    expect(plan.ready).toBe(true);
    expect(plan.inserts.map(d => d.path)).toEqual(['pulses/p/witnesses/a']);
  });

  it('rebuilds witnesses instead of importing an index as truth', async () => {
    const incoming = await bundle([
      record('lifetrees/a', { lid }), record(`beings/${lid}`, { lid, docId: 'wrong' }),
      record('initiates/a', { uid: 'a' }),
    ]);
    const plan = await planBundleMerge(incoming, [], anchor, acceptSeal);
    expect(plan.ready).toBe(true);
    expect(plan.inserts.map(d => d.path)).toEqual(['lifetrees/a']);
    expect(plan.rebuild).toEqual([`beings/${lid}`, 'initiates/a']);
  });

  it('binds a proposal to the destination including its local authority', async () => {
    const a = record('lifetrees/a', { lid });
    const b = record('config/dataAuthority', { nodeLid: otherLid });
    expect(await mergeSnapshotDigest([a, b])).toBe(await mergeSnapshotDigest([b, a]));
    expect(await mergeSnapshotDigest([a, b])).not.toBe(await mergeSnapshotDigest([a]));
    const duplicate = await planBundleMerge(await bundle([]), [a, a], anchor, acceptSeal);
    expect(duplicate.ready).toBe(false);
    expect(duplicate.issues[0].code).toBe('duplicate_destination');
  });

  it.each(['lifetrees', 'lifetrees/', '/lifetrees/a', 'lifetrees/../loves/a'])('rejects malformed path %s', async path => {
    const plan = await planBundleMerge(await bundle([]), [record(path)], anchor, acceptSeal);
    expect(plan.ready).toBe(false);
    expect(plan.issues[0].code).toBe('invalid_document');
  });

  it('rejects lossy JSON and safely handles prototype-shaped IDs', async () => {
    const invalid = await planBundleMerge(await bundle([]), [
      record('lifetrees/a', { missing: undefined }),
    ], anchor, acceptSeal);
    expect(invalid.ready).toBe(false);
    const valid = await planBundleMerge(await bundle([
      record('subscriptions/__proto__', { active: false }),
      record('subscriptions/constructor', { active: false }),
    ]), [], anchor, acceptSeal);
    expect(valid.ready).toBe(true);
    expect(valid.inserts).toHaveLength(2);
  });
});

// THE INSTALLATION'S BINDING ANCHORS A PERSON WHO HAS NOT SPOKEN YET (ring 2026-11-02): on a node
// where the person has no record, the executor marks an identity loginBound when the installation
// bound that uid by reviewed configuration; the person then arrives with the import. Without the
// mark, or with a mismatched LID, the law still refuses.
describe('identities anchored by an installation-bound login', () => {
  const uid = 'alice';
  const alice = [record(`users/${uid}`, { lid, displayName: 'Alice' }), record(`persons/${uid}`, { uid, lid }), record('lifetrees/t1', { lid: otherLid, anchorUid: uid })];
  it('a bound login lets the person arrive on an empty node', async () => {
    const plan = await planBundleMerge(await bundle(alice), [], anchor, acceptSeal, [{ sourceUid: uid, targetUid: uid, personLid: lid, loginBound: true }]);
    expect(plan.ready).toBe(true);
    expect(plan.inserts.map(d => d.path)).toEqual([`lifetrees/t1`, `persons/${uid}`, `users/${uid}`]);
  });
  it('without the binding the person is not anchored; with a wrong LID the binding is a conflict', async () => {
    const unbound = await planBundleMerge(await bundle(alice), [], anchor, acceptSeal, [{ sourceUid: uid, targetUid: uid, personLid: lid }]);
    expect(unbound.ready).toBe(false);
    expect(unbound.issues.map(i => i.code)).toEqual(['identity_conflict']);
    const wrong = await planBundleMerge(await bundle(alice), [], anchor, acceptSeal, [{ sourceUid: uid, targetUid: uid, personLid: otherLid, loginBound: true }]);
    expect(wrong.issues.map(i => i.code)).toEqual(['identity_conflict']);
  });
  it('a bound login never overrides a person already here under another LID', async () => {
    const here = [record(`persons/${uid}`, { uid, lid: otherLid })];
    const plan = await planBundleMerge(await bundle(alice), here, anchor, acceptSeal, [{ sourceUid: uid, targetUid: uid, personLid: lid, loginBound: true }]);
    expect(plan.ready).toBe(false);
    expect(plan.issues.map(i => i.code)).toContain('identity_conflict');
  });
});
