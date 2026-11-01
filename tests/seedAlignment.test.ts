import {expect,it} from 'vitest';
import {judgeAlignmentAcceptance,alignmentTwinContent,type AlignmentAcceptanceFacts} from '../src/domain/alignment';
import {seedAlignmentCommand,seedAlignmentQuery} from '../src/domain/seedAlignment.mjs';
import {seedRequest} from '../src/domain/seedRequest.mjs';
import {prepareAlignmentAcceptance} from '../seed/api/alignments.mjs';
import {computeCanonicalHash} from '../src/domain/chain/verify';

const facts=():AlignmentAcceptanceFacts=>({uid:'bob',proposal:{exists:true,status:'PENDING',initiatorUid:'alice',targetUid:'bob',initiatorTreeId:'oak',targetTreeId:'willow'},source:{exists:true,carer:true},target:{exists:true,carer:true}});
it('requires the named pulse author and both current tree carers for alignment acceptance',()=>{
  expect(judgeAlignmentAcceptance(facts())).toEqual({outcome:'accept'});
  for(const side of ['source','target'] as const) {
    const stale=facts();stale[side].carer=false;
    expect(judgeAlignmentAcceptance(stale)).toMatchObject({refusal:'block_not_carer'});
    const missing=facts();missing[side].exists=false;
    expect(judgeAlignmentAcceptance(missing)).toMatchObject({refusal:'block_no_bearer'});
  }
  expect(judgeAlignmentAcceptance({...facts(),uid:'other-keeper'})).toMatchObject({refusal:'align_not_target'});
  for(const status of ['ACCEPTED','REJECTED',null])expect(judgeAlignmentAcceptance({...facts(),proposal:{...facts().proposal,status}})).toMatchObject({refusal:'align_not_pending'});
  expect(judgeAlignmentAcceptance({...facts(),proposal:{...facts().proposal,targetTreeId:'oak'}})).toMatchObject({refusal:'align_same_tree'});
  expect(judgeAlignmentAcceptance({...facts(),proposal:{...facts().proposal,initiatorUid:42}})).toMatchObject({refusal:'align_invalid_parties'});
});
it('derives identities server-side and bounds proposal and negotiation commands',()=>{
  expect(seedRequest('POST','/v1/alignments/command',null,false)).toMatchObject({status:401});
  expect(seedRequest('POST','/v1/alignments/command','Bearer x',true)).toEqual({kind:'alignmentCommand'});
  expect(seedRequest('GET','/v1/alignments?target=me','Bearer x',true)).toMatchObject({kind:'alignments',target:true});
  const draft={action:'propose',fromTreeId:'oak',targetPulseId:'pulse'};
  expect(seedAlignmentCommand(draft)).toEqual({...draft,initiatorPulseId:'PENDING_CREATION'});
  expect(seedAlignmentCommand({...draft,initiatorPulseId:'own-pulse'})).toMatchObject({initiatorPulseId:'own-pulse'});
  for(const patch of [{targetUid:'mallory'},{initiatorUid:'mallory'},{targetTreeId:'hidden'},{status:'ACCEPTED'},{fromTreeId:''},{targetPulseId:'x'.repeat(513)},{initiatorPulseId:null}])expect(seedAlignmentCommand({...draft,...patch})).toBeNull();
  expect(seedAlignmentCommand({action:'note',id:'a',text:'  Shall we?  '})).toEqual({action:'note',id:'a',text:'Shall we?'});
  for(const text of ['', '  ', 'x'.repeat(2001),'a\0b'])expect(seedAlignmentCommand({action:'note',id:'a',text})).toBeNull();
  for(const action of ['accept','reject']) {
    expect(seedAlignmentCommand({action,id:'a'})).toEqual({action,id:'a'});
    expect(seedAlignmentCommand({action,id:'a',record:{}})).toBeNull();
  }
});
it('preserves precise pagination and limits private participant filters to the current session',()=>{
  const after=JSON.stringify(['2026-10-29T01:02:03.123456Z','a']);
  expect(seedAlignmentQuery(new URLSearchParams({target:'me',status:'PENDING',tree:'oak',after,limit:'20'}))).toMatchObject({kind:'alignments',target:true,participant:false,status:'PENDING',tree:'oak',after:{moment:'2026-10-29T01:02:03.123456Z',id:'a'},limit:20});
  expect(seedAlignmentQuery(new URLSearchParams('id=a'))).toMatchObject({id:'a'});
  for(const query of ['target=alice','participant=bob','status=open','limit=101','id=a&target=me','tree=a&tree=b','unknown=1','after=garbage'])expect(seedAlignmentQuery(new URLSearchParams(query))).toBeNull();
});
const context=()=>({proposal:{status:'PENDING',initiatorUid:'alice',targetUid:'bob',initiatorTreeId:'oak',targetTreeId:'willow'},source:{name:'Oak',latestHash:'oak-head',blockHeight:4,domain:'oak.example'},target:{name:'Willow',genesisHash:'willow-genesis',blockHeight:0},sourceCarer:true,targetCarer:true});
const params=(value:object=context())=>({uid:'bob',id:'alignment',context:value,nodeDomain:'node.example',mintedAt:1793232000000,sourceId:'from',sourceLid:'01900000-0000-7000-8000-000000000001',targetId:'to',targetLid:'01900000-0000-7000-8000-000000000002'});
it('preserves reciprocal alignment content and seals each tree at its own head',async()=>{
  expect(alignmentTwinContent('a','willow',{title:'Alignment',body:'Aligned with Willow.'})).toEqual({type:'standard',title:'Alignment',body:'Aligned with Willow.',isMatch:true,matchId:'a',matchedLifetreeId:'willow',authorName:'System',visibility:'public'});
  const result=await prepareAlignmentAcceptance(params());
  expect(result).toMatchObject({fromHeight:5,toHeight:1,fromRecord:{authorId:'alice',lifetreeId:'oak',matchedLifetreeId:'willow',previousHash:'oak-head',domain:'oak.example'},toRecord:{authorId:'bob',lifetreeId:'willow',matchedLifetreeId:'oak',previousHash:'willow-genesis',domain:'node.example'}});
  for(const record of [result.fromRecord,result.toRecord]) {
    expect(record.hash).toBe(await computeCanonicalHash(record.previousHash,record.mintedAt,record));
    expect(record).not.toHaveProperty('authorSignature');
  }
  expect(result.fromRecord.hash).not.toBe(result.toRecord.hash);
});
it('refuses missing or stale facts and corrupt chain positions before preparing records',async()=>{
  await expect(prepareAlignmentAcceptance(params({...context(),sourceCarer:false}))).rejects.toMatchObject({code:'ALIGNMENT_REJECTED',refusal:'block_not_carer'});
  await expect(prepareAlignmentAcceptance(params({...context(),source:null}))).rejects.toMatchObject({refusal:'block_no_bearer'});
  for(const blockHeight of ['bad','',' ','0x10',false,-1,0.5,Number.MAX_SAFE_INTEGER])await expect(prepareAlignmentAcceptance(params({...context(),source:{...context().source,blockHeight}}))).rejects.toMatchObject({code:'22023'});
});
