import { describe, it, expect } from 'vitest';
import { publicNameOf, showsPersonName } from '../src/domain/publicName';

// A public name (ring 2026-09-10): anonymous, and only the tree speaks for the being.
describe('publicNameOf — who the network may say did a thing', () => {
  it('speaks the person while they are not anonymous', () => {
    expect(publicNameOf({ displayName: 'Zoltán', anonymous: false, treeName: 'Mahameru' })).toBe('Zoltán');
    expect(publicNameOf({ displayName: '  Zoltán  ', treeName: 'Mahameru' })).toBe('Zoltán');
  });
  it('never speaks the person while anonymous — the tree speaks, or nothing', () => {
    expect(publicNameOf({ displayName: 'Zoltán', anonymous: true, treeName: 'Mahameru' })).toBe('Mahameru');
    expect(publicNameOf({ displayName: 'Zoltán', anonymous: true })).toBeNull();
    expect(publicNameOf({ displayName: 'Zoltán', anonymous: true, treeName: '   ' })).toBeNull();
  });
  it('falls back to the tree when no name was ever written, and to null when neither stands', () => {
    expect(publicNameOf({ displayName: '', treeName: 'Mahameru' })).toBe('Mahameru');
    expect(publicNameOf({ displayName: null, treeName: null })).toBeNull();
    expect(publicNameOf({})).toBeNull();
  });
});

describe('showsPersonName — may the person\'s own name stand beside their tree', () => {
  it('yes only when not anonymous and a name is written', () => {
    expect(showsPersonName({ displayName: 'Zoltán', anonymous: false })).toBe(true);
    expect(showsPersonName({ displayName: 'Zoltán' })).toBe(true);
    expect(showsPersonName({ displayName: 'Zoltán', anonymous: true })).toBe(false);
    expect(showsPersonName({ displayName: '  ', anonymous: false })).toBe(false);
  });
});
