import {expect,it} from 'vitest';
import {seedPersonIdentity} from '../src/domain/seedPersonIdentity.mjs';
const lid='01900000-0000-7000-8000-000000000001',fresh='01900000-0000-7000-8000-000000000002';
it('preserves the canonical person LID and fills a missing private mirror',()=>{
  expect(seedPersonIdentity({uid:'alice',person:null,user:null,newLid:fresh})).toBe(fresh);
  expect(seedPersonIdentity({uid:'alice',person:{uid:'alice',lid},user:{displayName:'Alice'},newLid:fresh})).toBe(lid);
  expect(seedPersonIdentity({uid:'alice',person:{uid:'alice',lid},user:{uid:'alice',lid},newLid:fresh})).toBe(lid);
});
it('refuses divergent identities and incomplete imports instead of assigning a fresh identity',()=>{
  const base={uid:'alice',person:{uid:'alice',lid},user:{},newLid:fresh};
  for(const extra of [{person:null,user:{lid}},{user:{lid:fresh}},{user:{uid:'other'}},{person:{uid:'other',lid}},{person:{uid:'alice',lid:'bad'}},{user:[]},{user:false},{person:false}])expect(seedPersonIdentity({...base,...extra})).toBeNull();
});
