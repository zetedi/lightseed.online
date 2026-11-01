import {seedOfferingCommand} from '../src/domain/seedOffering.mjs';
import {seedRequest} from '../src/domain/seedRequest.mjs';
import {expect,it} from 'vitest';
import {offeringTwinRecords} from '../src/domain/offeringTwins';
import {offeringTwinBlocks} from '../functions/src/offering';
import {prepareOfferingAcceptance} from '../seed/api/offerings.mjs';
import {computeCanonicalHash} from '../src/domain/chain/verify';
const offering={id:'offer',lid:'offering-lid',title:'Care',authorId:'alice',authorName:'Alice',domain:'node.example',visibility:'node',
  toKind:'vision' as const,toId:'vision',toName:'Dream',fromTreeId:'tree',fromTreeName:'Oak'};
it('preserves the existing reciprocal agreement record shape for trees and visions',()=>{
  for(const toKind of ['tree','vision'] as const) {
    const source={...offering,toKind},acceptor={uid:'bob',name:'Bob'};
    expect(offeringTwinRecords(source,acceptor,{title:'Offering accepted',fromBody:'Care — offered to Dream, accepted.',toBody:'Care — offered by Oak, accepted.'}))
      .toEqual(offeringTwinBlocks(source,acceptor));
  }
});
const context=()=>({offeringId:'offer',offering:{type:'offering',lid:'offering-lid',title:'Care',authorId:'alice',authorName:'Alice',domain:'node.example',visibility:'node',
  offeredToKind:'vision',offeredToId:'vision',offeringFromTreeId:'tree'},
  source:{name:'Oak',latestHash:'from-head',blockHeight:4},receiver:{title:'Dream',genesisHash:'to-genesis',blockHeight:0},
  sourceStanding:true,receiverStanding:true,profile:{displayName:'Bob'}});
const params=(value=context())=>({uid:'bob',context:value,fromId:'from',fromLid:'01900000-0000-7000-8000-000000000001',
  toId:'to',toLid:'01900000-0000-7000-8000-000000000002',mintedAt:1793145600000});
it('seals two independent chain positions without inventing participant signatures or light transfers',async()=>{
  const result=await prepareOfferingAcceptance(params());
  expect(result).toMatchObject({fromHeight:5,toHeight:1,fromRecord:{previousHash:'from-head',authorId:'alice',lifetreeId:'tree'},
    toRecord:{previousHash:'to-genesis',authorId:'bob',visionId:'vision'}});
  for(const record of [result.fromRecord,result.toRecord]) {
    expect(record.hash).toBe(await computeCanonicalHash(record.previousHash,record.mintedAt,record));
    expect(record).not.toHaveProperty('authorSignature');expect(record.visibility).toBe('node');
  }
  expect(result.fromRecord.hash).not.toBe(result.toRecord.hash);
});
it('rechecks both sides of authority and terminal offering status before sealing',async()=>{
  for(const patch of [{sourceStanding:false},{receiverStanding:false}])
    await expect(prepareOfferingAcceptance(params({...context(),...patch}))).rejects.toMatchObject({code:'OFFERING_REJECTED',refusal:'permission-denied'});
  const closed=context();Object.assign(closed.offering,{offeringStatus:'accepted'});
  await expect(prepareOfferingAcceptance(params(closed))).rejects.toMatchObject({code:'OFFERING_REJECTED',refusal:'failed-precondition'});
  const dead=context();Object.assign(dead.receiver,{diedAt:'2026-01-01T00:00:00Z'});
  await expect(prepareOfferingAcceptance(params(dead))).rejects.toMatchObject({refusal:'failed-precondition'});
  const huge=context();huge.source.blockHeight=Number.MAX_SAFE_INTEGER;
  await expect(prepareOfferingAcceptance(params(huge))).rejects.toMatchObject({code:'22023'});
});

it('accepts only an authenticated bounded offering identifier at the command boundary',()=>{
  expect(seedOfferingCommand({action:'accept',id:'offering'})).toEqual({action:'accept',id:'offering'});
  for(const value of [null,[],{action:'accept',id:''},{action:'accept',id:'x'.repeat(513)},
    {action:'accept',id:'offer',uid:'alice'},{action:'accept',id:'offer',fromRecord:{}},{action:'erase',id:'offer'}])expect(seedOfferingCommand(value)).toBeNull();
  expect(seedRequest('POST','/v1/offerings/command',null,false)).toMatchObject({status:401});
  expect(seedRequest('GET','/v1/offerings/command','Bearer x',true)).toMatchObject({status:405});
  expect(seedRequest('POST','/v1/offerings/command','Bearer x',true)).toEqual({kind:'offeringCommand'});
});

it('validates complete creation drafts without accepting client attribution, seals or answers',async()=>{
  const {seedOfferingCreation}=await import('../src/domain/seedOffering.mjs');
  const draft={action:'create',kind:'service',title:' Care ',body:' A helping hand ',appreciation:21};
  expect(seedOfferingCreation(draft)).toMatchObject({title:'Care',body:'A helping hand',visibility:'public',paths:[]});
  for(const patch of [{authorId:'alice'},{hash:'forged'},{offeringStatus:'accepted'},{appreciation:1.5},{appreciation:0},
    {kind:'code'},{url:'javascript:alert(1)'},{bedId:'bed'},{toKind:'tree',toId:'oak'},{paths:['same','same']},{visibility:'anyone'}])
    expect(seedOfferingCreation({...draft,...patch})).toBeNull();
  expect(seedOfferingCreation({...draft,toKind:'vision',toId:'dream',fromTreeId:'oak'})).not.toBeNull();
  expect(seedOfferingCreation({...draft,kind:'bed',bedId:'bed'})).not.toBeNull();
  expect(seedOfferingCreation({...draft,kind:'product'})).not.toBeNull();
  expect(seedOfferingCreation({...draft,kind:'code',url:'https://example.test/change'})).not.toBeNull();
  expect(seedOfferingCommand(draft)).toMatchObject({action:'create',title:'Care'});
});
it('prepares server-attributed standalone offering births with a portable legacy preimage',async()=>{
  const {prepareOfferingBirth}=await import('../seed/api/offerings.mjs');
  const {sha256}=await import('../src/domain/chain/hash');
  const input={action:'create',kind:'service',title:'Care',body:'A helping hand',appreciation:21,toKind:'vision',toId:'dream',fromTreeId:'oak',paths:['image']};
  const {record,birthProof,notice}=await prepareOfferingBirth({uid:'alice',input,id:'offer',lid:'01900000-0000-7000-8000-000000000001',nodeDomain:'node.example',mintedAt:1793145600000,noticeId:'notice',noticeLid:'01900000-0000-7000-8000-000000000002',
    context:{profile:{uid:'alice',displayName:'Private name',anonymous:true},source:{name:'Oak'},receiver:{title:'Dream',authorId:'bob',lid:'vision-lid',rootTreeId:'willow'},images:['/v1/media?path=image']}});
  expect(record).toMatchObject({type:'offering',authorId:'alice',authorName:'Oak',offeringStatus:'open',offeringFromTreeName:'Oak',
    offeredToName:'Dream',offeredToKeeperUid:'bob',offeredToRootTreeId:'willow',imageUrl:'/v1/media?path=image',previousHash:'OFFERING'});
  expect(record.hash).toBe(await sha256(birthProof.preimage));
  expect(notice).toMatchObject({recipientUid:'bob',visibility:'private',participantUids:['alice','bob'],previousHash:'OFFER_NOTICE'});
  expect(birthProof.preimage).not.toContain('Private name');expect(record).not.toHaveProperty('birthPreimage');expect(record).not.toHaveProperty('authorSignature');
  expect(record).not.toHaveProperty('latestHash');expect(record).not.toHaveProperty('offeringSuspendedLight');
  const edited={...record,title:'Retold',body:'Changed'};
  expect(edited).not.toHaveProperty('birthPreimage');expect(await sha256(birthProof.preimage)).toBe(record.hash);
});

it('keeps lifecycle commands narrow and preserves pictures unless explicitly supplied',()=>{
  for(const action of ['withdraw','decline']) {
    expect(seedOfferingCommand({action,id:'offer'})).toEqual({action,id:'offer'});
    expect(seedOfferingCommand({action,id:'offer',authorId:'alice'})).toBeNull();
  }
  expect(seedOfferingCommand({action:'set_active',id:'offer',active:false})).toEqual({action:'set_active',id:'offer',active:false});
  expect(seedOfferingCommand({action:'set_active',id:'offer',active:'false'})).toBeNull();
  const edit={action:'edit',id:'offer',title:'New words',body:'Retold',appreciation:21,url:'',visibility:'private'};
  expect(seedOfferingCommand(edit)).not.toHaveProperty('paths');
  expect(seedOfferingCommand({...edit,paths:[]})).toMatchObject({paths:[]});
  expect(seedOfferingCommand({...edit,kind:'bed'})).toBeNull();
  expect(seedOfferingCommand({...edit,offeringStatus:'accepted'})).toBeNull();
});
