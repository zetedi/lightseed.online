import { describe, it, expect } from 'vitest';
import { eventsOwnPlace } from '../src/domain/eventFace';

const nations = { id: 'en', domain: 'seed.enlightenednations.org' };
const seed = { id: 'ls', domain: 'lightseed.online' };

describe('the face an event wears', () => {
  it('an event born in a community wears that community, whatever door the viewer stands at', () => {
    expect(eventsOwnPlace({ communityId: 'en', domain: 'lightseed.online' }, nations)).toBe(true);
    expect(eventsOwnPlace({ communityId: 'en' }, seed)).toBe(false);
  });
  it('an event with only a domain stamp wears the community rooted there', () => {
    expect(eventsOwnPlace({ domain: 'seed.enlightenednations.org' }, nations)).toBe(true);
    expect(eventsOwnPlace({ domain: 'WWW.Seed.EnlightenedNations.org' }, nations)).toBe(true);
    expect(eventsOwnPlace({ domain: 'seed.enlightenednations.org' }, seed)).toBe(false);
  });
  it('an event with no place at all wears the hint; no hint is no face', () => {
    expect(eventsOwnPlace({}, seed)).toBe(true);
    expect(eventsOwnPlace({ domain: 'x.org' }, null)).toBe(false);
  });
});
