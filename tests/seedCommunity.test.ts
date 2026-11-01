import { describe, expect, it } from 'vitest';
import { seedCommunityCommand, seedNodeDomain } from '../src/domain/seedCommunity.mjs';

describe('independent community commands', () => {
  const founding = { action: 'create', name: ' Garden  Circle ', domain: 'garden.example', door: 'invite' };
  it('normalizes names without accepting authority, relationships or birthplace from callers', () => {
    expect(seedCommunityCommand(founding)).toEqual({ ...founding, name: 'Garden Circle' });
    for (const key of ['anchorUid', 'lid', 'memberIds', 'keeperUids', 'bornOn', 'formation', 'id']) {
      expect(seedCommunityCommand({ ...founding, [key]: 'forged' })).toBeNull();
    }
  });
  it('refuses malformed names, domains and doors', () => {
    for (const change of [{ name: '' }, { name: 'a'.repeat(121) }, { domain: 'https://garden.example' },
      { domain: 'garden.example/path' }, { domain: '-bad.example' }, { door: 'other' }]) {
      expect(seedCommunityCommand({ ...founding, ...change })).toBeNull();
    }
  });
  it('accepts only the closed set of membership commands', () => {
    for (const action of ['join', 'request', 'leave', 'cancel']) {
      expect(seedCommunityCommand({ action, id: 'garden' })).toEqual({ action, id: 'garden' });
      expect(seedCommunityCommand({ action, id: 'garden', member: 'other' })).toBeNull();
    }
    for (const action of ['accept', 'decline', 'remove']) {
      expect(seedCommunityCommand({ action, id: 'garden', member: 'alice' })).not.toBeNull();
      expect(seedCommunityCommand({ action, id: 'garden' })).toBeNull();
    }
    expect(seedCommunityCommand({ action: 'staff', id: 'garden' })).toBeNull();
  });
  it('takes birthplace from a canonical configured HTTPS origin', () => {
    expect(seedNodeDomain('https://www.garden.example')).toBe('garden.example');
    for (const value of [undefined, 'http://garden.example', 'https://garden.example/path', 'https://a:b@garden.example']) {
      expect(seedNodeDomain(value)).toBeNull();
    }
  });
});

describe('community role commands', () => {
  it('binds resignation to the caller and permits only explicit steward delegation', () => {
    expect(seedCommunityCommand({ action: 'resign_keeper', id: 'garden' })).toEqual({ action: 'resign_keeper', id: 'garden' });
    expect(seedCommunityCommand({ action: 'resign_keeper', id: 'garden', member: 'other' })).toBeNull();
    for (const action of ['grant_steward', 'revoke_steward']) {
      expect(seedCommunityCommand({ action, id: 'garden', member: 'alice' })).not.toBeNull();
      expect(seedCommunityCommand({ action, id: 'garden' })).toBeNull();
    }
    expect(seedCommunityCommand({ action: 'grant_keeper', id: 'garden', member: 'alice' })).toBeNull();
  });
});


it('binds keepership requests to their author and only accepts explicit target responses', () => {
  expect(seedCommunityCommand({action:'request_keeper',id:'garden'})).not.toBeNull();
  expect(seedCommunityCommand({action:'request_keeper',id:'garden',member:'other'})).toBeNull();
  expect(seedCommunityCommand({action:'cancel_keeper_request',id:'garden',member:'other'})).toBeNull();
  expect(seedCommunityCommand({action:'accept_keeper_request',id:'garden',member:'bob'})).not.toBeNull();
  expect(seedCommunityCommand({action:'accept_keeper_request',id:'garden'})).toBeNull();
});

it('binds keeper offers to a named recipient without accepting sender or status claims', () => {
  expect(seedCommunityCommand({action:'offer_keeper',id:'garden',member:'bob'})).not.toBeNull();
  expect(seedCommunityCommand({action:'offer_keeper',id:'garden',member:'bob',invitedByUserId:'alice'})).toBeNull();
  expect(seedCommunityCommand({action:'accept_keeper_offer',id:'garden',inviteId:'offer'})).not.toBeNull();
  expect(seedCommunityCommand({action:'accept_keeper_offer',id:'garden',inviteId:'offer',member:'bob'})).toBeNull();
  expect(seedCommunityCommand({action:'decline_keeper_offer',id:'garden'})).toBeNull();
});

it('forms a circle without caller-controlled provenance, authority or address',()=>{
  expect(seedCommunityCommand({action:'form_circle',id:'circle',name:' New  Garden '})).toEqual({action:'form_circle',id:'circle',name:'New Garden'});
  expect(seedCommunityCommand({action:'form_circle',id:'circle'})).not.toBeNull();
  for(const field of ['bornOn','domain','formedBy','anchorUid','formedAt'])expect(seedCommunityCommand({action:'form_circle',id:'circle',[field]:'forged'})).toBeNull();
});
