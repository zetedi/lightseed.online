import { describe, it, expect } from 'vitest';
import { linkifyParts } from '../src/utils/sanitize';

// A reach may carry a door but never a trap: only http(s) becomes a link; every other scheme
// stays inert text, and the sentence keeps its punctuation.

describe('linkifyParts', () => {
  it('finds an http(s) link inside a sentence and keeps the text around it', () => {
    expect(linkifyParts('come see https://lightseed.online today')).toEqual([
      { type: 'text', value: 'come see ' },
      { type: 'link', value: 'https://lightseed.online' },
      { type: 'text', value: ' today' },
    ]);
  });

  it('peels trailing sentence punctuation off the address', () => {
    expect(linkifyParts('read this: https://x.org/a, then reply.')).toEqual([
      { type: 'text', value: 'read this: ' },
      { type: 'link', value: 'https://x.org/a' },
      { type: 'text', value: ', then reply.' },
    ]);
  });

  it('a javascript: or data: "URL" is never a link — a door, not a trap', () => {
    expect(linkifyParts('javascript:alert(1)')).toEqual([{ type: 'text', value: 'javascript:alert(1)' }]);
    expect(linkifyParts('data:text/html,<b>x</b>')).toEqual([{ type: 'text', value: 'data:text/html,<b>x</b>' }]);
  });

  it('plain text passes through whole, and empty stays empty-shaped', () => {
    expect(linkifyParts('no links here')).toEqual([{ type: 'text', value: 'no links here' }]);
    expect(linkifyParts('')).toEqual([{ type: 'text', value: '' }]);
  });

  it('several links in one breath each become their own door', () => {
    const parts = linkifyParts('https://a.org and http://b.org');
    expect(parts.filter(p => p.type === 'link').map(p => p.value)).toEqual(['https://a.org', 'http://b.org']);
  });
});
