import { describe, expect, it } from 'vitest';
import { mkdtemp, writeFile, readFile, stat, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { independentCharterProblem } from '../src/domain/independentCharter';
import { charterHosts, charterPublicOf, type IndependentCharter } from '../src/domain/charter';

const sound = (): IndependentCharter => ({
  version: 2, nodeLid: '019f6381-48fd-7fcc-9382-e99d923f38aa',
  name: 'Example node', shortName: 'Example', tagline: 'Growing together', description: 'An independent node',
  domain: 'node.example', aliases: ['other.example'], repo: 'https://code.example/node',
  keeper: { email: 'keeper@node.example' }, mail: { from: 'Example <hello@node.example>' },
  push: { subject: 'mailto:keeper@node.example', publicKey: '' }, theme: { color: '#123456', background: '#ffffff' },
  backend: { kind: 'postgres' }, faces: [{ id: 'home', door: 'node.example', domains: [] }],
});

describe('independent charter', () => {
  it('derives hosts and a public envelope without Firebase or private contacts', () => {
    const c = sound();
    expect(independentCharterProblem(c)).toBeNull();
    expect(charterHosts(c)).toEqual(['node.example', 'other.example']);
    const pub = charterPublicOf(c);
    expect(pub).toMatchObject({ version: 2, nodeLid: c.nodeLid });
    for (const key of ['firebase', 'backend', 'keeper', 'mail']) expect(pub).not.toHaveProperty(key);
  });

  it.each([null, [], 'node', 1, {}, { version: 2 }])('rejects malformed input safely: %j', value => {
    expect(independentCharterProblem(value)).toBe('shape');
  });

  it('rejects hidden credentials and unknown configuration at every boundary', () => {
    expect(independentCharterProblem({ ...sound(), firebase: {} })).toBe('shape');
    for (const field of ['keeper', 'mail', 'push', 'theme', 'backend'] as const) {
      const c = sound();
      Object.assign(c[field], { password: 'secret' });
      expect(independentCharterProblem(c)).toBe(field);
    }
    const c = sound();
    Object.assign(c.faces[0], { site: 'old-site' });
    expect(independentCharterProblem(c)).toBe('faces');
  });

  it('rejects ambiguous routing and missing primary faces', () => {
    const c = sound();
    c.faces.push({ id: 'second', door: 'face.example', domains: ['node.example'] });
    expect(independentCharterProblem(c)).toBe('face_hosts');
    c.faces[1].domains = ['other.example'];
    expect(independentCharterProblem(c)).toBe('face_hosts');
    c.faces = [{ id: 'second', door: 'face.example', domains: [] }];
    expect(independentCharterProblem(c)).toBe('face_hosts');
    c.faces.push({ id: 'third', door: 'face.example', domains: [] });
    expect(independentCharterProblem(c)).toBe('face_hosts');
  });

  it.each(['https://node.example', 'NODE.example', 'node..example', '-node.example', '127.0.0.1', 'node.example/path'])('rejects invalid host %s', domain => {
    expect(independentCharterProblem({ ...sound(), domain })).toBe('domain');
  });

  it('rejects URL credentials and mail header injection', () => {
    expect(independentCharterProblem({ ...sound(), repo: 'https://user:password@code.example' })).toBe('repo');
    expect(independentCharterProblem({ ...sound(), mail: { from: 'hello@node.example\r\nBcc: other@example.org' } })).toBe('mail');
  });

  it('prepares isolated private files, refuses overwrites and leaves no output for invalid input', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'lightseed-charter-'));
    try {
      const source = join(dir, 'source.json');
      const output = join(dir, 'prepared');
      const c = sound();
      const content = JSON.stringify(c);
      await writeFile(source, content);
      const run = () => spawnSync(process.execPath, [resolve('scripts/configure-seed.mjs'), source, output], { encoding: 'utf8', timeout: 20_000 });
      const first = run();
      expect(first.status, first.stderr).toBe(0);
      expect(JSON.parse(await readFile(join(output, 'node.json'), 'utf8'))).toEqual(c);
      expect(JSON.parse(await readFile(join(output, 'hosts.json'), 'utf8'))).toEqual(charterHosts(c));
      expect(JSON.parse(await readFile(join(output, 'lightseed.json'), 'utf8'))).toEqual(charterPublicOf(c));
      expect((await stat(output)).mode & 0o777).toBe(0o700);
      expect((await stat(join(output, 'node.json'))).mode & 0o777).toBe(0o600);
      expect(run().status).toBe(1);
      expect(await readFile(source, 'utf8')).toBe(content);
      const legacy = spawnSync(process.execPath, [resolve('scripts/charter-sync.mjs'), source, '--check'], { encoding: 'utf8' });
      expect(legacy.status).toBe(1);
      expect(legacy.stderr).toContain('Independent charters use seed:configure');
      await rm(output, { recursive: true });
      await writeFile(source, JSON.stringify({ ...c, backend: { kind: 'firebase' } }));
      expect(run().status).toBe(1);
      expect(await readdir(dir)).toEqual(['source.json']);
    } finally { await rm(dir, { recursive: true, force: true }); }
  }, 30_000);
});
