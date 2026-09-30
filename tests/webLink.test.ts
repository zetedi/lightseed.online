import { describe, it, expect } from 'vitest';
import {
  normalizeWebLink, webLinkProblem, hostOf, normalizeHostname,
  linkTarget, linkLabel, webLinksOf, isWebLinkList, MAX_WEB_LINKS, MAX_WEB_LINK_LABEL,
} from '../src/domain/webLink';
import { DOMAIN_KEYS } from '../src/domain/words';

// A DOOR TO SOMEWHERE ELSE (ring 2026-09-11).
describe('normalizeWebLink — what a person typed, made followable', () => {
  it('a bare host gains the scheme every browser assumes', () => {
    expect(normalizeWebLink('example.org')).toBe('https://example.org/');
    expect(normalizeWebLink('  example.org  ')).toBe('https://example.org/');
    expect(normalizeWebLink('//example.org')).toBe('https://example.org/');
    expect(normalizeWebLink('example.org/a/path?q=1')).toBe('https://example.org/a/path?q=1');
  });
  it('keeps a scheme that was written, and folds the host to lower case', () => {
    expect(normalizeWebLink('http://Example.ORG/x')).toBe('http://example.org/x');
    expect(normalizeWebLink('HTTPS://example.org')).toBe('https://example.org/');
  });
  it('never lets a scheme that is not the web through', () => {
    expect(normalizeWebLink('javascript:alert(1)')).toBeNull();
    expect(normalizeWebLink('data:text/html,<b>x</b>')).toBeNull();
    expect(normalizeWebLink('mailto:someone@example.org')).toBeNull();
    expect(normalizeWebLink('ftp://example.org')).toBeNull();
  });
  it('refuses what is not an address at all', () => {
    expect(normalizeWebLink('')).toBeNull();
    expect(normalizeWebLink(null)).toBeNull();
    expect(normalizeWebLink('not a domain')).toBeNull();     // spaces
    expect(normalizeWebLink('localhostish')).toBeNull();     // no dot
    expect(normalizeWebLink('https://user:pass@example.org')).toBeNull();
  });
});

describe('webLinkProblem — what a person can fix', () => {
  it('an empty field is not a fault: a link is optional', () => {
    expect(webLinkProblem('')).toBeNull();
    expect(webLinkProblem(undefined)).toBeNull();
  });
  it('names the two faults, in keys the table knows', () => {
    expect(webLinkProblem('javascript:alert(1)')).toBe('link_not_web');
    expect(webLinkProblem('not a domain')).toBe('link_not_valid');
    expect(webLinkProblem('example.org')).toBeNull();
  });
  it('every key it can answer is in the manifest', () => {
    for (const key of ['link_not_web', 'link_not_valid'] as const) {
      expect(DOMAIN_KEYS).toContain(key);
    }
  });
});

describe('hostOf / normalizeHostname — the bare name behind a door', () => {
  it('reads a host whether the value is bare or absolute', () => {
    expect(hostOf('example.org')).toBe('example.org');
    expect(hostOf('https://seed.example.org/a')).toBe('seed.example.org');
    expect(normalizeHostname('HTTPS://Example.org/deep/path')).toBe('example.org');
    expect(hostOf('javascript:alert(1)')).toBeNull();
  });
});

describe('linkTarget — where a door opens', () => {
  it('another house: a new tab, with the opener sealed', () => {
    expect(linkTarget('example.org', 'lightseed.online')).toEqual({
      href: 'https://example.org/', target: '_blank', rel: 'noopener noreferrer',
    });
  });
  it('this same house: the same tab — leaving your own house by a new window is not travel', () => {
    expect(linkTarget('https://lightseed.online/about', 'lightseed.online')).toEqual({
      href: 'https://lightseed.online/about',
    });
    // www is a coat, not a name
    expect(linkTarget('https://www.lightseed.online/x', 'lightseed.online')?.target).toBeUndefined();
  });
  it('a link that is no link renders nothing at all', () => {
    expect(linkTarget('javascript:alert(1)', 'lightseed.online')).toBeNull();
    expect(linkTarget('', 'lightseed.online')).toBeNull();
  });
  it('with no host known, every door is outward', () => {
    expect(linkTarget('example.org', '')?.target).toBe('_blank');
  });
});

describe('linkLabel — the name a reader sees', () => {
  it('shows the address without the scheme noise', () => {
    expect(linkLabel('https://example.org/')).toBe('example.org');
    expect(linkLabel('example.org/path')).toBe('example.org/path');
  });
  it('shows back what was typed when it is not a link, so nothing vanishes silently', () => {
    expect(linkLabel('not a domain')).toBe('not a domain');
  });
});

// THE DOORS A RECORD CARRIES OUTWARD (ring 2026-09-30).
describe('webLinksOf — a typed list, sanitized', () => {
  it('normalizes each address, trims labels, drops empty rows, keeps order', () => {
    const { links, problem } = webLinksOf([
      { url: ' blog.example.org ', label: '  the blog ' },
      { url: '', label: 'nothing here' },
      { url: 'https://drive.example.org/x', label: '' },
    ]);
    expect(problem).toBeNull();
    expect(links).toEqual([{ url: 'https://blog.example.org/', label: 'the blog' }, { url: 'https://drive.example.org/x' }]);
  });
  it('names the first fault a person can fix', () => {
    expect(webLinksOf([{ url: 'javascript:alert(1)', label: '' }]).problem).toBe('link_not_web');
    expect(webLinksOf([{ url: 'not a domain', label: '' }]).problem).toBe('link_not_valid');
    expect(webLinksOf(Array.from({ length: MAX_WEB_LINKS + 1 }, () => ({ url: 'example.org', label: '' }))).problem).toBe('links_too_many');
  });
  it('what is not a list at all is simply no doors', () => {
    expect(webLinksOf('example.org')).toEqual({ links: [], problem: null });
    expect(webLinksOf(undefined)).toEqual({ links: [], problem: null });
  });
  it('a label longer than the law is cut, not refused', () => {
    const { links } = webLinksOf([{ url: 'example.org', label: 'x'.repeat(MAX_WEB_LINK_LABEL + 20) }]);
    expect(links[0].label).toHaveLength(MAX_WEB_LINK_LABEL);
  });
  it('every refusal it can speak is a word the dictionary carries', () => {
    for (const k of ['link_not_web', 'link_not_valid', 'links_too_many']) expect(DOMAIN_KEYS as readonly string[]).toContain(k);
  });
});

describe('isWebLinkList — what a stored list must look like (the seal and the server judge by it)', () => {
  it('accepts what webLinksOf produces, and nothing looser', () => {
    const { links } = webLinksOf([{ url: 'blog.example.org', label: 'the blog' }, { url: 'https://drive.example.org/x', label: '' }]);
    expect(isWebLinkList(links)).toBe(true);
    expect(isWebLinkList([])).toBe(true);
    expect(isWebLinkList(undefined)).toBe(false);
    expect(isWebLinkList('https://example.org')).toBe(false);
    expect(isWebLinkList([{ url: 'blog.example.org' }])).toBe(false);            // not normalized
    expect(isWebLinkList([{ url: 'javascript:alert(1)' }])).toBe(false);
    expect(isWebLinkList([{ url: 'https://example.org/', label: '' }])).toBe(false);
    expect(isWebLinkList([{ url: 'https://example.org/', label: 'x'.repeat(MAX_WEB_LINK_LABEL + 1) }])).toBe(false);
    expect(isWebLinkList([{ url: 'https://example.org/', extra: 1 }])).toBe(false);
    expect(isWebLinkList(Array.from({ length: MAX_WEB_LINKS + 1 }, () => ({ url: 'https://example.org/' })))).toBe(false);
  });
});

// The server cannot import src/domain; its copy of the door law must answer as this one does.
describe('the functions mirror of the door law stays true', () => {
  it('normalizes and judges identically', async () => {
    const server = await import('../functions/src/birth');
    const inputs = ['example.org', '  Example.ORG/a?b=1 ', '//example.org', 'http://Example.ORG/x', 'javascript:alert(1)', 'data:text/html,x',
      'mailto:a@b.org', 'ftp://example.org', 'not a domain', 'localhostish', 'https://user:pw@example.org/', '<https://example.org>', '', 'x'.repeat(300) + '.org'];
    for (const i of inputs) expect(server.normalizeWebLink(i)).toBe(normalizeWebLink(i));
    const lists: unknown[] = [[{ url: 'https://example.org/', label: 'a' }], [{ url: 'example.org' }], [{ url: 'https://example.org/', extra: 1 }], 'x', [], [{ url: 'https://example.org/', label: '' }]];
    for (const l of lists) expect(server.isWebLinkList(l)).toBe(isWebLinkList(l));
    expect(server.MAX_WEB_LINKS).toBe(MAX_WEB_LINKS);
    expect(server.MAX_WEB_LINK_LABEL).toBe(MAX_WEB_LINK_LABEL);
  });
});
