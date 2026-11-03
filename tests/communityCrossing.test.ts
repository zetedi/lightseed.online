// THE WORLD OF A COMMUNITY (ring 2026-11-03): one community leaves a node — its circle, their own
// life trees with whole chains, every being placed at it, what belongs by field, every edge whose
// both ends travel, the public record of everyone named — and what touches it but stays is named.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { communityCrossing, placeResolverOf } from '../src/domain/communityCrossing';
import { verifyBundle, localUidCensus, type BundleDoc, type NodeBundle } from '../src/domain/bundle';
import { buildBundle } from '../seed/api/bundle.mjs';

const LID = (n: number) => `019a0000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const link = (from: string, rel: string, to: string, n: number): [string, Record<string, unknown>] => [`links/${from}__${rel}__${to}`, { lid: LID(n), type: 'link', rel, from, to, createdAt: '2026-01-01T00:00:00.000000Z' }];
const tree = (id: string, n: number, anchorUid: string, treeType: string | null, domain: string | null, extra: Record<string, unknown> = {}): [string, Record<string, unknown>] =>
  [`lifetrees/${id}`, { lid: LID(n), anchorUid, name: id, ...(treeType ? { treeType } : {}), ...(domain ? { domain } : {}), visibility: 'public', genesisHash: `g-${id}`, latestHash: `h-${id}`, blockHeight: 1, ...extra }];
const block = (id: string, n: number, authorId: string, lifetreeId: string, previousHash: string, extra: Record<string, unknown> = {}): [string, Record<string, unknown>] =>
  [`pulses/${id}`, { lid: LID(n), authorId, lifetreeId, type: 'tree_growth', visibility: 'public', hash: `h-${id}`, previousHash, createdAt: '2026-02-01T00:00:00.000000Z', ...extra }];
const soil: Record<string, Record<string, unknown>> = Object.fromEntries([
  ['communities/circle', { lid: LID(31), anchorUid: 'ann', domain: 'circle.example', keeperUids: ['ann', 'kim'], name: 'The Circle' }],
  ['communities/other', { lid: LID(32), anchorUid: 'oda', domain: 'other.example', name: 'Elsewhere' }],
  ...['ann', 'kim', 'mia', 'oda', 'guest', 'lover', 'far'].flatMap((uid, i) => [[`users/${uid}`, { lid: LID(1 + i), email: `${uid}@example.org` }], [`persons/${uid}`, { uid, lid: LID(1 + i) }]] as [string, Record<string, unknown>][]),
  ['persons/ann/keys/fp1', { pubkey: 'AAAA' }],
  ['persons/mia/keys/fp2', { pubkey: 'BBBB' }],
  ['persons/oda/keys/fp3', { pubkey: 'CCCC' }],
  ['users/ann/pushSubscriptions/d1', { endpoint: 'https://push.example/1' }],
  link('kim', 'keeper', 'circle', 61), link('mia', 'member', 'circle', 62), link('guest', 'join_request', 'circle', 63), link('oda', 'member', 'other', 64),
  // ann's own life tree (no domain), mia's life tree planted at the old door, oda's life tree elsewhere.
  tree('t-ann', 11, 'ann', 'LIFETREE', null, { latestHash: 'h-b2', blockHeight: 2 }), tree('t-mia', 12, 'mia', 'LIFETREE', 'circle.web.app'), tree('t-oda', 13, 'oda', 'LIFETREE', 'other.example'),
  // nature trees: one planted at the circle by a stranger, one kept by a member but planted elsewhere, one untyped legacy tree of a member.
  tree('oak', 14, 'far', 'GUARDED', 'circle.example'), tree('fir', 15, 'ann', 'GUARDED', 'other.example'), tree('elder', 16, 'kim', null, null),
  link('t-oda', 'grows_in', 'circle', 65), link('lover', 'guardian', 't-ann', 66), link('ann', 'guardian', 't-oda', 67), link('kim', 'guardian', 'oak', 68),
  ['lifetrees/t-ann/loves/lover', { uid: 'lover', at: '2026-03-01T00:00:00.000000Z' }],
  ['lifetrees/t-oda/loves/ann', { uid: 'ann', at: '2026-03-01T00:00:00.000000Z' }],
  block('b1', 21, 'ann', 't-ann', 'g-t-ann'), block('b2', 22, 'ann', 't-ann', 'h-b1', { type: 'reach', visibility: 'private', recipientUid: 'oda' }),
  block('b3', 23, 'mia', 't-mia', 'g-t-mia'), block('b5', 25, 'oda', 't-oda', 'g-t-oda'), block('b6', 24, 'far', 'oak', 'g-oak'),
  ['pulses/e1', { lid: LID(26), authorId: 'kim', type: 'event', communityId: 'circle', visibility: 'public', hash: 'e1', previousHash: 'EVENT', createdAt: '2026-02-06T00:00:00.000000Z' }],
  ['pulses/e2', { lid: LID(27), authorId: 'oda', type: 'event', domain: 'circle.example', visibility: 'public', hash: 'e2', previousHash: 'EVENT', createdAt: '2026-02-07T00:00:00.000000Z' }],
  ['pulses/e3', { lid: LID(28), authorId: 'oda', type: 'event', communityId: 'other', visibility: 'public', hash: 'e3', previousHash: 'EVENT', createdAt: '2026-02-08T00:00:00.000000Z' }],
  ['pulses/o1', { lid: LID(29), authorId: 'mia', type: 'offering', visibility: 'public', hash: 'o1', previousHash: 'OFFERING', createdAt: '2026-02-09T00:00:00.000000Z' }],
  ['pulses/e1/loves/guest', { uid: 'guest', at: '2026-03-02T00:00:00.000000Z' }],
  ['gifts/o1__ann', { offeringId: 'o1', giverUid: 'ann', units: 3 }],
  ['rays/t-ann__2026-02-01__carer', { treeId: 't-ann', holderUid: 'ann', communityId: 'circle', units: 1 }],
  ['rays/t-oda__2026-02-01__carer', { treeId: 't-oda', holderUid: 'oda', communityId: 'circle', units: 1 }],
  ['glow/circle', { units: 5 }], ['glow/NODE', { units: 9 }],
  ['communityInvites/inv1', { communityId: 'circle', createdBy: 'ann' }],
  ['communityInvites/inv2', { communityId: 'other', createdBy: 'oda' }],
  ['treeKeepingInvites/tk1', { lifetreeId: 't-ann', invitedByUserId: 'ann', invitedUserId: 'kim' }],
  ['subscriptions/circle.example__x', { domain: 'circle.example', email: 'x@example.org' }],
  ['subscriptions/other.example__y', { domain: 'other.example', email: 'y@example.org' }],
  ['lightHouses/house', { lid: LID(41), anchorUid: 'ann', name: 'Hearth' }],
  ['lightHouses/lodge', { lid: LID(42), anchorUid: 'far', name: 'Lodge', domain: 'www.Circle.example' }],
  link('house', 'shelters', 'circle', 69),
  ['stays/s1', { lid: LID(51), lightHouseId: 'house', uid: 'mia', hostUid: 'ann', guestTreeId: 't-mia' }],
  ['stays/s2', { lid: LID(52), lightHouseId: 'far-house', uid: 'mia', hostUid: 'oda', guestTreeId: 't-mia' }],
  ['alignments/a1', { lid: LID(71), initiatorTreeId: 't-ann', targetTreeId: 't-mia', initiatorUid: 'ann', targetUid: 'mia' }],
  ['alignments/a2', { lid: LID(72), initiatorTreeId: 't-ann', targetTreeId: 't-oda', initiatorUid: 'ann', targetUid: 'oda' }],
  ['covenants/align_a1', { lid: LID(81), alignmentId: 'a1' }],
  ['covenants/align_a2', { lid: LID(82), alignmentId: 'a2' }],
  ['config/superadmin', { uid: 'ann' }], ['admins/ann', {}],
  ['intelligences/i1', { lid: LID(91), anchorUid: 'kim', name: 'Oracle' }],
]);
const docs: BundleDoc[] = Object.entries(soil).map(([path, data]) => ({ path, data }));
const faces = [{ door: 'circle.example', domains: ['circle.example', 'circle.web.app'] }];

describe('the world of a community', () => {
  const world = communityCrossing(docs, 'circle', { placeOf: placeResolverOf(docs, faces) });
  if (typeof world === 'string') throw new Error(world);
  const paths = world.docs.map(d => d.path);

  it('takes the circle whole and everyone it names by their public record alone', () => {
    expect(world.members).toEqual(['ann', 'kim', 'mia']);
    expect(world.named).toEqual(['far', 'guest', 'lover', 'oda']);
    for (const uid of ['ann', 'kim', 'mia']) expect(paths).toEqual(expect.arrayContaining([`users/${uid}`, `persons/${uid}`]));
    for (const uid of ['far', 'guest', 'lover', 'oda']) { expect(paths).toContain(`persons/${uid}`); expect(paths).not.toContain(`users/${uid}`); }
    expect(paths).toEqual(expect.arrayContaining(['persons/ann/keys/fp1', 'persons/mia/keys/fp2']));
    for (const path of ['persons/oda/keys/fp3', 'users/ann/pushSubscriptions/d1']) expect(paths).not.toContain(path);
  });

  it('carries everything a member anchors with whole chains, and every being placed here whatever its anchor', () => {
    expect(paths).toEqual(expect.arrayContaining(['lifetrees/t-ann', 'lifetrees/t-mia', 'lifetrees/elder', 'lifetrees/fir', 'lifetrees/oak', 'pulses/b1', 'pulses/b2', 'pulses/b3', 'pulses/b6', 'lifetrees/t-ann/loves/lover', 'lightHouses/house', 'lightHouses/lodge', 'stays/s1', 'alignments/a1', 'covenants/align_a1', 'intelligences/i1', 'links/kim__guardian__oak']));
    for (const path of ['lifetrees/t-oda', 'pulses/b5', 'lifetrees/t-oda/loves/ann', 'alignments/a2', 'covenants/align_a2', 'stays/s2', 'communities/other', 'config/superadmin', 'admins/ann']) expect(paths).not.toContain(path);
  });

  it('takes what belongs by field — events and decisions by id or place, offerings by hand, rays of its trees, its glow, its doors, its subscribers', () => {
    expect(paths).toEqual(expect.arrayContaining(['pulses/e1', 'pulses/e2', 'pulses/o1', 'pulses/e1/loves/guest', 'gifts/o1__ann', 'rays/t-ann__2026-02-01__carer', 'glow/circle', 'communityInvites/inv1', 'treeKeepingInvites/tk1', 'subscriptions/circle.example__x']));
    for (const path of ['pulses/e3', 'rays/t-oda__2026-02-01__carer', 'glow/NODE', 'communityInvites/inv2', 'subscriptions/other.example__y']) expect(paths).not.toContain(path);
  });

  it('carries every edge whose both ends travel and names what touches the circle but stays', () => {
    expect(paths).toEqual(expect.arrayContaining(['links/kim__keeper__circle', 'links/mia__member__circle', 'links/guest__join_request__circle', 'links/lover__guardian__t-ann', 'links/house__shelters__circle']));
    expect(paths).not.toContain('links/oda__member__other');
    expect(world.left).toEqual([
      { path: 'alignments/a2', reason: 'alignment_with_a_tree_outside_the_circle' },
      { path: 'links/ann__guardian__t-oda', reason: 'edge_to_a_being_outside_the_circle' },
      { path: 'links/t-oda__grows_in__circle', reason: 'edge_to_a_being_outside_the_circle' },
      { path: 'stays/s2', reason: 'stay_at_a_house_outside_the_circle' },
    ]);
  });

  it('resolves places through the faces\' aliases and the hand\'s own, never through a stranger\'s domain', () => {
    const resolve = placeResolverOf(docs, faces, [{ alias: 'old-circle.web.app', communityId: 'circle' }]);
    for (const [place, expected] of [['circle.example', 'circle'], ['Circle.Web.App', 'circle'], ['www.circle.example', 'circle'], ['old-circle.web.app', 'circle'], ['other.example', 'other'], ['stranger.example', null], [null, null]] as const) expect(resolve(place)).toBe(expected);
    // Without the faces, only each community's own domain names it: the stranger's oak at the old door is no longer placed here, while a member's tree travels regardless.
    const bare = communityCrossing(docs, 'circle');
    if (typeof bare === 'string') throw new Error(bare);
    expect(bare.docs.map(d => d.path)).toContain('lifetrees/t-mia');
    const strangersOak = { ...soil, 'lifetrees/oak': { ...soil['lifetrees/oak'], domain: 'circle.web.app' } };
    const unaliased = communityCrossing(Object.entries(strangersOak).map(([path, data]) => ({ path, data })), 'circle');
    if (typeof unaliased === 'string') throw new Error(unaliased);
    expect(unaliased.docs.map(d => d.path)).not.toContain('lifetrees/oak');
  });

  it('is a bundle that verifies, whose census names exactly the circle and the named', async () => {
    const charter = JSON.parse(readFileSync(resolve('src/config/charter.json'), 'utf8'));
    const bundle = await buildBundle({ snapshot: world.docs, charter, exportCommit: 'a'.repeat(40), charterHashes: { genesisMd: '0'.repeat(64), linMd: '1'.repeat(64) }, withoutAuthority: true });
    expect((await verifyBundle(bundle as unknown as NodeBundle)).ok).toBe(true);
    expect(localUidCensus(world.docs).sort()).toEqual(['ann', 'far', 'guest', 'kim', 'lover', 'mia', 'oda']);
    expect(communityCrossing(docs, 'nowhere')).toBe('community_missing');
  });
});
