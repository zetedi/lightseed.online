import { describe, expect, it } from 'vitest';
import { bedHeadOf, stayLeafIsDue, stayLeafRecordOf } from '../src/domain/stayLeaf';

const stay = { uid: 'bob', bedId: 'b1', fromDate: '2026-10-30', toDate: '2026-11-02', status: 'accepted', guestTreeName: "Bob's pine", guestTreeGrowthUrl: 'https://m/x.webp' };

describe('the leaf of a stay', () => {
  it('is due exactly when the origin would mint it: accepted, not yet leafed, departed before today', () => {
    expect(stayLeafIsDue(stay, '2026-11-03')).toBe(true);
    expect(stayLeafIsDue(stay, '2026-11-02')).toBe(false);          // the departure day itself is not yet past
    expect(stayLeafIsDue({ ...stay, leafed: true }, '2026-11-03')).toBe(false);
    expect(stayLeafIsDue({ ...stay, status: 'requested' }, '2026-11-03')).toBe(false);
    expect(stayLeafIsDue({ ...stay, bedId: '' }, '2026-11-03')).toBe(false);
    expect(stayLeafIsDue({ ...stay, toDate: 'yesterday' }, '2026-11-03')).toBe(false);
    expect(stayLeafIsDue(stay, 'today')).toBe(false);
  });
  it('reads the bed\'s head as the origin does', () => {
    expect(bedHeadOf({ latestHash: 'h2', genesisHash: 'g' })).toBe('h2');
    expect(bedHeadOf({ latestHash: '', genesisHash: 'g' })).toBe('g');
    expect(bedHeadOf({})).toBe('0');
  });
  it('builds the origin\'s record field for field, wearing the guest\'s tree face only', () => {
    const record = stayLeafRecordOf({ stayId: 's1', stay, id: 'p1', lid: 'L1', mintedAt: 1700000000000, previousHash: 'g' });
    expect(record).toEqual({
      lifetreeId: 'b1', type: 'stay', visibility: 'node', title: "Bob's pine", body: 'stayed 2026-10-30 → 2026-11-02',
      authorId: 'bob', authorName: "Bob's pine", imageUrl: 'https://m/x.webp',
      lid: 'L1', id: 'p1', loveCount: 0, commentCount: 0, mintedAt: 1700000000000, previousHash: 'g', stayId: 's1',
    });
    const { guestTreeName: _face, guestTreeGrowthUrl: _growth, ...nameless } = stay;
    const anonymous = stayLeafRecordOf({ stayId: 's2', stay: { ...nameless, guestName: 'Robert' }, id: 'p2', lid: 'L2', mintedAt: 1, previousHash: '0' });
    expect(anonymous.title).toBe('A guest');
    expect(anonymous.authorName).toBe('');
    expect(anonymous).not.toHaveProperty('imageUrl');
    expect(JSON.stringify(anonymous)).not.toContain('Robert');
  });
});
