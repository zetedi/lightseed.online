import {expect,it} from 'vitest';
import {seedVisionQuery} from '../src/domain/seedVision.mjs';
import {seedRequest} from '../src/domain/seedRequest.mjs';
it('bounds vision queries and preserves microsecond cursor precision',()=>{
  const after=JSON.stringify(['2026-10-25T12:00:00.123456Z','vision']);
  expect(seedVisionQuery(new URLSearchParams({tree:'tree',after,limit:'10'}))).toMatchObject({tree:'tree',after:{moment:'2026-10-25T12:00:00.123456Z',id:'vision'},limit:10});
  expect(seedRequest('GET','/v1/visions?id=vision',undefined)).toMatchObject({kind:'visions',id:'vision'});
  for(const query of ['id=x&author=alice','author=','uid=admin','limit=101','tree=x&tree=y','after=not-json',
    'after='+encodeURIComponent(JSON.stringify(['2026-02-30T00:00:00.000000Z','x'])),
    'after='+encodeURIComponent(JSON.stringify(['0000-01-01T00:00:00.000000Z','x']))]) {
    expect(seedVisionQuery(new URLSearchParams(query))).toBeNull();
  }
});

it('accepts bounded vision prose and rejects identity or chain injection',async()=>{
  const {seedVisionCommand}=await import('../src/domain/seedVision.mjs');
  const birth={action:'create',title:'A garden',body:'Together',visibility:'private'};
  expect(seedVisionCommand(birth)).toEqual(birth);
  expect(seedVisionCommand({...birth,action:'edit',id:'vision'})).not.toBeNull();
  for(const extra of [{authorId:'other'},{lid:'forged'},{latestHash:'x'},{domain:'other'},{communityId:'x'},{lifetreeId:'x'},{id:'x'},{title:' '},{body:'x'.repeat(64001)},{visibility:'unknown'}])expect(seedVisionCommand({...birth,...extra})).toBeNull();
  expect(seedRequest('POST','/v1/visions/command',undefined)).toMatchObject({status:401});
  expect(seedRequest('POST','/v1/visions/command','Bearer test',true)).toEqual({kind:'visionCommand'});
});

it('bounds ordered vision pictures to distinct local uploads',async()=>{
  const {seedVisionCommand}=await import('../src/domain/seedVision.mjs');
  const command={action:'set_pictures',id:'vision',paths:['users/alice/a.webp','users/alice/b.png']};
  expect(seedVisionCommand(command)).toEqual(command);
  expect(seedVisionCommand({...command,paths:[]})).toMatchObject({paths:[]});
  for(const paths of [['users/alice/a.webp','users/alice/a.webp'],['https://elsewhere/image.png'],['../a.webp'],['thumbs/a.webp'],Array.from({length:101},(_,i)=>`users/alice/${i}.webp`)])expect(seedVisionCommand({...command,paths})).toBeNull();
  expect(seedVisionCommand({...command,authorId:'other'})).toBeNull();
});

it('accepts an explicit release without authority or cascade overrides',async()=>{
  const {seedVisionCommand}=await import('../src/domain/seedVision.mjs');
  expect(seedVisionCommand({action:'release',id:'vision'})).toEqual({action:'release',id:'vision'});
  for(const command of [{action:'release'}, {action:'release',id:'vision',authorId:'alice'}, {action:'release',id:'vision',deleteChain:true}])expect(seedVisionCommand(command)).toBeNull();
});
