import { describe, expect, it } from 'vitest';
import { seedRequest } from '../src/domain/seedRequest.mjs';

describe('independent public API requests', () => {
  it('allows relation-wide public queries and authenticated bounded secret-circle queries',()=>{
    expect(seedRequest('GET','/v1/links?rel=guardian',undefined)).toMatchObject({kind:'links',direction:'rel',id:'guardian'});
    expect(seedRequest('GET','/v1/secret-circle-links?to=tree',undefined)).toMatchObject({status:401});
    expect(seedRequest('GET','/v1/secret-circle-links?to=tree','verified',true)).toMatchObject({kind:'secretCircleLinks',direction:'to',id:'tree'});
    for(const query of ['', '?from=alice','?to=tree&uid=alice','?to=tree&rel=keeper']) {
      expect(seedRequest('GET','/v1/secret-circle-links'+query,'verified',true)).toMatchObject({status:400});
    }
  });
  it('accepts only the bounded public graph contract', () => {
    expect(seedRequest('GET', '/v1/links?to=tree', undefined)).toEqual({
      kind: 'links', direction: 'to', id: 'tree', rel: null, after: null, limit: 50,
    });
    expect(seedRequest('GET', '/v1/links?from=alice&rel=joined&after=abc&limit=100', undefined))
      .toMatchObject({ kind: 'links', direction: 'from', id: 'alice', limit: 100, after: 'abc', rel: 'joined' });
    expect(seedRequest('GET', '/healthz', undefined)).toEqual({ kind: 'health' });
    expect(seedRequest('GET', '/readyz', undefined)).toEqual({ kind: 'ready' });
    // A composed link cursor can be longer than either endpoint alone.
    expect(seedRequest('GET', '/v1/links?to=tree&after=' + 'a'.repeat(1024), undefined)).toMatchObject({ kind: 'links' });
  });
  it.each(['', '?to=', '?to=a&from=b', '?to=a&to=b', '?to=a&uid=admin', '?to=a&limit=0',
    '?to=a&limit=101', '?to=a&limit=1.5', '?to=a&limit=Infinity', '?to=a&rel=%27%3B',
    '?to=%00', '?to=a&after=', '?to=a&private=true'])('rejects ambiguous or excessive query %s', query => {
    expect(seedRequest('GET', '/v1/links' + query, undefined)).toMatchObject({ status: 400 });
  });
  it('does not accept a supplied identity, private route or write method', () => {
    expect(seedRequest('GET', '/v1/links?to=tree', 'Bearer forged')).toMatchObject({ status: 401 });
    expect(seedRequest('GET', '/v1/secret-links?to=tree', undefined)).toMatchObject({ status: 404 });
    expect(seedRequest('POST', '/v1/links', undefined)).toMatchObject({ status: 405 });
    expect(seedRequest('GET', '/'.repeat(5000), undefined)).toMatchObject({ status: 400 });
    expect(seedRequest('GET', '//[', undefined)).toMatchObject({ status: 400 });
  });
});

describe('independent community read contract', () => {
  it('separates individual lookup from bounded listing', () => {
    expect(seedRequest('GET', '/v1/communities', undefined)).toEqual({ kind: 'communities', id: null, after: null, limit: 50 });
    expect(seedRequest('GET', '/v1/communities?id=garden', undefined)).toMatchObject({ kind: 'communities', id: 'garden' });
    expect(seedRequest('GET', '/v1/communities?after=garden&limit=100', undefined)).toMatchObject({ kind: 'communities', after: 'garden', limit: 100 });
  });
  it.each(['id=', 'id=%00', 'id=a&id=b', 'id=a&limit=1', 'id=a&after=b', 'after=',
    'limit=101', 'limit=0', 'limit=1&limit=2', 'uid=alice', 'collection=users', 'after=' + 'a'.repeat(513)])('refuses invalid community query %s', query => {
    expect(seedRequest('GET', '/v1/communities?' + query, undefined)).toMatchObject({ status: 400 });
  });
  it('does not expose writes or accept forged credentials', () => {
    expect(seedRequest('POST', '/v1/communities', undefined)).toMatchObject({ status: 405 });
    expect(seedRequest('GET', '/v1/communities', 'Bearer forged')).toMatchObject({ status: 401 });
  });
});


describe('community command routing', () => {
  it('requires authenticated POST and does not accept query-string authority', () => {
    expect(seedRequest('POST', '/v1/communities/command', undefined)).toMatchObject({ status: 401 });
    expect(seedRequest('POST', '/v1/communities/command', 'Bearer good', true)).toEqual({ kind: 'communityCommand' });
    expect(seedRequest('GET', '/v1/communities/command', 'Bearer good', true)).toMatchObject({ status: 405 });
    expect(seedRequest('POST', '/v1/communities/command?uid=other', 'Bearer good', true)).toMatchObject({ status: 405 });
  });
});

it('bounds authenticated keeper-offer queries and derives the inbox from the session', () => {
  expect(seedRequest('GET','/v1/keeper-invites?mine=true',undefined)).toMatchObject({status:401});
  expect(seedRequest('GET','/v1/keeper-invites?mine=true','Bearer verified',true)).toMatchObject({kind:'keeperInvites',mine:true,limit:50});
  for(const query of ['', '?mine=false','?mine=true&community=garden','?uid=other','?community=garden&limit=101','?community=a&community=b']) {
    expect(seedRequest('GET','/v1/keeper-invites'+query,'Bearer verified',true)).toMatchObject({status:400});
  }
});

it('exposes held tree-invitation lookup but requires identity for lists and commands',()=>{
  expect(seedRequest('GET','/v1/tree-invites?id=token',undefined)).toMatchObject({kind:'treeInvites',id:'token'});
  expect(seedRequest('GET','/v1/tree-invites?mine=true',undefined)).toMatchObject({status:401});
  expect(seedRequest('POST','/v1/tree-invites/command',undefined)).toMatchObject({status:401});
  expect(seedRequest('POST','/v1/tree-invites/command','Bearer verified',true)).toMatchObject({kind:'treeInviteCommand'});
});

describe('the face of the node', () => {
  it('opens the four public doors by GET alone, reading no bearer', () => {
    expect(seedRequest('GET', '/b/033oN66moGj2LLRqK2R76R', undefined)).toEqual({ kind: 'beingCard', door: '033oN66moGj2LLRqK2R76R' });
    expect(seedRequest('GET', '/b/019f57e8-878a-75ff-be0e-7d3913b4b2f3/', 'Bearer forged', false)).toEqual({ kind: 'beingCard', door: '019f57e8-878a-75ff-be0e-7d3913b4b2f3' });
    expect(seedRequest('HEAD', '/b/033oN66moGj2LLRqK2R76R', undefined)).toMatchObject({ kind: 'beingCard' });
    expect(seedRequest('GET', '/face/033oN66moGj2LLRqK2R76R.jpg?v=abc', undefined)).toEqual({ kind: 'facePicture', door: '033oN66moGj2LLRqK2R76R' });
    expect(seedRequest('GET', '/face/033oN66moGj2LLRqK2R76R', undefined)).toMatchObject({ kind: 'facePicture' });
    expect(seedRequest('GET', '/sitemap.xml', undefined)).toEqual({ kind: 'sitemap' });
    expect(seedRequest('GET', '/faceEvents?domain=theohouse.org', undefined)).toEqual({ kind: 'faceEvents', domain: 'theohouse.org' });
    expect(seedRequest('GET', '/faceEvents', undefined)).toEqual({ kind: 'faceEvents', domain: null });
    for (const target of ['/b/', '/b/short', '/b/..%2F..%2Fetc', '/face/x.png', '/face/', '/faceEventsX', '/sitemap.xml.bak']) {
      expect(seedRequest('GET', target, undefined), target).toMatchObject({ status: 404 });
    }
    expect(seedRequest('POST', '/b/033oN66moGj2LLRqK2R76R', undefined)).toMatchObject({ status: 405 });
    expect(seedRequest('POST', '/faceEvents', undefined)).toMatchObject({ status: 405 });
  });
});
