import { describe, expect, it } from 'vitest';
import { mailVoiceOf } from '../src/domain/mailVoice';
import {
  MAIL_DAILY_LIMIT, MAIL_MAX_ATTEMPTS, REACH_THROTTLE_MS, escapeHtml, systemMailOf, systemLetterOf, reachRecipientsOf, reachIsGroup,
  reachThreadKeyOf, reachThrottleIdOf, reachMayWrite, reachLetterOf, knockLetterOf, knockRecipientsOf, welcomeLetterOf,
  newsletterFooterOf, unsubscribeUrlOf, newsletterHeadersOf, mailRetryDelayMs, mailSettlementOf, outboxIsStale,
} from '../src/domain/mailLetter';

// THE LETTERS A NODE WRITES (ring 2026-11-03): what a hand may ask, how the words are dressed, who a
// reach is written to and when, how a knock is bounded, how patiently the courier retries.
const node = { name: 'Example node', origin: 'https://node.example', postal: 'keeper@node.example' };
const bare = mailVoiceOf(null, node);
const place = mailVoiceOf({ name: 'The O House', domain: 'theohouse.org', theme: { primary: '#7B9476', text: '#504243', background: '#FEF8F3' },
  mail: { greeting: 'Dear friend,', signature: 'With gratitude,\nThe O House', footer: 'The O House · a garden' } }, node);

describe('the system letter', () => {
  it('cleans the ask like the origin node: recipients trimmed and counted, words bounded, only http(s) links', () => {
    expect(systemMailOf({ to: ' a@b.co ', text: 'hi' }, 'Example node')).toEqual({ recipients: ['a@b.co'], subject: 'A message from Example node', text: 'hi', ctaUrl: '', ctaLabel: 'Open' });
    expect(systemMailOf({ to: [], text: 'x' }, 'n')).toEqual({ refusal: 'mail_no_recipient' });
    expect(systemMailOf({ to: ['', '  '], text: 'x' }, 'n')).toEqual({ refusal: 'mail_no_recipient' });
    expect(systemMailOf({ to: ['a@b.co', 'c@d.co', 'e@f.co', 'g@h.co', 'i@j.co', 'k@l.co'] }, 'n')).toEqual({ refusal: 'mail_too_many' });
    expect(systemMailOf({ to: ['not an address'] }, 'n')).toEqual({ refusal: 'mail_bad_recipient' });
    expect(systemMailOf({ to: 'a@b.co', ctaUrl: 'javascript:alert(1)' }, 'n')).toEqual({ refusal: 'mail_bad_link' });
    const long = systemMailOf({ to: 'a@b.co', subject: 's'.repeat(300), text: 't'.repeat(5000), ctaUrl: 'https://x.y/' + 'z'.repeat(600), ctaLabel: 'l'.repeat(100) }, 'n');
    expect('refusal' in long).toBe(false);
    if (!('refusal' in long)) { expect(long.subject).toHaveLength(200); expect(long.text).toHaveLength(4000); expect(long.ctaUrl).toHaveLength(500); expect(long.ctaLabel).toHaveLength(80); }
  });
  it('dresses the words in the voice, escapes every word and link, and keeps the plain twin', () => {
    const letter = systemLetterOf('Hello <you> & welcome', 'https://node.example/i/abc?x=1&y="2"', 'Open "it"', place);
    expect(letter.html).toContain('<h2 style="color: #7b9476; font-weight: 300; letter-spacing: 1px; margin-bottom: 20px;">The O House</h2>');
    expect(letter.html).toContain('Dear friend,<br><br>Hello &lt;you&gt; &amp; welcome<br><br>With gratitude,<br>The O House');
    expect(letter.html).toContain('href="https://node.example/i/abc?x=1&amp;y=&quot;2&quot;"');
    expect(letter.html).toContain('>Open &quot;it&quot;</a>');
    expect(letter.html).toContain('color: #504243; background: #fef8f3;');
    expect(letter.html).toContain('The O House · a garden</p></div>');
    expect(letter.html).not.toContain('<you>');
    expect(letter.text).toBe('Dear friend,\n\nHello <you> & welcome\n\nWith gratitude,\nThe O House\n\nhttps://node.example/i/abc?x=1&y="2"');
    const plain = systemLetterOf('Just words', '', 'Open', bare);
    expect(plain.html).not.toContain('Or paste this link');
    expect(plain.html).toContain('Sent from <a href="https://node.example" style="color: #059669; text-decoration: none;">Example node</a> on the Lifetree Network<br/>keeper@node.example');
    expect(plain.text).toBe('Just words');
  });
  it('escapes the five characters HTML cares about', () => {
    expect(escapeHtml('<a href="x">&</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  });
});

describe('the reach notice', () => {
  const dm = { type: 'reach', authorId: 'ana', authorName: "Ana's oak", recipientUid: 'bo', recipientName: "Bo's pine", content: 'Shall we align?', threadId: 'treeA__treeB' };
  const group = { type: 'reach', authorId: 'ana', authorName: 'Ana', participantUids: ['ana', 'bo', 'cy'], threadId: 'grp__t1__guardians__ana', threadName: 'Nur · Guardians', body: 'Water me' };
  it('is written to everyone in the thread but the author, or to the one addressed', () => {
    expect(reachRecipientsOf(dm)).toEqual(['bo']);
    expect(reachRecipientsOf(group)).toEqual(['bo', 'cy']);
    expect(reachRecipientsOf({ type: 'reach', authorId: 'ana' })).toEqual([]);
    expect(reachRecipientsOf({ type: 'reach', authorId: 'ana', participantUids: ['ana', 'bo', 'bo'] })).toEqual(['bo']);
    expect(reachIsGroup(dm)).toBe(false); expect(reachIsGroup(group)).toBe(true);
    expect(reachIsGroup({ participantUids: ['a', 'b'] })).toBe(false); expect(reachIsGroup({ participantUids: ['a', 'b'], isGroup: true })).toBe(true);
  });
  it('counts quiet by thread and recipient, and respects the opt-out and a missing address', () => {
    expect(reachThreadKeyOf(dm)).toBe('treeA__treeB');
    expect(reachThreadKeyOf({ reachTreeId: 'a/b', lifetreeId: 'c' })).toBe('a_b_c');
    expect(reachThrottleIdOf('bo', dm)).toBe('bo__treeA__treeB');
    const now = 1_000_000_000_000;
    expect(reachMayWrite({ email: 'bo@x.y', lastSentAtMs: null, nowMs: now })).toBe(true);
    expect(reachMayWrite({ email: 'bo@x.y', lastSentAtMs: now - REACH_THROTTLE_MS + 1, nowMs: now })).toBe(false);
    expect(reachMayWrite({ email: 'bo@x.y', lastSentAtMs: now - REACH_THROTTLE_MS, nowMs: now })).toBe(true);
    expect(reachMayWrite({ email: 'bo@x.y', directMessages: false, lastSentAtMs: null, nowMs: now })).toBe(false);
    expect(reachMayWrite({ email: null, lastSentAtMs: null, nowMs: now })).toBe(false);
    expect(reachMayWrite({ email: 'nope', lastSentAtMs: null, nowMs: now })).toBe(false);
  });
  it('says who wrote to whom, quotes the words escaped, and names the node in the subject', () => {
    const letter = reachLetterOf({ ...dm, content: 'Shall we <align>?' }, bare, 'Example node');
    expect(letter.subject).toBe("Ana's oak sent Bo's pine a direct message on Example node");
    expect(letter.text).toBe(`Ana's oak sent a direct message to Bo's pine:\n\n"Shall we <align>?"\n\nOpen your messages: https://node.example`);
    expect(letter.html).toContain(`A new direct message for <strong style="color:#059669;">Bo's pine</strong>`);
    expect(letter.html).toContain('<blockquote style="font-size: 16px; margin: 0 0 28px; padding: 16px 20px; background:rgba(0,0,0,0.04); border-left: 4px solid #059669; border-radius: 8px;">Shall we &lt;align&gt;?</blockquote>');
    expect(letter.html).not.toContain('<p style="font-size: 15px; margin: 0 0 10px;">'); // the node speaks bare: no greeting
    const circle = reachLetterOf(group, place, 'Example node');
    expect(circle.subject).toBe('Ana messaged Nur · Guardians on Example node');
    expect(circle.html).toContain('A new group message for');
    expect(circle.html).toContain('Dear friend,</p>');
    expect(circle.html).toContain('With gratitude,<br>The O House</p>');
    expect(reachLetterOf({ type: 'reach', authorId: 'x' }, bare, 'n').subject).toBe('A Lifetree sent your Lifetree a direct message on n');
  });
});

describe("the keeper's knock", () => {
  it('reaches the anchor and the stewards, never the requester, six at most', () => {
    expect(knockRecipientsOf({ anchorUid: 'anchor', stewardUids: ['s1', 'anchor', 'asker', 's2'], requesterUid: 'asker' })).toEqual(['anchor', 's1', 's2']);
    expect(knockRecipientsOf({ anchorUid: null, stewardUids: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], requesterUid: 'x' })).toHaveLength(6);
  });
  it('says who asked to join where, dressed in the place, with the node as the door', () => {
    const letter = knockLetterOf({ requester: 'Nur', communityName: 'The O House', nodeName: 'Example node', nodeOrigin: 'https://node.example' }, place);
    expect(letter.subject).toBe('Nur asked to join The O House');
    expect(letter.text).toBe("Dear friend,\n\nNur asked to join The O House.\n\nYou can accept or decline on the community's Members tab.\n\nWith gratitude,\nThe O House\n\nhttps://node.example");
    expect(letter.html).toContain('>Open Example node</a>');
    expect(knockLetterOf({ requester: '', communityName: '', nodeName: 'n', nodeOrigin: 'https://n.x' }, bare).subject).toBe('Someone asked to join your community');
  });
});

describe('the welcome and the letter of a place', () => {
  it('welcomes by name on the node', () => {
    expect(welcomeLetterOf({ displayName: 'Ana', nodeName: 'Example node' })).toEqual({ subject: 'Welcome to Example node', text: 'Welcome to Example node, Ana. You have planted your intention. Now you may plant your tree.' });
    expect(welcomeLetterOf({ displayName: '', nodeName: 'n' }).text).toBe('Welcome to n. You have planted your intention. Now you may plant your tree.');
  });
  it('footers each letter with its own unsubscribe door and the one-click headers', () => {
    const url = unsubscribeUrlOf('https://node.example/', 'tok en');
    expect(url).toBe('https://node.example/u/tok%20en');
    const footer = newsletterFooterOf({ placeName: 'The <O> House', unsubscribeUrl: url }, place);
    expect(footer).toContain('subscribed to the letter of The &lt;O&gt; House.');
    expect(footer).toContain(`<a href="${url}" style="color:#7b9476;">Unsubscribe</a> · The O House · a garden</p>`);
    expect(newsletterHeadersOf(url)).toEqual({ 'List-Unsubscribe': `<${url}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' });
  });
});

describe("the courier's patience", () => {
  it('waits longer each time, an hour at most, and gives up after the last try', () => {
    expect(MAIL_DAILY_LIMIT).toBe(20); expect(MAIL_MAX_ATTEMPTS).toBe(5);
    expect([1, 2, 3, 4, 7].map(mailRetryDelayMs)).toEqual([60_000, 120_000, 240_000, 480_000, 3_600_000]);
    expect(mailSettlementOf({ attempts: 1, ok: true })).toEqual({ state: 'SUCCESS', nextInMs: null, error: null });
    expect(mailSettlementOf({ attempts: 1, ok: false, error: 'ECONNREFUSED' })).toEqual({ state: 'PENDING', nextInMs: 60_000, error: 'ECONNREFUSED' });
    expect(mailSettlementOf({ attempts: 5, ok: false })).toEqual({ state: 'ERROR', nextInMs: null, error: 'delivery_failed' });
    expect(mailSettlementOf({ attempts: 2, ok: false, error: 'x'.repeat(600) }).error).toHaveLength(500);
    expect(outboxIsStale(0, 24 * 3_600_000)).toBe(false); expect(outboxIsStale(0, 24 * 3_600_000 + 1)).toBe(true);
  });
});
