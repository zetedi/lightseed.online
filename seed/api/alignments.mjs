import {judgeAlignmentAcceptance,alignmentTwinContent,blockRecordOf,computeCanonicalHash,BLOCK_HASH_VERSION} from '../generated/chain.mjs';
// Preparation only. The calling transaction must hold the proposal, both tree
// heads and current standing until the paired records and answer commit together.
export async function prepareAlignmentAcceptance({uid,id,context,nodeDomain,mintedAt,sourceId,sourceLid,targetId,targetLid}) {
  const proposal=context.proposal??{},source=context.source??{},target=context.target??{};
  const judgment=judgeAlignmentAcceptance({uid,proposal:{...proposal,exists:!!context.proposal},
    source:{exists:!!context.source,carer:context.sourceCarer===true},target:{exists:!!context.target,carer:context.targetCarer===true}});
  if(judgment.outcome==='reject')throw Object.assign(new Error('Alignment refused'),{code:'ALIGNMENT_REJECTED',refusal:judgment.refusal});
  const build=async(bearer,other,bearerId,otherId,authorId,recordId,lid)=>{
    const storedHeight=bearer.blockHeight??0;
    const height=Number(storedHeight)+1;
    if(!['number','string'].includes(typeof storedHeight)||(typeof storedHeight==='string'&&!/^[0-9]+$/.test(storedHeight))||!Number.isSafeInteger(height)||height<1)throw Object.assign(new Error('Invalid chain height'),{code:'22023'});
    const previousHash=String(bearer.latestHash||bearer.genesisHash||'0');
    const content=alignmentTwinContent(id,otherId,{title:'Alignment',body:`Aligned with ${typeof other.name==='string'&&other.name?other.name:'another tree'}.`});
    const record=blockRecordOf({on:'tree',bearerId,content,authorId,lid,id:recordId,
      domain:typeof bearer.domain==='string'&&bearer.domain?bearer.domain:nodeDomain,mintedAt,previousHash});
    return {record:{...record,hash:await computeCanonicalHash(previousHash,mintedAt,record),hashVersion:BLOCK_HASH_VERSION,createdAt:new Date(mintedAt).toISOString()},height};
  };
  const [from,to]=await Promise.all([
    build(source,target,proposal.initiatorTreeId,proposal.targetTreeId,proposal.initiatorUid,sourceId,sourceLid),
    build(target,source,proposal.targetTreeId,proposal.initiatorTreeId,proposal.targetUid,targetId,targetLid),
  ]);
  return {fromRecord:from.record,toRecord:to.record,fromHeight:from.height,toHeight:to.height};
}
