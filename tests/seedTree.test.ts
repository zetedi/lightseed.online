import { describe, expect, it } from 'vitest';
import { seedRequest } from '../src/domain/seedRequest.mjs';

describe('independent tree query contract', () => {
  it('bounds listing, scopes by data filters, and separates individual lookup', () => {
    expect(seedRequest('GET','/v1/trees?domain=garden.example&kind=SECRET&anchor=alice&limit=10',undefined)).toMatchObject({
      kind:'trees',domain:'garden.example',treeType:'SECRET',anchor:'alice',limit:10,
    });
    expect(seedRequest('GET','/v1/trees?id=tree',undefined)).toMatchObject({ kind:'trees',id:'tree' });
    expect(seedRequest('GET','/v1/trees',undefined)).toMatchObject({ kind:'trees',limit:50 });
    expect(seedRequest('GET','/v1/trees?editable=true',undefined)).toMatchObject({editable:true});
    expect(seedRequest('GET','/v1/trees?editable=bob',undefined)).toMatchObject({status:400});
    expect(seedRequest('GET','/v1/trees?garden=garden&limit=10',undefined)).toMatchObject({garden:'garden',limit:10});
    expect(seedRequest('GET','/v1/trees?garden=',undefined)).toMatchObject({status:400});
    expect(seedRequest('GET','/v1/trees?participating=vision',undefined)).toMatchObject({participating:'vision'});
    expect(seedRequest('GET','/v1/trees?participating=',undefined)).toMatchObject({status:400});
  });
  it.each(['?id=', '?id=a&domain=b', '?id=a&limit=1', '?uid=admin', '?private=true', '?anchor=a&anchor=b',
    '?kind=unknown', '?after=', '?limit=0', '?limit=101', '?domain=%00'])('refuses ambiguous or authority-bearing query %s', query => {
    expect(seedRequest('GET','/v1/trees'+query,undefined)).toMatchObject({ status:400 });
  });
});

import { seedTreeCommand } from '../src/domain/seedTree.mjs';
it('separates own tree requests from keeper answers and accepts only offered roles',()=>{
  expect(seedTreeCommand({action:'request_keeper',id:'tree'})).not.toBeNull();
  expect(seedTreeCommand({action:'request_keeper',id:'tree',member:'other'})).toBeNull();
  expect(seedTreeCommand({action:'answer_keeper_request',id:'tree',member:'alice',role:'keeper'})).not.toBeNull();
  expect(seedTreeCommand({action:'answer_keeper_request',id:'tree',member:'alice',role:'admin'})).toBeNull();
  expect(seedTreeCommand({action:'decline_keeper_request',id:'tree',member:'alice',role:'keeper'})).toBeNull();
});
it('accepts ordered published-media paths without caller-supplied tree authority or face fields', () => {
  const command={action:'set_pictures',id:'tree',paths:['users/alice/a.png','users/alice/b.webp']};
  expect(seedTreeCommand(command)).toEqual(command);
  expect(seedTreeCommand({...command,paths:[]})).not.toBeNull();
  for(const extra of [{paths:['https://external.test/a.png']},{paths:['users/../a.png']},
    {paths:['users/alice/a.png','users/alice/a.png']},{imageUrl:'forged'},{uid:'other'}]) {
    expect(seedTreeCommand({...command,...extra})).toBeNull();
  }
});
describe('independent planting and editing input', () => {
  const plant = { action:'plant',name:' Willow ',body:'A living tree',treeType:'LIFETREE',visibility:'private' };
  it('binds tree birth at the server and validates location pairs', () => {
    expect(seedTreeCommand(plant)).toEqual({ ...plant,name:'Willow' });
    expect(seedTreeCommand({ ...plant,latitude:45,longitude:-180 })).not.toBeNull();
    for (const addition of [{ anchorUid:'other' },{ validated:true },{ latestHash:'forged' },{ domain:'other.example' },
      { latitude:91,longitude:0 },{ latitude:0 },{ latitude:NaN,longitude:0 },{ body:'a'.repeat(64001) },{ treeType:'BED' }]) {
      expect(seedTreeCommand({ ...plant,...addition })).toBeNull();
    }
  });
  it('keeps secret trees private and excludes immutable fields from editing', () => {
    expect(seedTreeCommand({ ...plant,treeType:'SECRET' })).not.toBeNull();
    expect(seedTreeCommand({ ...plant,treeType:'SECRET',visibility:'public' })).toBeNull();
    const edit = { action:'edit',id:'tree',name:'Willow',body:'New story' };
    expect(seedTreeCommand(edit)).toEqual(edit);
    expect(seedTreeCommand({ ...edit,latitude:null,longitude:null })).not.toBeNull();
    expect(seedTreeCommand({ ...edit,latitude:null,longitude:0 })).toBeNull();
    expect(seedTreeCommand({ ...plant,latitude:null,longitude:null })).toBeNull();
    expect(seedTreeCommand({ ...edit,visibility:'public' })).toBeNull();
    expect(seedTreeCommand({ ...edit,treeType:'LIFETREE' })).toBeNull();
  });
});

it('allows only the caller to resign a tree keeper seat', () => {
  expect(seedTreeCommand({action:'resign_keeper',id:'tree'})).toEqual({action:'resign_keeper',id:'tree'});
  for(const extra of [{uid:'other'},{successor:'other'},{anchorUid:'other'},{body:''}]) {
    expect(seedTreeCommand({action:'resign_keeper',id:'tree',...extra})).toBeNull();
  }
});
