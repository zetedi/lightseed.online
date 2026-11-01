import {expect,it} from 'vitest';
import {seedLinkCommand,SEED_INTERBEING_RELATIONS} from '../src/domain/seedLink.mjs';
import {INTERBEING_RELATIONS} from '../src/domain/interbeingMatrix';
it('matches the community relationship vocabulary and refuses self-attestations or reciprocal flags',()=>{
  expect(SEED_INTERBEING_RELATIONS).toEqual(INTERBEING_RELATIONS);
  for(const rel of INTERBEING_RELATIONS){
    const command={action:'link',from:'garden',rel,to:'orchard'};
    expect(seedLinkCommand(command)).toEqual(command);
    expect(seedLinkCommand({...command,to:'garden'})).toBeNull();
    expect(seedLinkCommand({...command,reciprocal:true})).toBeNull();
  }
});
import {seedRequest} from '../src/domain/seedRequest.mjs';
it('bounds care commands and keeps role grants and provenance out of generic writes',()=>{
  expect(seedLinkCommand({action:'link',from:'tree',rel:'participant',to:'vision'})).toEqual({action:'link',from:'tree',rel:'participant',to:'vision'});
  expect(seedLinkCommand({action:'link',from:'tree',rel:'grows_in',to:'garden'})).toEqual({action:'link',from:'tree',rel:'grows_in',to:'garden'});
  const command={action:'link',from:'alice',rel:'guardian',to:'tree'};
  expect(seedLinkCommand(command)).toEqual(command);
  expect(seedLinkCommand({...command,action:'unlink',rel:'observer'})).not.toBeNull();
  for(const patch of [{rel:'keeper'},{rel:'member'},{rel:'invited_by'},{rel:'observer'},{from:''},{to:'a b'},
    {uid:'admin'},{createdAt:'forged'},{lid:'forged'},{weight:100}])expect(seedLinkCommand({...command,...patch})).toBeNull();
  expect(seedRequest('POST','/v1/links/command',undefined)).toMatchObject({status:401});
  expect(seedRequest('POST','/v1/links/command','verified',true)).toEqual({kind:'linkCommand'});
  expect(seedRequest('POST','/v1/links/command?uid=bob','verified',true)).toMatchObject({status:405});
});
