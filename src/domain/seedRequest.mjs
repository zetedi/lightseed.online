import {seedBeingQuery} from './seedBeing.mjs';
import {seedAlignmentQuery} from './seedAlignment.mjs';
import {seedPulseQuery} from './seedPulse.mjs';
import {seedSigningQuery,seedSigningHistoryQuery,seedRecoveryWitnessQuery} from './seedSigning.mjs';
import { seedMediaPath } from './seedMedia.mjs';
import {seedVisionQuery} from './seedVision.mjs';
import { seedPeopleQuery } from './seedProfile.mjs';
import { seedTreeInviteQuery } from './seedTreeInvite.mjs';
import { seedKeeperInviteQuery } from './seedCommunity.mjs';
import { seedTreeQuery } from './seedTree.mjs';
import { seedDocsQuery } from './seedDocs.mjs';
// Bounded graph contract. Authentication is established by the server, never a query field.
export function seedRequest(method, target, authorization, authenticated = false) {
  // THE ORGANS (ring 2026-11-02): light, staff, the account's own departure, domain proofs and doors — signed in only.
  const organs={'/v1/light/command':'lightCommand','/v1/staff/command':'staffCommand','/v1/account/command':'accountCommand','/v1/domains/command':'domainCommand','/v1/mail/command':'mailCommand','/v1/ai/command':'aiCommand'};
  // THE MAIL ORGAN'S PUBLIC DOORS (ring 2026-11-03): a stranger asks for an invitation; a subscriber leaves by token (GET shows a page, POST is RFC 8058 one-click).
  if(target==='/v1/invite-requests') {
    if(method!=='POST')return {error:'method_not_allowed',status:405};
    if(authorization && !authenticated)return {error:'invalid_token',status:401};
    return {kind:'inviteRequest'};
  }
  if(typeof target==='string' && target.startsWith('/u/')) {
    if(method!=='GET' && method!=='POST')return {error:'method_not_allowed',status:405};
    const token=target.slice(3);
    return /^[A-Za-z0-9_-]{16,128}$/.test(token)?{kind:'unsubscribe',token,method}:{error:'not_found',status:404};
  }
  if(['/v1/events/command','/v1/alignments/command','/v1/links/command','/v1/visions/command','/v1/signing/command','/v1/blocks/command','/v1/offerings/command'].includes(target) || Object.hasOwn(organs,target)) {
    if(method!=='POST')return {error:'method_not_allowed',status:405};
    if(!authenticated)return {error:authorization?'invalid_token':'authentication_required',status:401};
    if(Object.hasOwn(organs,target))return {kind:organs[target]};
    return {kind:target==='/v1/events/command'?'eventCommand':target==='/v1/alignments/command'?'alignmentCommand':target==='/v1/offerings/command'?'offeringCommand':target==='/v1/blocks/command'?'blockCommand':target==='/v1/signing/command'?'signingCommand':target==='/v1/visions/command'?'visionCommand':'linkCommand'};
  }
  if (target === '/v1/docs/command') {
    if (method !== 'POST') return { error: 'method_not_allowed', status: 405 };
    if (authorization && !authenticated) return { error: 'invalid_token', status: 401 };
    return { kind: 'docCommand' };
  }
  if (method !== 'GET' && !(method === 'POST' && ['/v1/me/profile', '/v1/communities/command', '/v1/community-invites/command', '/v1/trees/command', '/v1/tree-invites/command', '/v1/media/upload'].includes(target))) return { error: 'method_not_allowed', status: 405 };
  if (authorization && !authenticated) return { error: 'invalid_token', status: 401 };
  if (typeof target !== 'string' || target.length > 4096 || !target.startsWith('/')) {
    return { error: 'invalid_request', status: 400 };
  }
  let url;
  try { url = new URL(target, 'http://node.invalid'); }
  catch { return { error: 'invalid_request', status: 400 }; }
  if(url.pathname==='/v1/me/signing-recovery') {
    if(!authenticated)return {error:'authentication_required',status:401};
    return url.search?{error:'invalid_query',status:400}:{kind:'recoveryContext'};
  }
  if(url.pathname==='/v1/signing-recovery') {
    if(!authenticated)return {error:'authentication_required',status:401};
    const id=url.searchParams.get('id'),event=url.searchParams.get('event');
    if(url.searchParams.size!==2 || !seedSigningQuery(new URLSearchParams({id:id??''})) || typeof event!=='string' || !/^[A-Za-z0-9_-]{1,128}$/.test(event))return {error:'invalid_query',status:400};
    return {kind:'recoveryProposal',id,event};
  }
  if(url.pathname==='/v1/signing-recovery-witnesses') {
    if(!authenticated)return {error:'authentication_required',status:401};
    return seedRecoveryWitnessQuery(url.searchParams)??{error:'invalid_query',status:400};
  }
  if(url.pathname.startsWith('/v1/docs/')) {
    const name=url.pathname.slice('/v1/docs/'.length);
    if(!/^[a-z][a-z_]{0,63}$/.test(name))return {error:'not_found',status:404};
    return seedDocsQuery(name,url.searchParams)??{error:'invalid_query',status:400};
  }
  if(url.pathname==='/v1/beings')return seedBeingQuery(url.searchParams)??{error:'invalid_query',status:400};
  if(url.pathname==='/v1/alignments')return seedAlignmentQuery(url.searchParams)??{error:'invalid_query',status:400};
  if(url.pathname==='/v1/pulses')return seedPulseQuery(url.searchParams)??{error:'invalid_query',status:400};
  if(url.pathname==='/v1/signing-history')return seedSigningHistoryQuery(url.searchParams)??{error:'invalid_query',status:400};
  if(url.pathname==='/v1/signing-identity')return seedSigningQuery(url.searchParams)??{error:'invalid_query',status:400};
  if (url.pathname === '/healthz' && !url.search) return { kind: 'health' };
  if (url.pathname === '/readyz' && !url.search) return { kind: 'ready' };
  if (url.pathname === '/v1/me/profile') {
    if (!authenticated) return { error: 'authentication_required', status: 401 };
    if (url.search) return { error: 'invalid_query', status: 400 };
    return { kind: method === 'POST' ? 'saveProfile' : 'profile' };
  }
  if (['/v1/communities/command', '/v1/community-invites/command', '/v1/trees/command', '/v1/tree-invites/command'].includes(url.pathname)) {
    if (method !== 'POST') return { error: 'method_not_allowed', status: 405 };
    if (!authenticated) return { error: 'authentication_required', status: 401 };
    return { kind: url.pathname === '/v1/tree-invites/command' ? 'treeInviteCommand' : url.pathname === '/v1/trees/command' ? 'treeCommand' : url.pathname === '/v1/communities/command' ? 'communityCommand' : 'inviteCommand' };
  }
  if(url.pathname==='/v1/media/upload') {
    if(method!=='POST')return {error:'method_not_allowed',status:405};
    if(!authenticated)return {error:'authentication_required',status:401};
    return {kind:'mediaUpload'};
  }
  if(url.pathname==='/v1/media') {
    const p=url.searchParams;
    if([...p.keys()].some(k=>!['path','variant'].includes(k) || p.getAll(k).length!==1) || !seedMediaPath(p.get('path'))
      || (p.has('variant') && !['primary','small','large'].includes(p.get('variant'))))return {error:'invalid_query',status:400};
    return {kind:'mediaRead',path:p.get('path'),variant:p.get('variant')??'primary'};
  }
  if (url.pathname === '/v1/people') return seedPeopleQuery(url.searchParams) ?? {error:'invalid_query',status:400};
  if (url.pathname === '/v1/tree-invites') {
    const query=seedTreeInviteQuery(url.searchParams);
    if(!query)return {error:'invalid_query',status:400};
    if(!query.id && !authenticated)return {error:'authentication_required',status:401};
    return query;
  }
  if (url.pathname === '/v1/keeper-invites') {
    if (!authenticated) return { error:'authentication_required',status:401 };
    return seedKeeperInviteQuery(url.searchParams) ?? {error:'invalid_query',status:400};
  }
  if (url.pathname === '/v1/community-invites') {
    const p = url.searchParams;
    const valid = value => typeof value === 'string' && value.length > 0 && value.length <= 128 && !/[\u0000-\u0020\u007f]/.test(value);
    if ([...p.keys()].some(k => !['id', 'community', 'after', 'limit'].includes(k) || p.getAll(k).length !== 1)
      || p.has('id') === p.has('community') || !valid(p.get(p.has('id') ? 'id' : 'community'))
      || (p.has('id') && (p.has('after') || p.has('limit')))
      || (p.has('after') && !valid(p.get('after')))
      || (p.has('limit') && !/^(?:[1-9]|[1-9][0-9]|100)$/.test(p.get('limit')))) return { error: 'invalid_query', status: 400 };
    if (p.has('community') && !authenticated) return { error: 'authentication_required', status: 401 };
    return { kind: 'invites', id: p.get('id'), community: p.get('community'), after: p.get('after'), limit: Number(p.get('limit') ?? 50) };
  }
  if (url.pathname === '/v1/communities') {
    const p = url.searchParams;
    const validId = value => typeof value === 'string' && value.length > 0
      && value.length <= 512 && !/[\u0000-\u001f\u007f]/.test(value);
    if ([...p.keys()].some(k => !['id', 'after', 'limit'].includes(k) || p.getAll(k).length !== 1)
      || (p.has('id') && (!validId(p.get('id')) || p.has('after') || p.has('limit')))
      || (p.has('after') && !validId(p.get('after')))
      || (p.has('limit') && !/^(?:[1-9]|[1-9][0-9]|100)$/.test(p.get('limit')))) {
      return { error: 'invalid_query', status: 400 };
    }
    return { kind: 'communities', id: p.get('id'), after: p.get('after'), limit: Number(p.get('limit') ?? 50) };
  }
  if (url.pathname === '/v1/trees') return seedTreeQuery(url.searchParams) ?? { error: 'invalid_query', status: 400 };
  if (url.pathname === '/v1/visions') return seedVisionQuery(url.searchParams) ?? {error:'invalid_query',status:400};
  const personal = url.pathname === '/v1/me/secret-links';
  const circle = url.pathname === '/v1/secret-circle-links';
  if (url.pathname === '/v1/me' || personal || circle) {
    if (!authenticated) return { error: 'authentication_required', status: 401 };
    if (url.pathname === '/v1/me') return url.search ? { error: 'invalid_query', status: 400 } : { kind: 'me' };
  }
  if (!personal && !circle && url.pathname !== '/v1/links') return { error: 'not_found', status: 404 };
  const p = url.searchParams;
  const allowed = personal ? ['after', 'limit'] : circle ? ['to','after','limit'] : ['from', 'to', 'rel', 'after', 'limit'];
  if ([...p.keys()].some(k => !allowed.includes(k) || p.getAll(k).length !== 1)) {
    return { error: 'invalid_query', status: 400 };
  }
  const direction = p.has('from') ? 'from' : p.has('to') || circle || personal ? 'to' : 'rel';
  const id = p.get(direction);
  const identifier = (v, max = 512) => typeof v === 'string' && v.length > 0 && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v);
  if ((!personal && ((p.has('from') && p.has('to')) || !identifier(id)))
    || (p.has('rel') && !/^[a-z][a-z0-9_]{0,63}$/.test(p.get('rel')))
    || (p.has('after') && !identifier(p.get('after'), 2048))
    || (p.has('limit') && !/^(?:[1-9]|[1-9][0-9]|100)$/.test(p.get('limit')))) {
    return { error: 'invalid_query', status: 400 };
  }
  return { kind: personal ? 'secretLinks' : circle ? 'secretCircleLinks' : 'links', direction, id, rel: p.get('rel'), after: p.get('after'), limit: Number(p.get('limit') ?? 50) };
}
