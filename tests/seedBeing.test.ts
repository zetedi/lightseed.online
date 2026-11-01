import {expect,it} from 'vitest';
import {isLid} from '../src/domain/dataAuthority';
import {seedBeingQuery,seedBeingResult} from '../src/domain/seedBeing.mjs';
import {seedRequest} from '../src/domain/seedRequest.mjs';
const lid='019a1400-0000-7000-8000-000000000001';
it('accepts exactly one portable name and refuses identity or collection overrides',()=>{
  expect(isLid(lid)).toBe(true);
  expect(seedBeingQuery(new URLSearchParams({lid}))).toEqual({kind:'being',lid});
  for(const query of ['', 'lid=bad',`lid=${lid}&lid=${lid}`,`lid=${lid}&uid=alice`,`lid=${lid}&collection=users`,`lid=${lid}&limit=1`,`lid=${lid.toUpperCase()}`])
    expect(seedRequest('GET','/v1/beings?'+query,undefined)).toMatchObject({status:400});
  expect(seedRequest('GET','/v1/beings?lid='+lid,'forged')).toMatchObject({status:401});
  expect(seedRequest('POST','/v1/beings?lid='+lid,undefined)).toMatchObject({status:405});
});
it('never silently chooses between visible records with the same portable name',()=>{
  const tree={kind:'tree',id:'local-tree',lid};
  expect(seedBeingResult([])).toEqual({being:null});
  expect(seedBeingResult([tree])).toEqual({being:tree});
  expect(()=>seedBeingResult([tree,{kind:'vision',id:'another',lid}])).toThrow('Portable identity needs review');
});
