import { describe, it, expect } from 'vitest';
import { walletOf } from '../src/domain/wallet';

const perAuset = { id: 'per-auset', name: 'Per Auset', domain: 'seed.perauset.org', logoUrl: 'https://x/pa.webp', coin: { name: 'Blue Lotus Universal Exchange', code: 'BLUE' } };
const oak = { id: 'oak', name: 'OAK', domain: '', coin: null };
const node = { name: 'Lightseed', domain: 'lightseed.online' };
const places: Record<string, typeof perAuset | typeof oak> = { 'per-auset': perAuset, oak };
const placeOf = (r: { communityId?: string | null }) => (r.communityId ? places[r.communityId] : null);

describe('the wallet — the coins a being holds, each named by its place', () => {
  it('one row per place, the node\'s Light for rays with none, largest first', () => {
    const rows = walletOf([
      { units: 108, communityId: 'per-auset' }, { units: 15, communityId: 'per-auset' },
      { units: 100 }, { units: 108, communityId: 'oak' },
    ], placeOf, node);
    expect(rows.map(r => [r.key, r.coin.code, r.units, r.rays, r.placeName, r.place])).toEqual([
      ['per-auset', 'BLUE', 123, 2, 'Per Auset', 'seed.perauset.org'],
      ['oak', 'light', 108, 1, 'OAK', null],
      ['node', 'light', 100, 1, 'Lightseed', 'lightseed.online'],
    ]);
    expect(rows[0].coin.logoUrl).toBe('https://x/pa.webp');
    expect(rows[1].coin.own).toBe(false);
  });
  it('a ray whose place is unknown rides as the node\'s Light; units never go negative', () => {
    const rows = walletOf([{ units: 50, communityId: 'gone' }, { units: -3 }], () => null, node);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ key: 'node', units: 50, rays: 2 });
  });
  it('an empty hand is an empty wallet', () => {
    expect(walletOf([], placeOf, node)).toEqual([]);
  });
});
