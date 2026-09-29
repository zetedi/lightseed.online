import { describe, it, expect } from 'vitest';
import { formEventCircleRefusal, judgeEventCircle, eventCircleName, eventCircleDraft, eventCircleMemberUids } from '../src/domain/eventCircle';
import {
  formEventCircleRefusal as serverRefusal, judgeEventCircle as serverJudge, eventCircleName as serverName,
  eventCircleDraft as serverDraft, eventCircleMemberUids as serverMembers,
} from '../functions/src/eventCircle';
import { DOMAIN_KEYS } from '../src/domain/words';

// THE EVENT CIRCLE (ring 2026-09-27): the trees that stood at a gathering become a community
// by the event's own hand — and THE MIRROR TEST: functions/src/eventCircle.ts is the server's
// copy of the law; every judgment is asked of both and compared.

const facts = (over: Partial<Parameters<typeof formEventCircleRefusal>[0]> = {}) =>
  ({ isEvent: true, isHand: true, rootCircleCommunityId: undefined, participantTreeCount: 2, ...over });
const both = (f: Parameters<typeof formEventCircleRefusal>[0]) => {
  const mine = formEventCircleRefusal(f);
  expect(serverRefusal(f)).toBe(mine);
  expect(serverJudge(f)).toEqual(judgeEventCircle(f));
  return mine;
};

describe('formEventCircleRefusal — the law, in the order the server applies it', () => {
  it('forms when the hand, the gathering and the trees are all there', () => {
    expect(both(facts())).toBeNull();
    expect(both(facts({ participantTreeCount: 1 }))).toBeNull();
  });
  it('only an event', () => { expect(both(facts({ isEvent: false }))).toBe('event_circle_not_event'); });
  it('only the hand', () => { expect(both(facts({ isHand: false }))).toBe('event_circle_not_hand'); });
  it('forms at the root, and gathers into the circle that already stands', () => {
    expect(judgeEventCircle(facts())).toEqual({ outcome: 'form' });
    expect(judgeEventCircle(facts({ rootCircleCommunityId: 'c1' }))).toEqual({ outcome: 'gather', communityId: 'c1' });
    expect(both(facts({ rootCircleCommunityId: 'c1' }))).toBeNull();
    expect(judgeEventCircle(facts({ rootCircleCommunityId: '' }))).toEqual({ outcome: 'form' });
    expect(judgeEventCircle(facts({ rootCircleCommunityId: null }))).toEqual({ outcome: 'form' });
    // The refusals come before the door, gathering or forming alike.
    expect(both(facts({ rootCircleCommunityId: 'c1', isHand: false }))).toBe('event_circle_not_hand');
  });
  it('never from an empty gathering', () => { expect(both(facts({ participantTreeCount: 0 }))).toBe('event_circle_no_participants'); });
  it('every refusal is a word the dictionary carries', () => {
    for (const k of ['event_circle_not_event', 'event_circle_not_hand', 'event_circle_no_participants', 'event_duplicate_not_hand']) {
      expect(DOMAIN_KEYS as readonly string[]).toContain(k);
    }
  });
});

describe('the circle record — the tree circle\'s shape, rooted in an event', () => {
  it('is named by the hand, else by the gathering', () => {
    expect(eventCircleName('  Fire keepers ', 'x')).toBe('Fire keepers');
    expect(eventCircleName('', 'Grove Gathering')).toBe('Grove Gathering Circle');
    expect(eventCircleName(undefined, '')).toBe('Circle');
    expect(eventCircleName('a'.repeat(200), 'x').length).toBe(120);
    for (const [c, t] of [['  Fire keepers ', 'x'], ['', 'Grove Gathering'], [undefined, '']] as const) expect(serverName(c, t)).toBe(eventCircleName(c, t));
  });
  it('has no address of its own; its birthplace is the gathering\'s; the former is its anchor and first member', () => {
    const p = { eventId: 'ev1', eventTitle: 'Grove Gathering', eventDomain: 'WWW.Lightseed.online', eventImageUrl: 'https://x/y.webp', formerUid: 'bakr', name: '' };
    const d = eventCircleDraft(p);
    expect(d).toEqual({
      name: 'Grove Gathering Circle', rootEventId: 'ev1', anchorUid: 'bakr',
      formation: 'event', visibility: 'invited', domain: '', bornOn: 'lightseed.online', papers: [], imageUrls: ['https://x/y.webp'],
    });
    expect(serverDraft(p)).toEqual(d);
    expect(eventCircleDraft({ ...p, eventImageUrl: undefined, eventDomain: undefined }).imageUrls).toEqual([]);
    expect(eventCircleDraft({ ...p, eventDomain: undefined }).bornOn).toBe('');
  });
  it('members are the former and every tree owner, each once', () => {
    expect(eventCircleMemberUids('bakr', ['chen', 'ana', 'chen', undefined, null, '', 'bakr'])).toEqual(['bakr', 'chen', 'ana']);
    expect(serverMembers('bakr', ['chen', 'ana', 'chen', undefined, null, '', 'bakr'])).toEqual(eventCircleMemberUids('bakr', ['chen', 'ana', 'chen', undefined, null, '', 'bakr']));
  });
});
