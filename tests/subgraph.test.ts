import { describe, it, expect } from 'vitest';
import { subgraphOf, pathTo, type SubgraphNode, type SubgraphEdge } from '../src/domain/subgraph';

// The longitudinal walk (ring 2026-08-25): depth counts PERSON-CROSSINGS, not records —
// "not the same person's trees, but the tree of his next person."

const N = (id: string, ownerUid?: string | null, kind = 'tree'): SubgraphNode => ({ id, kind, ownerUid });
const E = (from: string, to: string, rel = 'points'): SubgraphEdge => ({ from, rel, to });

// Ana's cluster: two trees + a vision. Bakr's tree joins Ana's vision. Chen's tree
// stands in Bakr's community.
const nodes = [
  N('anaTree1', 'ana'), N('anaTree2', 'ana'), N('anaVision', 'ana', 'vision'),
  N('bakrTree', 'bakr'), N('bakrCom', 'bakr', 'community'),
  N('chenTree', 'chen'),
];
const edges = [
  E('anaTree1', 'anaVision', 'participant'), E('anaTree2', 'anaVision', 'participant'),
  E('bakrTree', 'anaVision', 'participant'),
  E('bakrTree', 'bakrCom', 'grows_in'),
  E('chenTree', 'bakrCom', 'grows_in'),
];

describe('subgraphOf — depth is social distance', () => {
  it('one person\'s whole cluster is distance 0, however many beings it holds', () => {
    const walk = subgraphOf('anaTree1', { nodes, edges }, { personDepth: 0 });
    expect(walk.beings.map(b => b.id).sort()).toEqual(['anaTree1', 'anaTree2', 'anaVision']);
    expect(walk.beings.every(b => b.distance === 0)).toBe(true);
  });

  it('the next person costs one; their cluster then walks free', () => {
    const walk = subgraphOf('anaTree1', { nodes, edges }, { personDepth: 1 });
    const dist = Object.fromEntries(walk.beings.map(b => [b.id, b.distance]));
    expect(dist['bakrTree']).toBe(1);
    expect(dist['bakrCom']).toBe(1);   // same owner as bakrTree — no extra cost
    expect(dist['chenTree']).toBeUndefined(); // the third person is beyond the budget
  });

  it('the third person appears at depth 2 — and the walk terminates despite cycles', () => {
    const cyclic = [...edges, E('chenTree', 'anaTree2', 'points')]; // closes a loop
    const walk = subgraphOf('anaTree1', { nodes, edges: cyclic }, { personDepth: 2 });
    const dist = Object.fromEntries(walk.beings.map(b => [b.id, b.distance]));
    expect(dist['chenTree']).toBe(1); // the loop gave chen a SHORTER route (via anaTree2)
    expect(walk.beings.length).toBe(6);
  });

  it('two routes keep the minimal person distance (0-1 BFS, not plain BFS)', () => {
    // bakrCom is reachable via bakrTree (cross once, then free) — never counted twice.
    const walk = subgraphOf('anaVision', { nodes, edges }, { personDepth: 1 });
    expect(walk.beings.find(b => b.id === 'bakrCom')?.distance).toBe(1);
  });

  it('an unseen being is a WALL: neither shown nor walked through', () => {
    // Hide bakrTree — bakrCom's only bridge from Ana's world.
    const walk = subgraphOf('anaTree1', { nodes, edges }, { personDepth: 3, canSee: n => n.id !== 'bakrTree' });
    const ids = walk.beings.map(b => b.id);
    expect(ids).not.toContain('bakrTree');
    expect(ids).not.toContain('bakrCom');   // opaque, not transparent
    expect(ids).not.toContain('chenTree');
  });

  it('ownerless beings are conservative: crossing to one always costs', () => {
    const world = { nodes: [N('mine', 'ana'), N('commons', null), N('theirs', 'bakr')], edges: [E('mine', 'commons'), E('commons', 'theirs')] };
    const walk = subgraphOf('mine', world, { personDepth: 1 });
    const dist = Object.fromEntries(walk.beings.map(b => [b.id, b.distance]));
    expect(dist['commons']).toBe(1);
    expect(dist['theirs']).toBeUndefined(); // commons → theirs is another crossing
  });

  it('an unknown or unseen start returns the empty walk', () => {
    expect(subgraphOf('ghost', { nodes, edges }, { personDepth: 2 }).beings).toEqual([]);
    expect(subgraphOf('anaTree1', { nodes, edges }, { personDepth: 2, canSee: () => false }).beings).toEqual([]);
  });
});

describe('pathTo — the provenance a future knock will carry', () => {
  it('rebuilds the walk from the start to a distant being', () => {
    const walk = subgraphOf('anaTree1', { nodes, edges }, { personDepth: 2 });
    const path = pathTo(walk, 'chenTree');
    expect(path[0].beingId).toBe('anaTree1');
    expect(path[path.length - 1].beingId).toBe('chenTree');
    expect(path.map(p => p.beingId)).toContain('bakrCom'); // through the shared garden
  });
});
