import { describe, it, expect } from 'vitest';
import { treeInviteClaimRefusal, treeInviteUrl, type OpenTreeInviteFacts } from '../src/domain/treeInvite';
import { DOMAIN_KEYS } from '../src/domain/words';
import { speak } from '../src/utils/translations';

// THE OPEN DOOR to a tree's circle (ring 2026-10-01): an invitation born with no invitee, claimed
// once by the first signed-in hand through its link. Every branch below breaks exactly one fact.
const open = (over: Partial<OpenTreeInviteFacts> = {}): OpenTreeInviteFacts => ({
  exists: true, open: true, status: 'pending', invitedUserId: '', invitedByUserId: 'zoltan',
  revokedAtMs: null, expiresAtMs: null, claimantUid: 'friend', nowMs: 1_000, ...over,
});

describe('treeInviteClaimRefusal — who may take an open invitation', () => {
  it('a signed-in stranger takes a live, open, pending invitation', () => {
    expect(treeInviteClaimRefusal(open())).toBeNull();
  });
  it('refuses, one fact at a time', () => {
    expect(treeInviteClaimRefusal(open({ exists: false }))).toBe('tree_invite_gone');
    expect(treeInviteClaimRefusal(open({ revokedAtMs: 900 }))).toBe('tree_invite_revoked');
    expect(treeInviteClaimRefusal(open({ status: 'revoked' }))).toBe('tree_invite_revoked');
    expect(treeInviteClaimRefusal(open({ expiresAtMs: 1_000 }))).toBe('tree_invite_expired');
    expect(treeInviteClaimRefusal(open({ expiresAtMs: 1_001 }))).toBeNull();
    expect(treeInviteClaimRefusal(open({ status: 'accepted' }))).toBe('tree_invite_settled');
    expect(treeInviteClaimRefusal(open({ open: false }))).toBe('tree_invite_taken');
    expect(treeInviteClaimRefusal(open({ invitedUserId: 'someone' }))).toBe('tree_invite_taken');
    expect(treeInviteClaimRefusal(open({ claimantUid: '' }))).toBe('tree_invite_signin');
    expect(treeInviteClaimRefusal(open({ claimantUid: 'zoltan' }))).toBe('tree_invite_own');
  });
  it('every refusal is a word the dictionary carries', () => {
    for (const k of ['tree_invite_gone', 'tree_invite_revoked', 'tree_invite_expired', 'tree_invite_settled', 'tree_invite_taken', 'tree_invite_signin', 'tree_invite_own']) {
      expect(DOMAIN_KEYS as readonly string[]).toContain(k);
      expect(speak(k as never)).not.toBe(k);
    }
  });
});

describe('treeInviteUrl — the same /i/ door as a community invitation', () => {
  it('builds the link beside the being door, trimming a trailing slash', () => {
    expect(treeInviteUrl('https://seed.theohouse.org/', 'abc123DEF456')).toBe('https://seed.theohouse.org/i/abc123DEF456');
  });
});
