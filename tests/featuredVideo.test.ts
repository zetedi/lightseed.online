import { describe, it, expect } from 'vitest';
import { featuredVideoOf, featuredVideoProblem } from '../src/domain/featuredVideo';
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
