import { describe, expect, it } from 'vitest';
import {
  canonicalHostOf, cardDescriptionOf, faceSourceOf, isPublicAddress, isPublicBeing, lidOfDoor, publicCardOf,
  shareCardOf, shellCardOf, sitemapXmlOf, SITEMAP_MAX_BEINGS,
} from '../src/domain/facePage';
import { beingPath } from '../src/domain/beingLink';
import { facePreviewDigestOf } from '../src/domain/facePreview';

// THE FACE OF THE NODE: what a stranger or a crawler is told. These tests hold the gate (the
// origin's card gate, per kind), the host that may enter a URL, the picture a face may fetch,
// the head-meta swap at the boundary and the sitemap's shape.

const LID = '019f57e8-878a-75ff-be0e-7d3913b4b2f3';
const SHELL = `<!DOCTYPE html><html><head><title>.seed — Lightseed, life recognising life</title>
    <meta name="description" content="A living commons." />
    <link rel="canonical" href="https://lightseed.online/" />
    <meta property="og:site_name" content="Lightseed" />
    <meta property="og:title" content="Lightseed — life recognising life" />
    <meta property="og:description" content="A living commons." />
    <meta property="og:url" content="https://lightseed.online" />
    <meta property="og:image" content="https://lightseed.online/og.png" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Lightseed — life recognising life" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Lightseed" />
    <meta name="twitter:description" content="A living commons." />
    <meta name="twitter:image" content="https://lightseed.online/og.png" />
</head><body></body></html>`;

describe('the door', () => {
  it('names the canonical lid from either shape, and nothing from anything else', () => {
    expect(lidOfDoor(LID)).toBe(LID);
    expect(lidOfDoor(beingPath(LID).slice(3))).toBe(LID);
    expect(lidOfDoor('short')).toBeNull();
    expect(lidOfDoor('../../etc/passwd')).toBeNull();
    expect(lidOfDoor('zzzzzzzzzzzzzzzzzzzzzz')).toBeNull();
  });
});

describe('the gate', () => {
  it('admits exactly what the origin card admits, per kind', () => {
    expect(isPublicBeing('tree', { visibility: 'public' })).toBe(true);
    expect(isPublicBeing('tree', {})).toBe(true); // legacy absence
    expect(isPublicBeing('tree', { treeType: 'BED' })).toBe(false); // a bed's absent default is node
    expect(isPublicBeing('tree', { treeType: 'BED', visibility: 'public' })).toBe(true);
    for (const v of ['node', 'private', 'community', 'circle', '', 7, { x: 1 }]) expect(isPublicBeing('tree', { visibility: v })).toBe(false);
    expect(isPublicBeing('house', { visibility: 'public' })).toBe(true);
    expect(isPublicBeing('house', {})).toBe(false); // absent = community
    expect(isPublicBeing('house', { visibility: 'node' })).toBe(false);
    expect(isPublicBeing('vision', {})).toBe(true);
    expect(isPublicBeing('vision', { visibility: 'node' })).toBe(false);
    expect(isPublicBeing('pulse', { type: 'event' })).toBe(true);
    expect(isPublicBeing('pulse', { type: 'event', visibility: 'public' })).toBe(true);
    expect(isPublicBeing('pulse', { type: 'event', visibility: 'community' })).toBe(false);
    // An addressed reach never — whatever cloak it wears or lacks.
    expect(isPublicBeing('pulse', { type: 'reach', recipientUid: 'bob' })).toBe(false);
    expect(isPublicBeing('pulse', { type: 'reach', visibility: 'public', participantUids: ['a', 'b'] })).toBe(false);
    expect(isPublicBeing('pulse', null)).toBe(false);
  });
  it('shapes the card the origin shapes', () => {
    expect(publicCardOf('tree', { name: 'Nur', body: 'b', imageUrl: 'i', latestGrowthUrl: 'g', domain: 'x.y', visibility: 'public' }))
      .toEqual({ name: 'Nur', body: 'b', image: 'g', domain: 'x.y' });
    expect(publicCardOf('tree', { name: 'Nur', imageUrl: 'i' })).toEqual({ name: 'Nur', body: '', image: 'i', domain: '' });
    expect(publicCardOf('house', { name: 'H', body: 'b', imageUrl: 'i', domain: 'x.y', visibility: 'public', latitude: 50.8, longitude: 4.3 }))
      .toEqual({ name: 'H', body: 'b', image: 'i', domain: 'x.y', place: { latitude: 50.8, longitude: 4.3 } });
    expect(publicCardOf('house', { name: 'H', visibility: 'public', latitude: '50' })?.place).toEqual({ latitude: undefined, longitude: undefined });
    expect(publicCardOf('vision', { title: 'V', body: 'b' })).toEqual({ name: 'V', body: 'b', image: undefined, domain: '' });
    expect(publicCardOf('pulse', { title: 'E', content: 'c', imageUrls: ['', 'u1', 'u2'], imageUrl: 'u0' })).toEqual({ name: 'E', body: 'c', image: 'u1', domain: '' });
    expect(publicCardOf('pulse', { title: 'E', body: 'b', imageUrl: 'u0' })).toEqual({ name: 'E', body: 'b', image: 'u0', domain: '' });
    expect(publicCardOf('tree', { name: 'Hidden', visibility: 'private' })).toBeNull();
  });
});

describe('the host', () => {
  const hosts = ['node.example', 'door.example'];
  it('admits only a host the node serves, keeps its port, and collapses the rest to the node', () => {
    expect(canonicalHostOf('node.example', hosts, 'node.example')).toBe('node.example');
    expect(canonicalHostOf('WWW.Door.Example', hosts, 'node.example')).toBe('door.example');
    expect(canonicalHostOf('seed.localhost:8443', ['seed.localhost'], 'seed.localhost')).toBe('seed.localhost:8443');
    expect(canonicalHostOf('door.example, evil.example', hosts, 'node.example')).toBe('door.example');
    expect(canonicalHostOf('evil.example', hosts, 'node.example')).toBe('node.example');
    expect(canonicalHostOf('node.example/x', hosts, 'node.example')).toBe('node.example');
    expect(canonicalHostOf('node.example"><script>', hosts, 'node.example')).toBe('node.example');
    expect(canonicalHostOf(undefined, hosts, 'node.example')).toBe('node.example');
    expect(canonicalHostOf('10.0.0.1', hosts, 'node.example')).toBe('node.example');
  });
});

describe('the picture a face may fetch', () => {
  it("names the node's own media by path and a foreign picture by https alone", () => {
    expect(faceSourceOf('/v1/media?path=users%2Falice%2Ftree%2F1.webp')).toEqual({ kind: 'local', path: 'users/alice/tree/1.webp' });
    expect(faceSourceOf('/v1/media?path=users%2Falice%2Ftree%2F1.webp&variant=large')).toEqual({ kind: 'local', path: 'users/alice/tree/1.webp' });
    expect(faceSourceOf('https://node.example/v1/media?path=users%2Fa%2F1.webp', ['node.example'])).toEqual({ kind: 'local', path: 'users/a/1.webp' });
    expect(faceSourceOf('https://other.example/v1/media?path=users%2Fa%2F1.webp', ['node.example'])).toEqual({ kind: 'remote', url: 'https://other.example/v1/media?path=users%2Fa%2F1.webp' });
    expect(faceSourceOf('/v1/media?path=..%2Fsecret')).toBeNull();
    expect(faceSourceOf('/v1/media?path=')).toBeNull();
    expect(faceSourceOf('/v1/media')).toBeNull();
    expect(faceSourceOf('/og.png')).toBeNull();
    expect(faceSourceOf('https://firebasestorage.googleapis.com/v0/b/x/o/p?alt=media')).toEqual({ kind: 'remote', url: 'https://firebasestorage.googleapis.com/v0/b/x/o/p?alt=media' });
    expect(faceSourceOf('http://pictures.example/p.jpg')).toBeNull();
    expect(faceSourceOf('https://user:pw@pictures.example/p.jpg')).toBeNull();
    expect(faceSourceOf('data:image/png;base64,AAAA')).toBeNull();
    expect(faceSourceOf('blob:https://x/y')).toBeNull();
    expect(faceSourceOf('javascript:alert(1)')).toBeNull();
    expect(faceSourceOf(undefined)).toBeNull();
    expect(faceSourceOf('')).toBeNull();
  });
  it('refuses every address in the node\'s own neighbourhood', () => {
    for (const ip of ['127.0.0.1', '127.9.9.9', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0',
      '224.0.0.1', '255.255.255.255', '192.0.0.1', '198.18.0.1', '::1', '::', 'fc00::1', 'fd12::1', 'fe80::1', 'ff02::1', '::ffff:10.0.0.1', '::ffff:127.0.0.1',
      '2002:c0a8:101::1', '64:ff9b::a00:1', '2001:db8::1', 'not-an-address', '', '1.2.3']) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
    for (const ip of ['8.8.8.8', '142.250.1.1', '172.32.0.1', '172.15.0.1', '100.128.0.1', '2a00:1450:4001::1', '2606:4700::1', '::ffff:8.8.8.8']) {
      expect(isPublicAddress(ip), ip).toBe(true);
    }
  });
});

describe('the card', () => {
  const being = { name: 'Nur <3', body: '  A tree\n\nof   light "here" $& ' + 'x'.repeat(200), image: '/v1/media?path=users%2Fa%2F1.webp', domain: 'theohouse.org' };
  it('names the place, shortens the words, points the picture at the face preview', () => {
    const { card, placeLd } = shareCardOf({ host: 'node.example', door: 'DOOR12345', being, place: { name: 'The O House', domain: 'theohouse.org' }, nodeName: 'Example node' });
    expect(card.title).toBe('Nur <3 — The O House');
    expect(card.siteName).toBe('The O House');
    expect(card.description.length).toBe(160);
    expect(card.description.startsWith('A tree of light "here" $& ')).toBe(true);
    expect(card.image).toBe(`https://node.example/face/DOOR12345.jpg?v=${facePreviewDigestOf(being.image)}`);
    expect(card.url).toBe('https://node.example/b/DOOR12345');
    expect(card.card).toBe('summary');
    expect(placeLd).toBeUndefined();
  });
  it('falls back to the node and its og.png, and makes a Place for a Light House', () => {
    const { card, placeLd } = shareCardOf({ host: 'node.example', door: 'D', being: { name: 'Hearth', body: '', image: 'http://plain.example/x.jpg', place: { latitude: 50.8, longitude: 4.3 } }, place: null, nodeName: 'Example node' });
    expect(card.title).toBe('Hearth — Example node');
    expect(card.description).toBe('Hearth — a living being on Example node.');
    expect(card.image).toBe('https://node.example/og.png');
    expect(placeLd).toEqual({ '@context': 'https://schema.org', '@type': 'Place', name: 'Hearth', description: card.description, url: 'https://node.example/b/D', geo: { '@type': 'GeoCoordinates', latitude: 50.8, longitude: 4.3 } });
    expect(shareCardOf({ host: 'h', door: 'D', being: { name: 'H', body: '', place: {} }, place: null, nodeName: 'n' }).placeLd).not.toHaveProperty('geo');
    expect(cardDescriptionOf('', 'X', 'P')).toBe('X — a living being on P.');
  });
});

describe('the shell', () => {
  it('swaps exactly the head meta, escaped once, and never expands user content', () => {
    const out = shellCardOf(SHELL, { title: 'Nur <3 & "friends"', siteName: "O'House", description: 'said $& </script>', image: 'https://node.example/face/D.jpg?v=1', url: 'https://node.example/b/D', card: 'summary' });
    expect(out).toContain('<title>Nur &lt;3 &amp; &quot;friends&quot;</title>');
    expect(out).toContain('<meta name="description" content="said $&amp; &lt;/script&gt;" />');
    expect(out).toContain('<link rel="canonical" href="https://node.example/b/D" />');
    expect(out).toContain('<meta property="og:site_name" content="O&#39;House" />');
    expect(out).toContain('<meta property="og:title" content="Nur &lt;3 &amp; &quot;friends&quot;" />');
    expect(out).toContain('<meta property="og:url" content="https://node.example/b/D" />');
    expect(out).toContain('<meta property="og:image" content="https://node.example/face/D.jpg?v=1" />');
    expect(out).toContain('<meta property="og:image:alt" content="Nur &lt;3 &amp; &quot;friends&quot;" />');
    expect(out).toContain('<meta name="twitter:card" content="summary" />');
    expect(out).toContain('<meta name="twitter:image" content="https://node.example/face/D.jpg?v=1" />');
    expect(out).not.toContain('og:image:width');
    expect(out).not.toContain('og:image:type');
    expect(out).not.toContain('<script>');
    expect(out).not.toContain('Lightseed — life');
  });
  it('keeps the og.png dimensions and writes a Place as JSON-LD that cannot break out', () => {
    const out = shellCardOf(SHELL, { title: 'T', description: 'd', image: 'https://node.example/og.png', url: 'https://node.example/b/D' }, { '@type': 'Place', name: '</script><script>alert(1)</script>' });
    expect(out).toContain('og:image:width');
    expect(out).toContain('<script type="application/ld+json">{"@type":"Place","name":"\\u003c/script>\\u003cscript>alert(1)\\u003c/script>"}</script>\n</head>');
    expect(out).not.toContain('<meta name="twitter:card" content="summary" />');
  });
});

describe('the sitemap', () => {
  it('lists home and every being newest first, dated, escaped and capped', () => {
    const xml = sitemapXmlOf('node.example', [{ lid: 'a&b', ms: 0 }, { lid: 'new', ms: Date.UTC(2026, 10, 3) }, { lid: 'old', ms: Date.UTC(2026, 0, 1) }]);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>https://node.example/</loc>')).toBe(true);
    expect(xml.indexOf('/b/new')).toBeLessThan(xml.indexOf('/b/old'));
    expect(xml.indexOf('/b/old')).toBeLessThan(xml.indexOf('/b/a&amp;b'));
    expect(xml).toContain('<loc>https://node.example/b/new</loc>\n    <lastmod>2026-11-03</lastmod>');
    expect(xml).not.toContain('<lastmod>1970');
    const many = sitemapXmlOf('h', Array.from({ length: SITEMAP_MAX_BEINGS + 5 }, (_, i) => ({ lid: `l${i}`, ms: i })));
    expect((many.match(/<url>/g) ?? []).length).toBe(SITEMAP_MAX_BEINGS + 1);
    expect(many).not.toContain('/b/l0<');
  });
});
