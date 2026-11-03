import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  charterProblem, charterHosts, charterOrigin, charterOwnDomains, charterAuthHosts, charterFaceDoor, charterPublicOf, firebasercOf, hostingOf, mailFromOf,
  shellVarsOf, shellStructuredDataOf, webManifestOf, robotsTxtOf, shellOriginProblem,
  type Charter, type IndependentCharter,
} from '../src/domain/charter';
import { independentCharterProblem } from '../src/domain/independentCharter';
import {
  charterProblem as sCharterProblem, charterHosts as sCharterHosts, charterOrigin as sCharterOrigin,
  charterOwnDomains as sCharterOwnDomains, charterAuthHosts as sCharterAuthHosts, charterFaceDoor as sCharterFaceDoor, charterPublicOf as sCharterPublicOf,
  mailFromOf as sMailFromOf,
} from '../functions/src/charter';
import { speak } from '../src/utils/translations';

// THE CHARTER. One file says what a node is; the law derives everything else, the server
// mirrors the law, and the sync writes the files that must agree. These tests hold all three.

// The charter the checkout is synced to: NODE_CHARTER, else the origin's node.json.
const node = JSON.parse(readFileSync(new URL(`../${process.env.NODE_CHARTER || 'node.json'}`, import.meta.url), 'utf8')) as Charter;
const sound = (): Charter => JSON.parse(JSON.stringify(node));
const broken = (f: (c: Charter) => void) => { const c = sound(); f(c); return c; };

describe('charterProblem — what a sound charter is', () => {
  it('this node\'s own charter is sound', () => {
    expect(charterProblem(node)).toBeNull();
  });

  it('refuses each unsound thing by name', () => {
    expect(speak(charterProblem(broken(c => { (c as any).version = 2; }))!)).toMatch(/version/i);
    expect(speak(charterProblem(broken(c => { c.nodeLid = 'not-a-lid'; }))!)).toMatch(/true name/i);
    expect(speak(charterProblem(broken(c => { c.name = ' '; }))!)).toMatch(/name/i);
    expect(speak(charterProblem(broken(c => { c.domain = 'not a domain'; }))!)).toMatch(/domain/i);
    expect(speak(charterProblem(broken(c => { c.aliases = ['ok.online', 'bad_alias']; }))!)).toMatch(/domain/i);
    expect(speak(charterProblem(broken(c => { c.faces = []; }))!)).toMatch(/faces/i);
    expect(speak(charterProblem(broken(c => { c.faces[0].target = 'Bad Target'; }))!)).toMatch(/face/i);
    expect(speak(charterProblem(broken(c => { c.faces[1].site = c.faces[0].site; }))!)).toMatch(/face/i);
    expect(speak(charterProblem(broken(c => { c.faces[1].door = 'nope'; }))!)).toMatch(/face/i);
    expect(speak(charterProblem(broken(c => { c.firebase.projectId = 'P'; }))!)).toMatch(/project/i);
    expect(speak(charterProblem(broken(c => { c.firebase.web.apiKey = ''; }))!)).toMatch(/project/i);
    expect(speak(charterProblem(broken(c => { c.keeper.email = 'nobody'; }))!)).toMatch(/keeper/i);
    expect(speak(charterProblem(broken(c => { c.push.publicKey = 'short'; }))!)).toMatch(/push/i);
  });

  it('a node without push yet is still sound', () => {
    expect(charterProblem(broken(c => { c.push.publicKey = ''; }))).toBeNull();
  });
});

describe('what the charter derives', () => {
  it('answers at exactly the hosts the seed answered at by heart before the charter', () => {
    if (node.firebase.projectId !== 'lifeseed-75dfe') return; // the origin's list; another node has its own
    expect(charterHosts(node)).toEqual([
      'enlightenednations.web.app', 'lifeseed-75dfe.firebaseapp.com', 'lifeseed-75dfe.web.app', 'lifeseed.online',
      'lightseed.online', 'mamaway.web.app', 'perauset.com', 'perauset.web.app', 'seed.enlightenednations.org', 'seed.perauset.org', 'seed.theohouse.org', 'theohouse.org',
      'theohouse.web.app',
    ]);
  });

  it('names the hosts that may be their own auth domain: its own, plus the faces the charter declares wired (ring 2026-09-16)', () => {
    expect(charterAuthHosts(node)).toEqual([...new Set([...charterOwnDomains(node), ...(node.authHosts ?? [])])].sort());
    expect(charterAuthHosts({ ...node, authHosts: undefined })).toEqual([...charterOwnDomains(node)].sort());
    expect(charterProblem({ ...node, authHosts: ['seed.perauset.org'] })).toBe(null);
    expect(charterProblem({ ...node, authHosts: ['perauset.org'] })).toBe('charter_auth_host'); // answers nowhere on this node
    expect(charterProblem({ ...node, authHosts: ['not a host'] })).toBe('charter_auth_host');
  });

  it('speaks from its own origin, knows its own domains and each face\'s door', () => {
    if (node.firebase.projectId !== 'lifeseed-75dfe') return;
    expect(charterOrigin(node)).toBe('https://lightseed.online');
    expect(charterOwnDomains(node)).toEqual(['lightseed.online', 'lifeseed.online']);
    expect(charterFaceDoor(node, 'theohouse')).toBe('seed.theohouse.org');
    expect(charterFaceDoor(node, 'nowhere')).toBe(null);
  });

  it('tells a stranger only what a stranger may know', () => {
    const pub = charterPublicOf(node) as Record<string, unknown>;
    expect(pub).toMatchObject({ nodeLid: node.nodeLid, domain: node.domain, push: { publicKey: node.push.publicKey } });
    expect(JSON.stringify(pub)).not.toContain(node.keeper.email);
    expect(JSON.stringify(pub)).not.toContain(node.firebase.web.apiKey);
    expect('firebase' in pub).toBe(false);
  });

  it('implies the hosting targets and one hosting entry per face', () => {
    if (node.firebase.projectId !== 'lifeseed-75dfe') return;
    expect(firebasercOf(node)).toEqual({
      projects: { default: 'lifeseed-75dfe' },
      targets: { 'lifeseed-75dfe': { hosting: { app: ['lifeseed-75dfe'], perauset: ['perauset'], theohouse: ['theohouse'], enlightenednations: ['enlightenednations'], mamaway: ['mamaway'] } } },
      etags: {},
    });
    const hosting = hostingOf(node, { predeploy: 'npm run build', public: 'dist', rewrites: [{ source: '**', destination: '/index.html' }] });
    expect(hosting.map(h => h.target)).toEqual(['app', 'perauset', 'theohouse', 'enlightenednations', 'mamaway']);
    expect(hosting[0]).toMatchObject({ target: 'app', predeploy: 'npm run build', public: 'dist' });
    // Every other face is served from its own dressed copy, made by its own predeploy (ring 2026-09-30).
    expect(hosting[3]).toMatchObject({ public: 'dist-faces/enlightenednations', target: 'enlightenednations', predeploy: 'node scripts/face-og.mjs enlightenednations' });
    expect(hosting[1].public).toBe('dist-faces/perauset');
  });
});

describe('the files that must agree with node.json (scripts/charter-sync.mjs)', () => {
  const read = (rel: string) => JSON.parse(readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8'));
  it('the shell\'s and the server\'s copies are the charter itself', () => {
    expect(read('src/config/charter.json')).toEqual(node);
    expect(read('functions/src/charter.json')).toEqual(node);
  });
  // The public envelope (/.well-known/lightseed.json) and robots.txt are no longer written here:
  // the build emits them from the charter it builds as (ring 2026-11-03, the shell section below).
  it('.firebaserc and firebase.json hosting follow the faces', () => {
    expect(read('.firebaserc')).toEqual(firebasercOf(node));
    const hosting = read('firebase.json').hosting as Array<Record<string, unknown>>;
    expect(hosting.map(h => h.target)).toEqual(node.faces.map(f => f.target));
    const { target: _t, ...template } = hosting[0];
    expect(hosting).toEqual(hostingOf(node, template));
    // Every face after the first is served from its own dressed copy (dist-faces/<target>),
    // made by its own predeploy — so a plain `firebase deploy --only hosting` never undresses
    // a face's card (ring 2026-09-30).
    for (const h of hosting.slice(1)) {
      expect(h.public).toBe(`dist-faces/${h.target}`);
      expect(h.predeploy).toBe(`node scripts/face-og.mjs ${h.target}`);
    }
  });
});

describe('the sender a mail wears (ring 2026-09-07)', () => {
  const c = { name: 'Lightseed', domain: 'lightseed.online', aliases: ['lifeseed.online'], mail: { from: 'The Living Web - Lightseed <admin@lightseed.online>' } };
  it('the node speaks as itself — no place, or a place that is the node', () => {
    expect(mailFromOf(c)).toBe('The Living Web - Lightseed <admin@lightseed.online>');
    expect(mailFromOf(c, null)).toBe(c.mail.from);
    expect(mailFromOf(c, { name: 'lightseed', domain: 'lightseed.online' })).toBe(c.mail.from);
    expect(mailFromOf(c, { name: 'lifeseed', domain: 'www.lifeseed.online' })).toBe(c.mail.from);
    expect(mailFromOf(c, { name: '  ', domain: '' })).toBe(c.mail.from);
  });
  it('a place takes the seat — its name first, its domain when it has none; the address never moves', () => {
    expect(mailFromOf(c, { name: 'The O House', domain: 'theohouse.org' })).toBe('The Living Web - The O House <admin@lightseed.online>');
    expect(mailFromOf(c, { domain: 'seed.enlightenednations.org' })).toBe('The Living Web - seed.enlightenednations.org <admin@lightseed.online>');
  });
  it('a charter name without the node\'s seat gains one; a bare address stays bare', () => {
    expect(mailFromOf({ ...c, mail: { from: 'lightseed <admin@lightseed.online>' } }, { name: 'Per Auset' })).toBe('lightseed - Per Auset <admin@lightseed.online>');
    expect(mailFromOf({ ...c, mail: { from: '<admin@lightseed.online>' } }, { name: 'Per Auset' })).toBe('Per Auset <admin@lightseed.online>');
    expect(mailFromOf({ ...c, mail: { from: 'admin@lightseed.online' } }, { name: 'Per Auset' })).toBe('admin@lightseed.online');
  });
  it('the node\'s own charter names The Living Web with the node in the seat', () => {
    expect(node.mail.from).toMatch(/^The Living Web - .+ <[^>]+>$/);
  });
});

describe('the functions mirror stays true', () => {
  it('judges and derives identically', () => {
    for (const c of [node, broken(c => { c.faces = []; }), broken(c => { c.keeper.email = 'x'; }), broken(c => { c.push.publicKey = ''; })]) {
      expect(sCharterProblem(c)).toBe(charterProblem(c));
    }
    expect(sCharterHosts(node)).toEqual(charterHosts(node));
    expect(sCharterOrigin(node)).toBe(charterOrigin(node));
    expect(sCharterOwnDomains(node)).toEqual(charterOwnDomains(node));
    expect(sCharterAuthHosts(node)).toEqual(charterAuthHosts(node));
    expect(sCharterProblem({ ...node, authHosts: ['perauset.org'] })).toBe(charterProblem({ ...node, authHosts: ['perauset.org'] }));
    expect(sCharterFaceDoor(node, 'perauset')).toBe(charterFaceDoor(node, 'perauset'));
    expect(sCharterPublicOf(node)).toEqual(charterPublicOf(node));
    for (const place of [undefined, null, { name: 'The O House', domain: 'theohouse.org' }, { domain: node.domain }, { name: '' }]) {
      expect(sMailFromOf(node, place)).toBe(mailFromOf(node, place));
    }
  });
});

// THE SHELL WEARS THE CHARTER (ring 2026-11-03). The built shell's words, structured data,
// manifest, robots.txt and public envelope come from whichever charter the build builds as —
// so an independent node's shell wears its own name, and nothing in index.html names a node.
describe('the shell wears the charter (ring 2026-11-03)', () => {
  const independent: IndependentCharter = {
    version: 2, nodeLid: '01a199a3-dd7d-75a9-869c-6fad6f757e5b',
    name: 'Trees & "People"', shortName: 'T&P', tagline: 'life <recognising> life', description: 'A node of its own.',
    domain: 'node.example', aliases: ['alias.example'], repo: 'https://github.com/example/node',
    keeper: { email: 'keeper@node.example' }, mail: { from: 'Node <hello@node.example>' },
    push: { subject: 'mailto:keeper@node.example', publicKey: '' }, theme: { color: '#123456', background: '#ffffff' },
    backend: { kind: 'postgres' },
    faces: [{ id: 'home', door: 'node.example', domains: [] }, { id: 'other', door: 'seed.other.example', domains: ['other.example'] }],
  };

  it('the fixture is a sound independent charter', () => {
    expect(independentCharterProblem(independent)).toBeNull();
  });

  it('the words enter index.html escaped once; the origin as given', () => {
    expect(shellVarsOf(independent, 'https://node.example')).toEqual({
      VITE_NODE_NAME: 'Trees &amp; &quot;People&quot;', VITE_NODE_SHORT: 'T&amp;P', VITE_NODE_TAGLINE: 'life &lt;recognising&gt; life',
      VITE_NODE_DESCRIPTION: 'A node of its own.', VITE_NODE_ORIGIN: 'https://node.example', VITE_NODE_THEME_COLOR: '#123456',
    });
    expect(shellVarsOf(node, charterOrigin(node))).toMatchObject({ VITE_NODE_NAME: node.name, VITE_NODE_SHORT: node.shortName, VITE_NODE_ORIGIN: charterOrigin(node), VITE_NODE_THEME_COLOR: node.theme.color });
  });

  it('the structured data is serialised from the charter, never templated', () => {
    const [site, org] = shellStructuredDataOf(independent, 'https://node.example:8443');
    expect(site).toMatchObject({
      '@context': 'https://schema.org', '@type': 'WebSite', name: 'Trees & "People"', alternateName: 'T&P', url: 'https://node.example:8443/',
      description: 'A node of its own.', publisher: { '@type': 'Organization', name: 'Trees & "People"', logo: 'https://node.example:8443/pwa-512x512.png' },
    });
    expect(org).toEqual({ '@context': 'https://schema.org', '@type': 'Organization', name: 'Trees & "People"', url: 'https://node.example:8443/', logo: 'https://node.example:8443/logo.svg' });
  });

  it('the manifest and robots.txt are the charter\'s', () => {
    expect(webManifestOf(independent)).toMatchObject({ name: 'Trees & "People" — life <recognising> life', short_name: 'T&P', description: 'A node of its own.', theme_color: '#123456', background_color: '#ffffff', start_url: '/', display: 'standalone' });
    expect(webManifestOf(independent).icons.map(i => i.src)).toEqual(['/pwa-192x192.png', '/pwa-512x512.png', '/maskable-512x512.png']);
    expect(robotsTxtOf('https://node.example')).toBe('User-agent: *\nAllow: /\nDisallow: /u/\n\nSitemap: https://node.example/sitemap.xml\n');
  });

  it('a shell is only built for an https origin at a host its charter answers at (a port allowed)', () => {
    expect(shellOriginProblem(independent, 'https://node.example')).toBeNull();
    expect(shellOriginProblem(independent, 'https://node.example:8443')).toBeNull();
    expect(shellOriginProblem(independent, 'https://alias.example')).toBeNull();
    expect(shellOriginProblem(independent, 'https://other.example')).toBeNull();
    expect(shellOriginProblem(independent, 'https://Seed.Other.Example')).toMatch(/https origin/); // a canonical origin is lower-case, as the URL's own
    expect(shellOriginProblem(independent, 'https://stranger.example')).toMatch(/stranger\.example/);
    expect(shellOriginProblem(independent, 'http://node.example')).toMatch(/https/);
    expect(shellOriginProblem(independent, 'https://node.example/app')).toMatch(/https origin/);
    expect(shellOriginProblem(independent, 'https://node.example/')).toMatch(/https origin/);
    expect(shellOriginProblem(independent, 'nope')).toMatch(/URL/);
    expect(shellOriginProblem(independent, undefined)).toMatch(/no application origin/);
    expect(shellOriginProblem(node, 'https://seed.theohouse.org')).toBeNull();
  });

  it('an independent charter answers at its own domains and doors, may be its own auth host alone, and tells a stranger no more', () => {
    expect(charterHosts(independent)).toEqual(['alias.example', 'node.example', 'other.example', 'seed.other.example']);
    expect(charterOwnDomains(independent)).toEqual(['node.example', 'alias.example']);
    expect(charterAuthHosts(independent)).toEqual(['alias.example', 'node.example']);
    expect(charterOrigin(independent)).toBe('https://node.example');
    const pub = charterPublicOf(independent);
    expect(pub).toEqual({
      version: 2, nodeLid: independent.nodeLid, name: independent.name, shortName: 'T&P', tagline: independent.tagline,
      domain: 'node.example', aliases: ['alias.example'], repo: independent.repo,
      faces: [{ door: 'node.example', domains: [] }, { door: 'seed.other.example', domains: ['other.example'] }],
      push: { publicKey: '' },
    });
    expect(JSON.stringify(pub)).not.toContain('keeper@');
    expect('backend' in pub).toBe(false);
  });

  it('index.html names no node by heart: every word of the node is a placeholder the law fills', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const placeholders = [...new Set([...html.matchAll(/%VITE_NODE_([A-Z_]+)%/g)].map(m => m[1]))].sort();
    expect(placeholders).toEqual(['DESCRIPTION', 'NAME', 'ORIGIN', 'SHORT', 'TAGLINE', 'THEME_COLOR']);
    const vars = shellVarsOf(independent, 'https://node.example');
    for (const p of placeholders) expect(vars).toHaveProperty(`VITE_NODE_${p}`);
    const stripped = html.replace(/%VITE_NODE_[A-Z_]+%/g, '');
    expect(stripped).not.toMatch(/lightseed|lifeseed|\.seed\b|#065f46/i);
    // The structured data is injected at build time (vite.config.ts), never written by heart.
    expect(stripped).not.toContain('application/ld+json');
  });
});
