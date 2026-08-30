import { describe, expect, it } from 'vitest';
import { chainExport, exportFileName, imageEntriesOf, plainify } from '../src/domain/export';

const NOW = 1783382400000;

describe('the export ceremony', () => {
  it('plainify turns Stamps into ISO and leaves everything else whole', () => {
    expect(plainify({ t: { toMillis: () => NOW }, n: 1, s: 'x', nul: null })).toEqual({
      t: new Date(NOW).toISOString(), n: 1, s: 'x', nul: null,
    });
    expect(plainify({ raw: { seconds: NOW / 1000, nanoseconds: 0 } })).toEqual({
      raw: new Date(NOW).toISOString(),
    });
    expect(plainify([{ a: { toMillis: () => NOW } }])).toEqual([{ a: new Date(NOW).toISOString() }]);
  });

  it('chainExport orders oldest-first and proves an unbroken chain', () => {
    const chain = chainExport([
      { hash: 'b', previousHash: 'a', blockHeight: 2 },
      { hash: 'a', previousHash: '0', blockHeight: 1 },
      { hash: 'c', previousHash: 'b', blockHeight: 3 },
    ]);
    expect(chain.blocks.map(b => b.hash)).toEqual(['a', 'b', 'c']);
    expect(chain.linked).toBe(true);
    expect(chain.breaks).toEqual([]);
  });

  it('states a break, never repairs it', () => {
    const chain = chainExport([
      { hash: 'a', previousHash: '0', blockHeight: 1 },
      { hash: 'c', previousHash: 'MISSING', blockHeight: 2 },
    ]);
    expect(chain.linked).toBe(false);
    expect(chain.breaks).toEqual([1]);
  });

  it('gathers every image seat once, named for the archive', () => {
    const entries = imageEntriesOf([
      { imageUrl: 'https://x/a.jpg?token=1', nested: { latestGrowthUrl: 'https://x/b.png' } },
      { imageUrls: ['https://x/a.jpg?token=1', 'https://x/c.webp'], note: 'no-url-here' },
    ]);
    expect(entries.map(e => e.url)).toEqual(['https://x/a.jpg?token=1', 'https://x/b.png', 'https://x/c.webp']);
    expect(entries[0].name).toBe('001-a.jpg');
    expect(entries[2].name).toBe('003-c.webp');
  });

  it('names the archive by being, name and day', () => {
    expect(exportFileName('tree', 'Tree of Life!', NOW)).toBe('lightseed-tree-tree-of-life-20260707.zip');
    expect(exportFileName('person', '', NOW)).toBe('lightseed-person-person-20260707.zip');
  });
});
