import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { uploadFileName } from '../src/domain/imageBytes';
import { seedMediaNeedsSignIn, seedMediaPath } from '../src/domain/seedMedia.mjs';
import { seedDocsQuery } from '../src/domain/seedDocs.mjs';
import { defaultPersonas, defaultIntelligences } from '../src/domain/intelligenceCommons';

// THE PARITY AUDIT (ring 2026-11-17): the small places where the independent node did less than
// the origin, each closed and held here.
const read = (path: string) => readFileSync(resolve(__dirname, '..', path), 'utf8');

describe('a picture\'s name is one both soils accept', () => {
  it('spaces, accents and symbols become a path the node\'s media door takes', () => {
    for (const name of ['My House (final) №2.JPG', 'ház képe.png', '家.webp', '  ..hidden  ', '']) {
      const filed = `communities/c1/lightHouses/${uploadFileName(name, 1700000000000)}`;
      expect(seedMediaPath(filed), name).toBe(filed);
    }
    expect(uploadFileName('a b.png', 5)).toBe('5-a_b.png');
    expect(uploadFileName('', 5)).toBe('5-picture');
  });
  it('the same name twice is two names', () => {
    expect(uploadFileName('roof.png', 1)).not.toBe(uploadFileName('roof.png', 2));
  });
});

describe('the plans shelf is carved out by its first segment, as in storage.rules', () => {
  it('plans/… needs a signed-in being; everything else is the world\'s', () => {
    expect(seedMediaNeedsSignIn('plans/house/draft.png')).toBe(true);
    expect(seedMediaNeedsSignIn('users/u1/plans/draft.png')).toBe(false);
    expect(seedMediaNeedsSignIn('plansfolder/x.png')).toBe(false);
    expect(seedMediaNeedsSignIn(undefined)).toBe(false);
  });
});

describe('a Light House is asked for by its true name', () => {
  it('the document door takes f.lid on light_houses', () => {
    const query = seedDocsQuery('light_houses', new URLSearchParams({ 'f.lid': '019a0000-0000-7000-8000-000000000001', limit: '1' }));
    expect(query).not.toBeNull();
    expect(read('src/services/independent/beings.ts')).toMatch(/where: \{ lid \}/);
  });
});

describe('the commons\' starting vocabulary is one list for both soils', () => {
  it('names the default voice and its persona', () => {
    expect(defaultPersonas().map(p => p.id)).toContain('persona-oracle');
    const voices = defaultIntelligences('some-model');
    expect(voices.map(v => v.id)).toContain('osiris');
    expect(voices.find(v => v.id === 'gemini-oracle')?.model).toBe('some-model');
  });
  it('both backends seed from it, and neither keeps its own copy', () => {
    for (const backend of ['firebase', 'independent']) {
      const source = read(`src/services/${backend}/intelligence.ts`);
      expect(source, backend).toMatch(/from '\.\.\/\.\.\/domain\/intelligenceCommons'/);
      expect(source, backend).not.toMatch(/id: 'persona-oracle'/);
    }
  });
});

describe('the boot-time hands do their work on the node', () => {
  it('the initiates mirror, the genesis hash and the commons are no longer empty functions', () => {
    const trees = read('src/services/independent/trees.ts');
    expect(trees).not.toMatch(/syncInitiatesMirror: typeof F\.syncInitiatesMirror = async \(\) => \{\};/);
    expect(trees).not.toMatch(/getGenesisHash: typeof F\.getGenesisHash = async \(\) => null;/);
    expect(read('src/services/independent/intelligence.ts')).not.toMatch(/ensureIntelligenceCommons: typeof F\.ensureIntelligenceCommons = async \(\) => \{\};/);
  });
});
