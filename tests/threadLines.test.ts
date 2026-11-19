import { describe, it, expect } from 'vitest';
import { threadLines, unseenReachIds } from '../src/domain/views/threads';
import type { Pulse } from '../src/domain/pulse';

// What a reader sees of a conversation: whose words are whose, what a group shows, what a
// notice and a retraction look like — and which reaches still wait to be seen.

const pulse = (over: Partial<Pulse> & Record<string, unknown>): Pulse => ({ id: 'p', authorId: 'other', ...over }) as Pulse;
const me = { uid: 'me', treeIds: ['myTree'], group: false };

describe('threadLines', () => {
  it('my words are user, the other side is model; body stands in for content', () => {
    const lines = threadLines([
      pulse({ id: 'a', authorId: 'me', content: 'hello' }),
      pulse({ id: 'b', authorId: 'other', body: 'welcome' }),
    ], me);
    expect(lines.map(l => [l.role, l.text, l.id])).toEqual([['user', 'hello', 'a'], ['model', 'welcome', 'b']]);
  });

  it('a pulse speaking from one of my trees is mine, whoever wrote it', () => {
    const [line] = threadLines([pulse({ authorId: 'carrier', lifetreeId: 'myTree', content: 'from my tree' })], me);
    expect(line.role).toBe('user');
  });

  it('a stored reply is the opposite voice of its pulse', () => {
    const mine = threadLines([pulse({ authorId: 'me', content: 'q', reachResponse: 'a' })], me);
    expect(mine.map(l => l.role)).toEqual(['user', 'model']);
    const theirs = threadLines([pulse({ authorId: 'other', content: 'q', reachResponse: 'a' })], me);
    expect(theirs.map(l => l.role)).toEqual(['model', 'user']);
  });

  it('a mint notice is a system line, and an empty one says nothing', () => {
    const lines = threadLines([
      pulse({ mintNotice: true, content: 'X minted this' }),
      pulse({ mintNotice: true, content: '' }),
    ], me);
    expect(lines).toEqual([{ role: 'model', system: true, text: 'X minted this' }]);
  });

  it('only a group thread attributes its lines', () => {
    const p = pulse({ authorId: 'other', authorName: 'Oak', authorPersonName: 'Ana', authorPhoto: 'u', content: 'hi' });
    expect(threadLines([p], me)[0].authorName).toBeUndefined();
    expect(threadLines([p], { ...me, group: true })[0]).toMatchObject({ authorId: 'other', authorName: 'Oak', authorPersonName: 'Ana', authorPhoto: 'u' });
  });

  it('a retraction and a care alert ride on the line; likes default to none', () => {
    const [line] = threadLines([pulse({ content: 'oops', retractedAt: 1, careAlert: 'watering' })], me);
    expect(line).toMatchObject({ retracted: true, careAlert: 'watering', loveCount: 0 });
    expect(threadLines([pulse({ content: 'fine' })], me)[0].retracted).toBeUndefined();
  });

  it('a signed-out reader owns nothing by uid', () => {
    const [line] = threadLines([pulse({ authorId: '', content: 'x' })], { treeIds: [], group: false });
    expect(line.role).toBe('model');
  });
});

describe('unseenReachIds', () => {
  it('counts what another hand addressed to me and I have not seen', () => {
    const ids = unseenReachIds([
      pulse({ id: 'direct', recipientUid: 'me' }),
      pulse({ id: 'group', participantUids: ['me', 'x'] }),
      pulse({ id: 'seen', recipientUid: 'me', seenBy: ['me'] }),
      pulse({ id: 'mine', authorId: 'me', participantUids: ['me'] }),
      pulse({ id: 'elsewhere', recipientUid: 'x' }),
    ], 'me');
    expect(ids).toEqual(['direct', 'group']);
  });
});
