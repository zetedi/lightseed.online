import { describe, it, expect } from 'vitest';
import { isSecretTree, rootsABeing, MAX_SECRET_TREES, SECRET_TREE_TYPE, invitableRolesFor } from '../src/domain/secretTree';
import { isSecretTree as serverIsSecret, rootsABeing as serverRoots, MAX_SECRET_TREES as SERVER_MAX, SECRET_TREE_TYPE as SERVER_TYPE, secretRoleAllowed } from '../functions/src/treeKind';
import { treePlantingGate } from '../src/domain/limits';
import { sustainingSeven } from '../src/domain/sustainingSeven';
import { isLivingLifetree } from '../src/domain/guardianship';
import { judgeWitness, type WitnessFacts } from '../functions/src/mint';
import { DOMAIN_KEYS } from '../src/domain/words';
import type { Lifetree } from '../src/domain/lifetree';

// THE SECRET TREE (ring 2026-10-02): a secret tree grants nothing outside itself. Every test below
// is one face of that one line — and the server's copy of the kind law answers as the domain does.

const kinds = [{}, { treeType: 'LIFETREE' }, { treeType: 'GUARDED' }, { treeType: 'BED' }, { treeType: 'SECRET' }, null, undefined];

describe('the kind law and its mirror', () => {
  it('names the secret tree and says what roots a being', () => {
    expect(isSecretTree({ treeType: 'SECRET' })).toBe(true);
    expect(isSecretTree({ treeType: 'LIFETREE' })).toBe(false);
    expect(rootsABeing({ treeType: 'SECRET' })).toBe(false);
    expect(rootsABeing({ treeType: 'BED' })).toBe(false);
    expect(rootsABeing({ treeType: 'LIFETREE' })).toBe(true);
    expect(rootsABeing({})).toBe(true); // absent = a lifetree
  });
  it('the server answers identically', () => {
    expect(SERVER_TYPE).toBe(SECRET_TREE_TYPE);
    expect(SERVER_MAX).toBe(MAX_SECRET_TREES);
    for (const k of kinds) {
      expect(serverIsSecret(k)).toBe(isSecretTree(k));
      expect(serverRoots(k)).toBe(rootsABeing(k));
    }
  });
});

describe('its only seat is keeping — whoever is let in keeps it', () => {
  it('a secret tree offers keeping alone; every other tree all four seats; the server agrees', () => {
    expect([...invitableRolesFor({ treeType: 'SECRET' })]).toEqual(['keeper']);
    expect([...invitableRolesFor({ treeType: 'LIFETREE' })]).toEqual(['keeper', 'steward', 'guardian', 'observer']);
    for (const k of kinds) for (const role of ['keeper', 'steward', 'guardian', 'observer']) {
      expect(secretRoleAllowed(k, role)).toBe((invitableRolesFor(k) as readonly string[]).includes(role));
    }
  });
});

describe('no citizenship: the caps, the seven, validation', () => {
  it('a secret tree counts against neither cap — only against its own small ceiling', () => {
    const limits = { maxLifetrees: 1, maxGuardedTrees: 1 } as never;
    const secrets = Array.from({ length: 5 }, () => ({ treeType: 'SECRET' }));
    expect(treePlantingGate(secrets, 'LIFETREE', limits)).toBeNull();
    expect(treePlantingGate([{ treeType: 'LIFETREE' }], 'SECRET', limits)).toBeNull();
    const full = Array.from({ length: MAX_SECRET_TREES }, () => ({ treeType: 'SECRET' }));
    expect(treePlantingGate(full, 'SECRET', limits)).toMatch(/limit_secret_trees/);
    expect(DOMAIN_KEYS as readonly string[]).toContain('limit_secret_trees');
  });
  it('a secret tree is no part of the sustaining seven', () => {
    const tree = (id: string, treeType?: string) => ({ id, name: id, anchorUid: 'ana', treeType } as unknown as Lifetree);
    expect(sustainingSeven([tree('a'), tree('s', 'SECRET')], [], 'ana').planted).toBe(1);
  });
  it('a secret tree is never a living lifetree (so it validates no one and is validated by no one)', () => {
    expect(isLivingLifetree({ treeType: 'SECRET', isNature: false, diedAtMs: null })).toBe(false);
  });
});

describe('witnessed, but no light', () => {
  const facts = (treeType: string): WitnessFacts => ({
    witnessUid: 'bo',
    pulse: { exists: true, care: 'watering', wateringConfirmedBy: 'ai', carerUid: 'ana', treeId: 't', createdAtMs: Date.UTC(2026, 9, 2, 9) },
    witnessSinceMs: Date.UTC(2026, 9, 1),
    tree: { exists: true, treeType, diedAtMs: null },
    carerRayExists: false, witnessRayExists: false,
  });
  it('a secret tree\'s watering is confirmed and kindles nothing; a lifetree\'s kindles', () => {
    const secret = judgeWitness(facts('SECRET'));
    expect(secret).toEqual({ outcome: 'kindle', dayKey: '2026-10-02', carerRay: null, witnessRay: null });
    const life = judgeWitness(facts('LIFETREE'));
    expect(life.outcome === 'kindle' && life.carerRay?.units).toBe(108);
  });
  it('every gate before the light still stands for a secret tree (self-witness, no standing)', () => {
    expect(judgeWitness({ ...facts('SECRET'), witnessUid: 'ana' }).outcome).toBe('reject');
    expect(judgeWitness({ ...facts('SECRET'), witnessSinceMs: null }).outcome).toBe('reject');
  });
});
