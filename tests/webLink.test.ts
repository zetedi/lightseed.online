import { describe, it, expect } from 'vitest';
import {
  normalizeWebLink, webLinkProblem, hostOf, normalizeHostname,
  linkTarget, linkLabel,
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
