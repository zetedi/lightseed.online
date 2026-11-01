import {expect,it} from 'vitest';
import {seedBlockCommand} from '../src/domain/seedBlock.mjs';
import {seedRequest} from '../src/domain/seedRequest.mjs';
it('accepts only the mint envelope and leaves block semantics to shared chain law',()=>{
  const value={action:'mint',on:'tree',id:'tree',block:{type:'tree_growth',body:'Care'}};
  expect(seedBlockCommand(value)).toEqual(value);
  for(const patch of [{uid:'other'},{hash:'forged'},{action:'unmint'},{on:'person'},{id:''},{id:'bad\nid'},{block:[]},{signature:{sig:'bad'}}])expect(seedBlockCommand({...value,...patch})).toBeNull();
  expect(seedRequest('POST','/v1/blocks/command',undefined)).toMatchObject({status:401});
  expect(seedRequest('POST','/v1/blocks/command','Bearer token',true)).toEqual({kind:'blockCommand'});
  expect(seedRequest('GET','/v1/blocks/command',undefined)).toMatchObject({status:405});
});
