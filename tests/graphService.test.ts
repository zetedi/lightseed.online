import { describe, expect, it, vi } from 'vitest';
import { createGraphService } from '../src/services/graph';
import type { Store } from '../src/domain/store';
import type { Link } from '../src/domain/link';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const edge = (from: string, rel: Link['rel'] = 'keeper'): Link =>
  ({ type: 'link', from, rel, to: 'tree' });
const store = (): Store => ({
  linksTo: vi.fn(async () => []),
  linksFrom: vi.fn(async () => []),
  secretLinksTo: vi.fn(async () => []),
  secretLinksFrom: vi.fn(async () => []),
  linksByRel: vi.fn(async () => []),
  link: vi.fn(async () => {}),
  unlink: vi.fn(async () => {}),
});

describe('backend-independent graph service', () => {
  it('reads ordinary trees without asking for the private ledger', async () => {
    const backend = store();
    const open = [edge('guardian', 'guardian')];
    vi.mocked(backend.linksTo).mockResolvedValue(open);
    const graph = createGraphService(backend);
    expect(graph.store).toBe(backend);
    expect(await graph.linksToTree({ id: 'tree', treeType: 'LIFETREE' })).toEqual(open);
    expect(backend.linksTo).toHaveBeenCalledWith('tree');
    expect(backend.secretLinksTo).not.toHaveBeenCalled();
  });

  it('merges secret seats once when both ledgers carry the same relationship', async () => {
    const backend = store();
    vi.mocked(backend.linksTo).mockResolvedValue([edge('a'), edge('b', 'guardian')]);
    vi.mocked(backend.secretLinksTo).mockResolvedValue([edge('a'), edge('c')]);
    const links = await createGraphService(backend).linksToTree({ id: 'tree', treeType: 'SECRET' });
    expect(links).toEqual([edge('a'), edge('b', 'guardian'), edge('c')]);
    expect(backend.secretLinksTo).toHaveBeenCalledWith('tree');
  });

  it('preserves the existing refusal behavior without inventing a private seat', async () => {
    const backend = store();
    vi.mocked(backend.linksTo).mockResolvedValue([edge('b', 'guardian')]);
    vi.mocked(backend.secretLinksTo).mockRejectedValue(new Error('permission-denied'));
    expect(await createGraphService(backend).linksToTree({ id: 'tree', treeType: 'SECRET' }))
      .toEqual([edge('b', 'guardian')]);
  });

  it('does not turn a public read failure into an empty successful circle', async () => {
    const backend = store();
    vi.mocked(backend.linksTo).mockRejectedValue(new Error('unavailable'));
    await expect(createGraphService(backend).linksToTree({ id: 'tree', treeType: 'SECRET' }))
      .rejects.toThrow('unavailable');
    expect(backend.secretLinksTo).not.toHaveBeenCalled();
  });

  it('keeps each injected backend separate', async () => {
    const a = store();
    const b = store();
    vi.mocked(a.linksTo).mockResolvedValue([edge('a')]);
    vi.mocked(b.linksTo).mockResolvedValue([edge('b')]);
    expect(await createGraphService(a).linksToTree({ id: 'tree' })).toEqual([edge('a')]);
    expect(await createGraphService(b).linksToTree({ id: 'tree' })).toEqual([edge('b')]);
  });
});

describe('graph composition boundary', () => {
  // Each backend selects its own graph adapter in exactly one place (ring 2026-11-01: the
  // selection moved behind @backend, so the build decides which soil the store stands on);
  // no view, hook or aggregate names an adapter, and neither backend names the other's.
  const importers = (adapter: string): string[] => {
    const root = join(__dirname, '../src');
    const imports: string[] = [];
    const pattern = new RegExp(`(?:from\\s*|import\\s*\\()\\s*['"][^'"]*adapters/${adapter}['"]`);
    const scan = (directory: string) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const file = join(directory, entry.name);
        if (entry.isDirectory()) scan(file);
        else if (/\.tsx?$/.test(entry.name) && pattern.test(readFileSync(file, 'utf8'))) imports.push(relative(root, file));
      }
    };
    scan(root);
    return imports.sort();
  };
  it('the Firebase backend selects the Firestore graph adapter in one place, never a view or aggregate', () => {
    expect(importers('firestore')).toEqual(['services/firebase/store.ts']);
  });
  it('the independent backend selects the HTTP graph adapter in one place', () => {
    expect(importers('independent')).toEqual(['services/independent/store.ts']);
  });
});
