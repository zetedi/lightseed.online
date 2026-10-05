import { describe, it, expect } from 'vitest';
import { followEdit } from '../src/domain/refreshFollow';

// AN EDIT IS SEEN WHERE IT STANDS (ring 2026-10-05): the open being merges a patch, re-reads on a
// bare announcement of its own id, and ignores every other whisper.

describe('followEdit', () => {
  it('merges a patch that names the open being', () => {
    expect(followEdit('e1', { id: 'e1', patch: { title: 'New' } })).toEqual({ kind: 'merge', patch: { title: 'New' } });
  });
  it('re-reads on a bare announcement of its own id', () => {
    expect(followEdit('e1', { id: 'e1' })).toEqual({ kind: 'reread' });
  });
  it('keeps still for another being, for no id, and when nothing is open', () => {
    expect(followEdit('e1', { id: 'e2', patch: { title: 'x' } })).toEqual({ kind: 'keep' });
    expect(followEdit('e1', { patch: { title: 'x' } })).toEqual({ kind: 'keep' });
    expect(followEdit(null, { id: 'e1', patch: { title: 'x' } })).toEqual({ kind: 'keep' });
    expect(followEdit(undefined, { id: 'e1' })).toEqual({ kind: 'keep' });
  });
});
