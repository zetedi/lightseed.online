import { describe, it, expect } from 'vitest';
import { linkRouteOf, needsTargetKind } from '../src/domain/seedLinkRoute';
import { seedLinkCommand } from '../src/domain/seedLink.mjs';
import { seedCommunityCommand } from '../src/domain/seedCommunity.mjs';
import { seedTreeCommand } from '../src/domain/seedTree.mjs';

// THE COMMUNITY DOOR AND THE KEEPING KNOCK REACH THE NODE (ring 2026-11-17): the shell's one
// link port is mapped to the command the independent node understands.
const me = 'u-me', other = 'u-other';
const route = (action: 'link' | 'unlink', from: string, rel: string, to: string, toIsCommunity?: boolean) =>
  linkRouteOf({ action, from, rel, to, me, toIsCommunity });

describe('the community door', () => {
  it('one\'s own knock is asked and withdrawn; another\'s is declined', () => {
    expect(route('link', me, 'join_request', 'c1')).toEqual({ door: 'community', command: { action: 'request', id: 'c1' } });
    expect(route('unlink', me, 'join_request', 'c1')).toEqual({ door: 'community', command: { action: 'cancel', id: 'c1' } });
    expect(route('unlink', other, 'join_request', 'c1')).toEqual({ door: 'community', command: { action: 'decline', id: 'c1', member: other } });
  });
  it('membership: one joins or leaves; a keeper accepts or removes', () => {
    expect(route('link', me, 'member', 'c1')).toEqual({ door: 'community', command: { action: 'join', id: 'c1' } });
    expect(route('link', other, 'member', 'c1')).toEqual({ door: 'community', command: { action: 'accept', id: 'c1', member: other } });
    expect(route('unlink', me, 'member', 'c1')).toEqual({ door: 'community', command: { action: 'leave', id: 'c1' } });
    expect(route('unlink', other, 'member', 'c1')).toEqual({ door: 'community', command: { action: 'remove', id: 'c1', member: other } });
  });
  it('a community\'s stewards are granted and revoked; a tree\'s steward seat stays with the link command', () => {
    expect(needsTargetKind('steward')).toBe(true);
    expect(route('link', other, 'steward', 'c1', true)).toEqual({ door: 'community', command: { action: 'grant_steward', id: 'c1', member: other } });
    expect(route('unlink', me, 'steward', 'c1', true)).toEqual({ door: 'community', command: { action: 'revoke_steward', id: 'c1', member: me } });
    expect(route('unlink', me, 'steward', 't1', false)).toEqual({ door: 'link', command: { action: 'unlink', from: me, rel: 'steward', to: 't1' } });
  });
});

describe('the keeping knock, at a tree or a community', () => {
  it('asks, withdraws and declines through the right door', () => {
    expect(needsTargetKind('keeper_request')).toBe(true);
    expect(route('link', me, 'keeper_request', 't1', false)).toEqual({ door: 'tree', command: { action: 'request_keeper', id: 't1' } });
    expect(route('unlink', me, 'keeper_request', 't1', false)).toEqual({ door: 'tree', command: { action: 'cancel_keeper_request', id: 't1' } });
    expect(route('unlink', other, 'keeper_request', 't1', false)).toEqual({ door: 'tree', command: { action: 'decline_keeper_request', id: 't1', member: other } });
    expect(route('link', me, 'keeper_request', 'c1', true)).toEqual({ door: 'community', command: { action: 'request_keeper', id: 'c1' } });
    expect(route('unlink', other, 'keeper_request', 'c1', true)).toEqual({ door: 'community', command: { action: 'decline_keeper_request', id: 'c1', member: other } });
  });
});

describe('everything else goes where it always went', () => {
  it('a guardian follow, a joined vision, a participant tree', () => {
    for (const rel of ['guardian', 'joined', 'participant', 'rooted', 'grows_in']) {
      expect(needsTargetKind(rel)).toBe(false);
      expect(route('link', me, rel, 'x1')).toEqual({ door: 'link', command: { action: 'link', from: me, rel, to: 'x1' } });
    }
  });
  it('no one knocks for another: that write is left to the link command, which refuses it', () => {
    expect(route('link', other, 'join_request', 'c1').door).toBe('link');
    expect(seedLinkCommand({ action: 'link', from: other, rel: 'join_request', to: 'c1' })).toBeNull();
    expect(route('link', other, 'keeper_request', 't1', false).door).toBe('link');
  });
  it('signed out, nothing is one\'s own', () => {
    expect(linkRouteOf({ action: 'unlink', from: other, rel: 'member', to: 'c1', me: null })).toEqual({ door: 'community', command: { action: 'remove', id: 'c1', member: other } });
  });
});

describe('every routed command is one the node\'s own shape-check accepts', () => {
  it('community and tree commands', () => {
    const routes = [
      route('link', me, 'join_request', 'c1'), route('unlink', me, 'join_request', 'c1'), route('unlink', other, 'join_request', 'c1'),
      route('link', me, 'member', 'c1'), route('link', other, 'member', 'c1'), route('unlink', me, 'member', 'c1'), route('unlink', other, 'member', 'c1'),
      route('link', other, 'steward', 'c1', true), route('unlink', other, 'steward', 'c1', true),
      route('link', me, 'keeper_request', 'c1', true), route('unlink', me, 'keeper_request', 'c1', true), route('unlink', other, 'keeper_request', 'c1', true),
      route('link', me, 'keeper_request', 't1', false), route('unlink', me, 'keeper_request', 't1', false), route('unlink', other, 'keeper_request', 't1', false),
    ];
    for (const r of routes) {
      if (r.door === 'community') expect(seedCommunityCommand(r.command), JSON.stringify(r.command)).not.toBeNull();
      else if (r.door === 'tree') expect(seedTreeCommand(r.command), JSON.stringify(r.command)).not.toBeNull();
      else throw new Error('expected a door of its own: ' + JSON.stringify(r));
    }
  });
});
