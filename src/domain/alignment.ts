// An alignment settles between the proposer and the matched pulse's author.
// Both must still stand for their named trees when the paired append occurs.
export interface AlignmentAcceptanceFacts {
  uid:string;
  proposal:{exists:boolean;status?:unknown;initiatorUid?:unknown;targetUid?:unknown;initiatorTreeId?:unknown;targetTreeId?:unknown};
  source:{exists:boolean;carer:boolean};target:{exists:boolean;carer:boolean};
}
export type AlignmentRefusal='align_not_pending'|'align_not_target'|'align_invalid_parties'|'align_same_tree'|'block_no_bearer'|'block_not_carer';
export function judgeAlignmentAcceptance(f:AlignmentAcceptanceFacts):{outcome:'accept'}|{outcome:'reject';refusal:AlignmentRefusal} {
  const reject=(refusal:AlignmentRefusal)=>({outcome:'reject' as const,refusal});
  const a=f.proposal;
  if(!a.exists||a.status!=='PENDING')return reject('align_not_pending');
  if(!f.uid||a.targetUid!==f.uid)return reject('align_not_target');
  if([a.initiatorUid,a.targetUid,a.initiatorTreeId,a.targetTreeId].some(value=>typeof value!=='string'||!value))return reject('align_invalid_parties');
  if(a.initiatorTreeId===a.targetTreeId)return reject('align_same_tree');
  if(!f.source.exists||!f.target.exists)return reject('block_no_bearer');
  if(!f.source.carer||!f.target.carer)return reject('block_not_carer');
  return {outcome:'accept'};
}

// The server supplies prose. References are sealed content, never mutable overlays.
export function alignmentTwinContent(alignmentId:string,otherTreeId:string,prose:{title:string;body:string}) {
  return {type:'standard',title:prose.title,body:prose.body,isMatch:true,matchId:alignmentId,
    matchedLifetreeId:otherTreeId,authorName:'System',visibility:'public'};
}
