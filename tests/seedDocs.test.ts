import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SEED_DOC_COLLECTIONS, SEED_LOVE_KINDS, docSentinel, seedDocCommand, seedDocsQuery } from '../src/domain/seedDocs.mjs';
import { TRAVEL_PLAN } from '../src/domain/bundle';

// THE DOOR'S REGISTRY AND THE SOIL AGREE: every collection the browser may name is a row of
// seed.doc_table, every row of seed.doc_table is a collection the browser may name, and every
// collection has a rule function the dispatcher calls — so a name can never fall through to
// a table the law does not cover.
const sql = (name: string) => readFileSync(join(__dirname, '..', 'seed', 'schema', name), 'utf8');
const door = sql('050_document_door.sql'), rules = sql('051_document_rules.sql'), write = sql('052_document_write.sql');

describe('the document door registry', () => {
  const names = Object.keys(SEED_DOC_COLLECTIONS);
  it('names exactly the collections seed.doc_table maps, each with a rule the dispatcher calls', () => {
    const mapped = [...door.matchAll(/\('([a-z_]+)','(public|seed)\.[a-z_]+','(id|uid)',/g)].map(m => m[1]);
    expect(mapped.sort()).toEqual([...names].sort());
    for (const name of names) expect(write, `${name} has no dispatcher arm`).toMatch(new RegExp(`when '${name}'|when [^\\n]*'${name}'`));
  });
  it('declares a parent exactly for the subcollection tables', () => {
    const parents = [...door.matchAll(/\('([a-z_]+)','(?:public|seed)\.[a-z_]+','(?:id|uid)','([a-z_]+)',/g)].map(m => m[1]);
    expect(parents.sort()).toEqual(names.filter(n => (SEED_DOC_COLLECTIONS as Record<string, { parent?: boolean }>)[n].parent).sort());
  });
  it('serves every travelling collection of the plan or a dedicated command, and no excluded one in public', () => {
    const commands = new Set(['links', 'secretLinks', 'communityInvites', 'treeKeepingInvites', 'beings']); // their own doors (002, 007, 015, 049)
    for (const rule of TRAVEL_PLAN) {
      if (rule.mode === 'excluded' || rule.path.includes('/')) continue;
      const name = rule.path.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
      if (commands.has(rule.path)) continue;
      expect(names, `${rule.path} travels but the door does not serve it`).toContain(name);
    }
    expect(door).not.toMatch(/create table (if not exists )?public\.(lifetree_holds|push_subscriptions)/);
  });
  it('every rule the policies call is granted to the runtime role', () => {
    const inPolicies = [...rules.matchAll(/using\(seed\.(rule_[a-z_]+)\(/g)].map(m => m[1]);
    const runtime = readFileSync(join(__dirname, '..', 'src', 'domain', 'seedRuntime.ts'), 'utf8');
    for (const name of new Set(inPolicies)) expect(runtime, `${name} drives a policy but is not granted`).toContain(`seed.${name}(text,text,text,jsonb,jsonb,text[],timestamptz)`);
  });
});

describe('a documents query', () => {
  const q = (collection: string, params: string) => seedDocsQuery(collection, new URLSearchParams(params));
  it('accepts the registry filters and refuses everything else', () => {
    expect(q('stays', 'f.hostUid=alice&order=newest&limit=5')).toMatchObject({ kind: 'docs', collection: 'stays', equals: { hostUid: 'alice' }, newest: true, limit: 5 });
    expect(q('pulses', 'has.participantUids=alice&in.type=reach,tree_chat')).toMatchObject({ contains: { participantUids: 'alice' }, within: { type: ['reach', 'tree_chat'] } });
    expect(q('stays', 'f.note=x')).toBeNull();
    expect(q('stays', 'has.hostUid=x')).toBeNull();
    expect(q('stays', 'in.hostUid=a,a')).toBeNull();
    expect(q('stays', 'in.hostUid=' + Array.from({ length: 11 }, (_, i) => 'u' + i).join(','))).toBeNull();
    expect(q('nowhere', 'id=x')).toBeNull();
    expect(q('stays', 'id=s1&f.uid=bob')).toBeNull();
    expect(q('stays', 'limit=0')).toBeNull();
    expect(q('stays', 'f.uid=bob&f.uid=carol')).toBeNull();
  });
  it('binds subcollections to a parent and parses both cursors', () => {
    expect(q('pulse_signatures', 'id=alice')).toBeNull();
    expect(q('pulse_signatures', 'parent=d1&id=alice')).toMatchObject({ parent: 'd1', id: 'alice' });
    expect(q('stays', 'parent=x')).toBeNull();
    expect(q('stays', 'order=newest&after=' + encodeURIComponent(JSON.stringify(['2026-11-01T10:00:00.000000Z', 's1'])))).toMatchObject({ after: { moment: '2026-11-01T10:00:00.000000Z', id: 's1' } });
    expect(q('stays', 'order=newest&after=garbage')).toBeNull();
    expect(q('stays', 'after=s1')).toMatchObject({ after: 's1', newest: false });
  });
});

describe('a document command', () => {
  it('keeps the shape the law expects and refuses the rest', () => {
    expect(seedDocCommand({ action: 'create', collection: 'users', id: 'a', data: { x: 1 } })).toMatchObject({ action: 'create' });
    expect(seedDocCommand({ action: 'create', collection: 'stays', data: { x: 1 } })).toMatchObject({ action: 'create' });
    expect(seedDocCommand({ action: 'update', collection: 'users', data: { x: 1 } })).toBeNull();
    expect(seedDocCommand({ action: 'update', collection: 'users', id: 'a', patch: {} })).toBeNull();
    expect(seedDocCommand({ action: 'update', collection: 'users', id: 'a', patch: { 'watering.lastWateredAt': docSentinel.serverTime() } })).not.toBeNull();
    expect(seedDocCommand({ action: 'update', collection: 'users', id: 'a', patch: { 'bad key': 1 } })).toBeNull();
    expect(seedDocCommand({ action: 'create', collection: 'users', id: 'a', data: { id: 'a' } })).toBeNull();
    expect(seedDocCommand({ action: 'create', collection: 'users', id: 'a', data: { n: Number.NaN } })).toBeNull();
    expect(seedDocCommand({ action: 'set', collection: 'users', id: 'a', data: {}, merge: 'yes' })).toBeNull();
    expect(seedDocCommand({ action: 'delete', collection: 'users', id: 'a', expect: { status: 'open' } })).toMatchObject({ action: 'delete' });
    expect(seedDocCommand({ action: 'create', collection: 'pulse_signatures', id: 'a', data: {} })).toBeNull();
    expect(seedDocCommand({ action: 'create', collection: 'pulse_signatures', parent: 'p', id: 'a', data: {} })).not.toBeNull();
    expect(seedDocCommand({ action: 'love', kind: 'lifetrees', id: 't1' })).toEqual({ action: 'love', kind: 'lifetrees', id: 't1' });
    expect(seedDocCommand({ action: 'love', kind: 'persons', id: 't1' })).toBeNull();
    expect(SEED_LOVE_KINDS).toHaveLength(5);
    expect(docSentinel.arrayUnion('a', 'b')).toEqual({ $op: 'arrayUnion', values: ['a', 'b'] });
  });
});
