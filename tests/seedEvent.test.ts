import {expect,it} from 'vitest';
import {eventDuplicationPayload} from '../src/domain/eventDuplication';
import {seedEventCommand} from '../src/domain/seedEvent.mjs';
import {prepareEventDuplication} from '../seed/api/events.mjs';
import {sha256} from '../src/domain/chain/hash';
const parent={type:'event',title:'Gathering',body:'Welcome',content:'Welcome',eventDate:'2026-11-01T18:00',eventEndDate:'2026-11-02T12:00',eventLocation:'Garden',eventMaxParticipants:21,
  communityId:'garden',communityName:'Garden',domain:'garden.example',visibility:'community',imageUrls:['/picture'],webLinks:[{url:'https://example.test',title:'More'}],
  id:'old-id',lid:'old-lid',authorId:'alice',authorName:'Alice',authorSignature:{sig:'old'},hash:'old-seal',loveCount:10,commentCount:3,circleCommunityId:'formed-circle',participantUids:['alice']};
const args=()=>({uid:'bob',parentId:'parent',parent,profile:{displayName:'Bob'},isHand:true});
it('copies the gathering frame and lineage while resetting identity, attribution and social state',()=>{
  const result=eventDuplicationPayload(args());expect(result.outcome).toBe('copy');if(result.outcome!=='copy')return;
  expect(result.root).toBe('COMMUNITY_EVENT');expect(result.payload).toMatchObject({title:'Gathering',eventDate:parent.eventDate,eventEndDate:parent.eventEndDate,communityId:'garden',visibility:'community',authorId:'bob',authorName:'Bob',descendsFromId:'parent',lineageRootId:'parent',generation:1});
  for(const key of ['id','lid','hash','authorSignature','circleCommunityId','participantUids','loveCount','commentCount'])expect(result.payload).not.toHaveProperty(key);
  expect(result.payload.imageUrls).not.toBe(parent.imageUrls);expect(result.payload.webLinks).toEqual(parent.webLinks);
});
it('preserves lineage roots, standalone defaults and anonymous naming without inventing authority',()=>{
  const result=eventDuplicationPayload({...args(),parent:{type:'event',lineageRootId:'root',generation:2},profile:{displayName:'Private name',anonymous:true}});
  expect(result).toMatchObject({outcome:'copy',root:'EVENT',payload:{generation:3,lineageRootId:'root',visibility:'public'}});
  if(result.outcome==='copy')expect(result.payload.authorName).not.toBe('Private name');
  expect(eventDuplicationPayload({...args(),isHand:false})).toMatchObject({refusal:'event_duplicate_not_hand'});
  expect(eventDuplicationPayload({...args(),parent:null})).toMatchObject({refusal:'event_circle_not_event'});
  expect(eventDuplicationPayload({...args(),parent:{type:'offering'}})).toMatchObject({refusal:'event_circle_not_event'});
  expect(eventDuplicationPayload({...args(),parent:{type:'event',generation:Number.MAX_SAFE_INTEGER}})).toMatchObject({refusal:'event_invalid_lineage'});
});
it('seals a fresh standalone copy with a protected portable proof and a separate lineage edge',async()=>{
  const {record,birthProof,lineage}=await prepareEventDuplication({uid:'bob',parentId:'parent',context:{parent,profile:{displayName:'Bob'},isHand:true},id:'copy',lid:'new-lid',mintedAt:1793232000000});
  expect(record).toMatchObject({id:'copy',lid:'new-lid',previousHash:'COMMUNITY_EVENT',loveCount:0,commentCount:0,authorId:'bob'});
  expect(lineage).toEqual({from:'copy',rel:'descends_from',to:'parent'});
  expect(record.hash).toBe(await sha256(birthProof.preimage));expect(record).not.toHaveProperty('birthPreimage');expect(record).not.toHaveProperty('lifetreeId');
});
it('accepts only a bounded event identifier at the duplicate command boundary',()=>{
  expect(seedEventCommand({action:'duplicate',id:'event'})).toEqual({action:'duplicate',id:'event'});
  for(const value of [null,[],{action:'duplicate',id:''},{action:'duplicate',id:'x'.repeat(513)},{action:'duplicate',id:'event',authorId:'bob'},{action:'duplicate',id:'event',generation:0},{action:'edit',id:'event'}])expect(seedEventCommand(value)).toBeNull();
});

it('bounds event drafts without admitting identity, lineage or direct media URLs',async()=>{
  const {seedEventDraft}=await import('../src/domain/seedEvent.mjs');
  const draft={action:'create',title:' Gathering ',body:' Welcome '};
  expect(seedEventDraft(draft)).toMatchObject({title:'Gathering',body:'Welcome',paths:[],eventDate:'',eventEndDate:'',eventMaxParticipants:null,webLinks:[],visibility:'public'});
  for(const patch of [{authorId:'other'},{domain:'foreign.example'},{hash:'forged'},{generation:2},{lifetreeId:'tree'},{imageUrl:'https://example.test/image'},{paths:['same','same']},{eventMaxParticipants:0},{eventMaxParticipants:1.5},{visibility:'circle'},{webLinks:[{url:'https://example.test',unknown:true}]}])expect(seedEventDraft({...draft,...patch})).toBeNull();
  expect(seedEventDraft({...draft,action:'edit',id:'event'})).not.toHaveProperty('paths');
  expect(seedEventDraft({...draft,action:'edit',id:'event',paths:[]})).toMatchObject({paths:[]});
  expect(seedEventCommand(draft)).toMatchObject({action:'create',title:'Gathering'});
});
it('applies shared event spans, place visibility and normalized links to drafts',async()=>{
  const {prepareEventContent}=await import('../seed/api/events.mjs');
  const draft={action:'create',title:'Retreat',body:'Welcome',eventDate:'2026-11-01T18:00',eventEndDate:'2026-11-02T12:00',webLinks:[{url:'example.test',label:' Visit  us '}]};
  expect(prepareEventContent(draft,{images:['/v1/media?path=published']})).toMatchObject({content:'Welcome',webLinks:[{url:'https://example.test/',label:'Visit us'}],imageUrls:['/v1/media?path=published']});
  for(const patch of [{eventEndDate:'2026-10-31T12:00'},{eventDate:'',eventEndDate:'2026-11-02T12:00'},{eventDate:'not a date'},{visibility:'community'},{webLinks:[{url:'javascript:alert(1)'}]}])expect(()=>prepareEventContent({...draft,...patch},{})).toThrow();
  expect(()=>prepareEventContent({...draft,visibility:'node'},{community:{id:'garden'}})).toThrow();
  expect(prepareEventContent({...draft,visibility:'community'},{community:{id:'garden'}}).visibility).toBe('community');
});
it('prepares event births with server attribution and keeps picture preservation explicit for edits',async()=>{
  const {prepareEventBirth,prepareEventContent}=await import('../seed/api/events.mjs');
  const draft={action:'create',title:'Gathering',body:'Welcome',communityId:'garden',visibility:'community'};
  const {record,birthProof}=await prepareEventBirth({uid:'bob',input:draft,context:{profile:{displayName:'Private name',anonymous:true},community:{name:'Garden',domain:'garden.example'},images:[]},id:'event',lid:'lid',nodeDomain:'node.example',mintedAt:1793232000000});
  expect(record).toMatchObject({authorId:'bob',communityId:'garden',communityName:'Garden',domain:'garden.example',previousHash:'COMMUNITY_EVENT',loveCount:0});
  expect(record.authorName).not.toBe('Private name');expect(record.hash).toBe(await sha256(birthProof.preimage));expect(record).not.toHaveProperty('birthPreimage');
  const edit=prepareEventContent({action:'edit',id:'event',title:'Retold',body:'New words'},{});
  for(const key of ['authorId','hash','lid','imageUrls','communityId','domain'])expect(edit).not.toHaveProperty(key);
});

it('prepares one event circle from unique rooted trees and explicit invitation-only membership',async()=>{
  const {prepareEventCircle}=await import('../seed/api/events.mjs');
  const context={event:{type:'event'},rootId:'root',root:{type:'event',title:'Gathering',domain:'WWW.GARDEN.EXAMPLE',imageUrl:'/picture'},isHand:true,
    trees:[{id:'oak',anchorUid:'alice'},{id:'oak',anchorUid:'alice'},{id:'willow',anchorUid:'bob'},{id:'bed',treeType:'BED',anchorUid:'bed-owner'},{id:'secret',treeType:'SECRET',anchorUid:'secret-owner'}]};
  const result=prepareEventCircle({uid:'bob',input:{name:''},context,id:'circle',lid:'circle-lid',mintedAt:1793318400000});
  expect(result).toMatchObject({action:'form',communityId:'circle',members:['bob','alice'],trees:['oak','willow'],community:{formation:'event',rootEventId:'root',anchorUid:'bob',name:'Gathering Circle',domain:'',bornOn:'garden.example',door:'invite',visibility:'invited'}});
  expect(result.community).not.toHaveProperty('members');expect(result.community).not.toHaveProperty('participants');
  expect(()=>prepareEventCircle({uid:'bob',input:{},context:{...context,isHand:false},id:'c',lid:'l',mintedAt:0})).toThrow();
  expect(()=>prepareEventCircle({uid:'bob',input:{},context:{...context,trees:[{id:'bed',treeType:'BED'}]},id:'c',lid:'l',mintedAt:0})).toThrow();
});
it('gathers into the remembered lineage circle only when its binding still stands',async()=>{
  const {prepareEventCircle}=await import('../seed/api/events.mjs');
  const context={event:{type:'event'},rootId:'root',root:{type:'event',circleCommunityId:'circle'},isHand:true,trees:[{id:'oak',anchorUid:'alice'}],community:{formation:'event',rootEventId:'root'}};
  const params={uid:'bob',input:{},context,id:'unused',lid:'unused',mintedAt:0};
  expect(prepareEventCircle(params)).toEqual({action:'gather',communityId:'circle',members:['bob','alice'],trees:['oak']});
  expect(()=>prepareEventCircle({...params,context:{...context,community:{formation:'event',rootEventId:'other'}}})).toThrow(/needs review/);
  expect(()=>prepareEventCircle({...params,context:{...context,root:null}})).toThrow(/refused/);
});
it('bounds event-circle requests without accepting caller-supplied membership',async()=>{
  const {seedEventCircleCommand}=await import('../src/domain/seedEvent.mjs');
  expect(seedEventCircleCommand({action:'form_circle',id:'event',name:' Circle '})).toEqual({action:'form_circle',id:'event',name:'Circle'});
  for(const patch of [{members:['alice']},{communityId:'foreign'},{name:'x'.repeat(121)},{id:''}])expect(seedEventCircleCommand({action:'form_circle',id:'event',...patch})).toBeNull();
  expect(seedEventCommand({action:'form_circle',id:'event'})).toEqual({action:'form_circle',id:'event',name:''});
});
