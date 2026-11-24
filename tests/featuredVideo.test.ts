import { describe, it, expect } from 'vitest';
import { FEATURED_VIDEOS_MAX, featuredVideoLinks, featuredVideoOf, featuredVideoProblem, featuredVideosOf } from '../src/domain/featuredVideo';
import { DOMAIN_KEYS } from '../src/domain/words';

const ID = 'dQw4w9WgXcQ';
const YT_EMBED = `https://www.youtube-nocookie.com/embed/${ID}?rel=0`;

describe('a featured video is read into a known house', () => {
  it('reads every shape a person pastes from YouTube into one player address', () => {
    for (const pasted of [
      `https://www.youtube.com/watch?v=${ID}`,
      `youtube.com/watch?v=${ID}&t=42s&list=PLx`,
      `https://m.youtube.com/watch?feature=share&v=${ID}`,
      `https://youtu.be/${ID}?si=abc`,
      `https://www.youtube.com/shorts/${ID}`,
      `https://www.youtube.com/live/${ID}/`,
      `https://www.youtube.com/embed/${ID}?autoplay=1`,
      `https://www.youtube-nocookie.com/embed/${ID}`,
      `  <https://youtu.be/${ID}>  `,
    ]) {
      expect(featuredVideoOf(pasted), pasted).toEqual({
        house: 'youtube', id: ID, embedUrl: YT_EMBED, watchUrl: `https://www.youtube.com/watch?v=${ID}`,
      });
    }
  });

  it('reads Vimeo, and carries an unlisted video\'s key', () => {
    expect(featuredVideoOf('https://vimeo.com/76979871')?.embedUrl).toBe('https://player.vimeo.com/video/76979871?dnt=1');
    expect(featuredVideoOf('vimeo.com/channels/staffpicks/76979871')?.id).toBe('76979871');
    expect(featuredVideoOf('https://vimeo.com/groups/name/videos/76979871')?.id).toBe('76979871');
    const unlisted = { house: 'vimeo', id: '76979871', embedUrl: 'https://player.vimeo.com/video/76979871?dnt=1&h=0a1b2c3d4e', watchUrl: 'https://vimeo.com/76979871/0a1b2c3d4e' };
    expect(featuredVideoOf('https://vimeo.com/76979871/0a1b2c3d4e')).toEqual(unlisted);
    expect(featuredVideoOf('https://player.vimeo.com/video/76979871?h=0a1b2c3d4e&badge=0')).toEqual(unlisted);
  });

  it('never lets the stored link choose the frame: only the id crosses', () => {
    // Extra parameters, fragments and paths are dropped — the address is rebuilt from the id.
    expect(featuredVideoOf(`https://www.youtube.com/embed/${ID}?autoplay=1&origin=https://evil.example#x`)?.embedUrl).toBe(YT_EMBED);
    // A Vimeo key that is not a key is dropped, never appended.
    expect(featuredVideoOf('https://player.vimeo.com/video/76979871?h=x%26autoplay%3D1')?.embedUrl).toBe('https://player.vimeo.com/video/76979871?dnt=1');
    for (const v of [featuredVideoOf(`https://youtu.be/${ID}`)!, featuredVideoOf('https://vimeo.com/76979871/0a1b2c3d4e')!]) {
      expect(['www.youtube-nocookie.com', 'player.vimeo.com']).toContain(new URL(v.embedUrl).hostname);
      expect(new URL(v.embedUrl).protocol).toBe('https:');
    }
  });

  it('refuses what is not a video of a known house', () => {
    for (const not of [
      '', '   ', null, undefined,
      'https://example.org/video.mp4',
      'https://www.youtube.com/',                               // the house, no video
      'https://www.youtube.com/@somechannel',
      'https://www.youtube.com/watch?v=short',                  // not an id's shape
      `https://www.youtube.com/watch?v=${ID}"><script>`,        // whitespace-free junk after the id
      `https://www.youtube.com/embed/${ID}/../../x`,
      `https://youtube.com.evil.example/watch?v=${ID}`,         // a look-alike is not the house
      `https://notyoutube.com/watch?v=${ID}`,
      `https://evil.example/?u=https://youtu.be/${ID}`,
      `javascript:alert('${ID}')`,
      'https://vimeo.com/staffpicks',
      'https://vimeo.com/76979871/not-a-key/more',
    ]) expect(featuredVideoOf(not), String(not)).toBeNull();
  });
});

describe('what a keeper can fix', () => {
  it('finds no fault in an empty field or a known video, and names the rest', () => {
    expect(featuredVideoProblem('')).toBeNull();
    expect(featuredVideoProblem('  ')).toBeNull();
    expect(featuredVideoProblem(undefined)).toBeNull();
    expect(featuredVideoProblem(`https://youtu.be/${ID}`)).toBeNull();
    expect(featuredVideoProblem('https://example.org/film')).toBe('video_not_known');
    expect(featuredVideoProblem('youtu')).toBe('video_not_known');
    expect(DOMAIN_KEYS).toContain('video_not_known');
  });
});

// Eleven-character ids of YouTube's own shape, each different.
const idOf = (n: number) => `video${String(n).padStart(6, '0')}`;

describe('a list of featured videos', () => {
  it('reads every link it can, in the keeper\'s order, and passes over the rest', () => {
    const list = featuredVideosOf([`https://youtu.be/${ID}`, 'https://example.org/film', '', 'https://vimeo.com/76979871']);
    expect(list.map(v => `${v.house}:${v.id}`)).toEqual([`youtube:${ID}`, 'vimeo:76979871']);
    expect(list[0].embedUrl).toBe(YT_EMBED);
  });

  it('shows one video once, however many ways it was pasted', () => {
    expect(featuredVideosOf([`https://youtu.be/${ID}`, `https://www.youtube.com/watch?v=${ID}&t=9s`, `https://www.youtube.com/shorts/${ID}`])).toHaveLength(1);
  });

  it('answers an empty list for anything that is not a list of links', () => {
    for (const not of [undefined, null, '', `https://youtu.be/${ID}`, 7, {}, { 0: `https://youtu.be/${ID}` }]) expect(featuredVideosOf(not), String(not)).toEqual([]);
    expect(featuredVideosOf([null, 7, {}, [`https://youtu.be/${ID}`]])).toEqual([]);
  });

  it('never shows more than the cap, and counts only what it can read', () => {
    const many = Array.from({ length: FEATURED_VIDEOS_MAX + 5 }, (_, n) => `https://youtu.be/${idOf(n)}`);
    expect(featuredVideosOf(many)).toHaveLength(FEATURED_VIDEOS_MAX);
    // Unreadable rows before the readable ones do not use the cap up.
    const strangers = Array.from({ length: FEATURED_VIDEOS_MAX }, () => 'https://example.org/film');
    expect(featuredVideosOf([...strangers, `https://youtu.be/${ID}`]).map(v => v.id)).toEqual([ID]);
  });
});

describe('what a hand stores from its rows', () => {
  it('trims each link, drops empty rows, keeps the order and the cap', () => {
    expect(featuredVideoLinks([`  https://youtu.be/${ID} `, '', '   ', 'https://vimeo.com/76979871'])).toEqual([`https://youtu.be/${ID}`, 'https://vimeo.com/76979871']);
    expect(featuredVideoLinks([])).toEqual([]);
    expect(featuredVideoLinks(Array.from({ length: FEATURED_VIDEOS_MAX + 3 }, (_, n) => `https://youtu.be/${idOf(n)}`))).toHaveLength(FEATURED_VIDEOS_MAX);
  });

  it('reads no rows out of what is not a list of text', () => {
    for (const not of [undefined, null, '', `https://youtu.be/${ID}`, 7, {}]) expect(featuredVideoLinks(not), String(not)).toEqual([]);
    expect(featuredVideoLinks([null, 7, {}, ` https://youtu.be/${ID}`])).toEqual([`https://youtu.be/${ID}`]);
  });

  it('keeps a link the law cannot read, so the editor can name it', () => {
    expect(featuredVideoLinks(['https://example.org/film'])).toEqual(['https://example.org/film']);
    expect(featuredVideosOf(featuredVideoLinks(['https://example.org/film']))).toEqual([]);
  });
});
