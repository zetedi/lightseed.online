import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// THE OPAQUE GUARD (ring 2026-09-12). The worker's runtime caches are keyed by URL alone, so a
// response fetched in no-CORS mode (status 0, an OPAQUE body) is handed back to any later
// request for the same URL — including a `crossorigin` <img>, which cannot read it and paints
// nothing. That was the grey band across the forest's map: the dashboard's mini map wrote
// opaque tiles, the forest map read them. Two laws keep it from returning:
//   1. every tile layer fetches in CORS mode (crossOrigin: true), and the tile cache admits
//      only 200 — so no tile entry can ever be opaque;
//   2. the picture cache still admits 0 (pictures are plain <img>s, and an opaque body
//      satisfies a plain <img>) — which holds ONLY while no picture in src/ wears crossorigin.
// A file that asks for CORS mode must therefore be a tile layer, named here.

const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'src');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(name) ? [p] : [];
  });

const CORS_MODE = /crossorigin|crossOrigin/;

const TILE_LAYERS = [
  'components/ForestMap.tsx',
  'components/ui/MiniForestMap.tsx',
  'components/ui/LocationPicker.tsx',
];

describe('no cache lies: opaque responses never reach a crossorigin reader', () => {
  it('every tile layer fetches in CORS mode, and nothing else in src/ asks for it', () => {
    const asking = walk(SRC)
      .filter((f) => CORS_MODE.test(readFileSync(f, 'utf8')))
      .map((f) => f.slice(SRC.length + 1))
      .sort();
    expect(asking).toEqual([...TILE_LAYERS].sort());
    for (const file of TILE_LAYERS) {
      const src = readFileSync(join(SRC, file), 'utf8');
      const layers = src.match(/L\.tileLayer\([\s\S]*?\)\.addTo/g) || [];
      expect(layers.length, `${file} declares a tile layer`).toBeGreaterThan(0);
      for (const layer of layers) expect(layer, `${file}: a tile layer without crossOrigin`).toMatch(/crossOrigin:\s*true/);
    }
  });

  it('the tile cache admits only 200; the picture cache may admit 0 while pictures stay plain', () => {
    const config = readFileSync(join(ROOT, 'vite.config.ts'), 'utf8');
    const rules = [...config.matchAll(/cacheName:\s*'([^']+)'[\s\S]*?cacheableResponse:\s*\{\s*statuses:\s*\[([^\]]*)\]/g)]
      .map((m) => [m[1], m[2].split(',').map((s) => Number(s.trim()))] as const);
    const byName = Object.fromEntries(rules);
    expect(byName['map-tiles-v2']).toEqual([200]);
    expect(byName['tree-images']).toBeDefined();
    // The retired name must never come back: a reader's disk may still hold its poisoned entries.
    expect(byName['map-tiles']).toBeUndefined();
  });
});
