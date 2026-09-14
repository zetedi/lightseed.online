import { describe, it, expect } from 'vitest';
import {
  MAIL_LINE_MAX, SHELL_MAIL_INK, SHELL_MAIL_PAPER, SHELL_MAIL_PRIMARY,
  contrastOf, dressMailText, mailLine, mailVoiceOf, mailWordsOf,
} from '../src/domain/mailVoice';
import * as mirror from '../functions/src/mailVoice';

const node = { name: 'lightseed', origin: 'https://lightseed.online', postal: 'The O House, Bigeh Island, Aswan, Egypt' };
const nations = {
  name: 'Enlightened Nations', domain: 'seed.enlightenednations.org',
  theme: { primary: '#7B9476', text: '#504243', background: '#FEF8F3', mode: 'light' },
  mail: { greeting: 'Dear friend of the Nations,', signature: 'With gratitude,\nThe Enlightened Nations circle', footer: 'Enlightened Nations · a garden on the seed' },
};

describe('the voice of a letter', () => {
  it('the node speaks bare: its name, origin, postal line, the shell palette, no greeting', () => {
    expect(mailVoiceOf(null, node)).toEqual({
      name: 'lightseed', origin: 'https://lightseed.online', primary: SHELL_MAIL_PRIMARY,
      ink: SHELL_MAIL_INK, paper: SHELL_MAIL_PAPER, greeting: '', signature: '', footer: node.postal,
    });
  });
  it('a place lends its name, door, palette and words', () => {
    const v = mailVoiceOf(nations, node);
    expect(v.name).toBe('Enlightened Nations');
    expect(v.origin).toBe('https://seed.enlightenednations.org');
    expect(v.primary).toBe('#7b9476');
    expect(v.ink).toBe('#504243');
    expect(v.paper).toBe('#fef8f3');
    expect(v.greeting).toBe('Dear friend of the Nations,');
    expect(v.signature).toBe('With gratitude,\nThe Enlightened Nations circle');
    expect(v.footer).toBe('Enlightened Nations · a garden on the seed');
  });
  it('ink and paper are taken together, and only when they read', () => {
    const faint = mailVoiceOf({ ...nations, theme: { ...nations.theme, text: '#e9dcc3' } }, node);
    expect([faint.ink, faint.paper]).toEqual([SHELL_MAIL_INK, SHELL_MAIL_PAPER]);
    expect(contrastOf('#504243', '#fef8f3')).toBeGreaterThan(3);
    expect(contrastOf('#e9dcc3', '#fef8f3')).toBeLessThan(3);
  });
  it('a dark-authored theme lends nothing to paper: mail is read on white', () => {
    const v = mailVoiceOf({ ...nations, theme: { ...nations.theme, mode: 'dark' } }, node);
    expect([v.ink, v.paper]).toEqual([SHELL_MAIL_INK, SHELL_MAIL_PAPER]);
    expect(v.primary).toBe('#7b9476');
  });
  it('a bad colour, a bad door, an empty name fall back', () => {
    const v = mailVoiceOf({ name: '  ', domain: 'not a door', theme: { primary: 'green', text: '#123', background: '#fff' } }, node);
    expect(v.name).toBe('lightseed');
    expect(v.origin).toBe(node.origin);
    expect(v.primary).toBe(SHELL_MAIL_PRIMARY);
  });
  it('a line carries no control characters, one breath of whitespace, at most the max', () => {
    expect(mailLine('Dear  friend,\t\tof   the\r\n  Nations  ')).toBe('Dear friend, of the\nNations');
    expect(mailLine('a\n\n\n\nb')).toBe('a\n\nb');
    expect(mailLine('x'.repeat(MAIL_LINE_MAX + 50)).length).toBe(MAIL_LINE_MAX);
    expect(mailLine('bell\u0007 rings')).toBe('bell rings');
    expect(mailLine(42)).toBe('');
  });
  it('stored words are cleaned and empty ones dropped', () => {
    expect(mailWordsOf({ greeting: '  Hello ', signature: '', footer: null })).toEqual({ greeting: 'Hello' });
    expect(mailWordsOf(null)).toEqual({});
  });
  it('the words are dressed only where the place wrote them', () => {
    expect(dressMailText('You were asked to guard a tree.', { greeting: 'Dear friend,', signature: 'The circle' })).toBe('Dear friend,\n\nYou were asked to guard a tree.\n\nThe circle');
    expect(dressMailText('  Bare.  ', { greeting: '', signature: '' })).toBe('Bare.');
  });
  it('the functions mirror answers as the domain does', () => {
    for (const src of [null, nations, { ...nations, theme: { ...nations.theme, mode: 'dark' } }, { name: 'x', domain: 'WWW.Example.ORG', mail: { greeting: 'a\n\n\n\nb' } }]) {
      expect(mirror.mailVoiceOf(src, node)).toEqual(mailVoiceOf(src, node));
    }
    expect(mirror.MAIL_LINE_MAX).toBe(MAIL_LINE_MAX);
    expect(mirror.dressMailText('t', { greeting: 'g', signature: 's' })).toBe(dressMailText('t', { greeting: 'g', signature: 's' }));
  });
});
