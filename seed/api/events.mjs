import {seedEventDraft} from '../../src/domain/seedEvent.mjs';
import {judgeEventCircle,eventCircleDraft,eventCircleMemberUids,rootsABeing,eventDuplicationPayload,eventDraftContent,publicNameOf,createBlock} from '../generated/chain.mjs';
// The caller must hold parent/profile/current-authority locks through the
// atomic insert of this record, its protected proof and its descends_from link.
export async function prepareEventDuplication({uid,parentId,context,id,lid,mintedAt}) {
  const judgment=eventDuplicationPayload({uid,parentId,parent:context.parent??null,profile:context.profile??{},isHand:context.isHand===true});
  if(judgment.outcome==='reject')throw Object.assign(new Error('Event duplication refused'),{code:'EVENT_REJECTED',refusal:judgment.refusal});
  const {payload,root}=judgment,hash=await createBlock(root,payload,mintedAt);
  return {record:{...payload,id,lid,loveCount:0,commentCount:0,mintedAt,previousHash:root,hash,createdAt:new Date(mintedAt).toISOString()},
    birthProof:{preimage:JSON.stringify(payload)+root+mintedAt,mintedAt,authorId:uid,visibility:payload.visibility},
    lineage:{from:id,rel:'descends_from',to:parentId}};
}

// The locked database context enforces authority and resolves published media.
export function prepareEventContent(input,context) {
  const draft=seedEventDraft(input);if(!draft)throw Object.assign(new Error('Invalid event draft'),{code:'22023'});
  const judged=eventDraftContent(draft,!!context.community);
  if(judged.outcome==='reject')throw Object.assign(new Error('Event draft refused'),{code:'EVENT_REJECTED',refusal:judged.refusal});
  return {...judged.content,...(draft.paths===undefined?{}:{imageUrls:[...(context.images??[])],imageUrl:context.images?.[0]??''})};
}
export async function prepareEventBirth({uid,input,context,id,lid,nodeDomain,mintedAt}) {
  if(input?.action!=='create'||!uid||typeof nodeDomain!=='string'||!nodeDomain
    ||(context.community&&typeof input.communityId!=='string'))throw Object.assign(new Error('Invalid event birth'),{code:'22023'});
  const content=prepareEventContent(input,context),profile=context.profile??{},community=context.community;
  const displayName=typeof profile.displayName==='string'&&profile.displayName?profile.displayName:typeof profile.name==='string'?profile.name:undefined;
  const payload={...content,type:'event',domain:community?.domain||nodeDomain,authorId:uid,
    authorName:publicNameOf({displayName,anonymous:!!profile.anonymous})||'A being',
    ...(typeof profile.photoURL==='string'&&profile.photoURL?{authorPhoto:profile.photoURL}:{}),
    ...(community?{communityId:input.communityId,communityName:community.name}:{} )};
  const root=community?'COMMUNITY_EVENT':'EVENT',hash=await createBlock(root,payload,mintedAt);
  return {record:{...payload,id,lid,loveCount:0,commentCount:0,mintedAt,previousHash:root,hash,createdAt:new Date(mintedAt).toISOString()},
    birthProof:{preimage:JSON.stringify(payload)+root+mintedAt,mintedAt,authorId:uid,visibility:payload.visibility}};
}

// Preparation only: the SQL adapter must lock the lineage root, current host,
// participant trees/links and destination circle until the write commits.
export function prepareEventCircle({uid,input,context,id,lid,mintedAt}) {
  const root=context.root??{},event=context.event??{};
  const trees=[...new Map((context.trees??[]).filter(tree=>tree&&typeof tree.id==='string'&&tree.id&&rootsABeing(tree)).map(tree=>[tree.id,tree])).values()];
  const judgment=judgeEventCircle({isEvent:event.type==='event'&&root.type==='event',isHand:!!uid&&context.isHand===true,
    rootCircleCommunityId:root.circleCommunityId,participantTreeCount:trees.length});
  if(judgment.outcome==='reject')throw Object.assign(new Error('Event circle refused'),{code:'EVENT_REJECTED',refusal:judgment.refusal});
  const members=eventCircleMemberUids(uid,trees.map(tree=>typeof tree.anchorUid==='string'?tree.anchorUid:null));
  if(judgment.outcome==='gather') {
    if(context.community?.formation!=='event'||context.community?.rootEventId!==context.rootId)throw Object.assign(new Error('Event circle needs review'),{code:'EVENT_REJECTED',refusal:'event_circle_binding_invalid'});
    return {action:'gather',communityId:judgment.communityId,members,trees:trees.map(tree=>tree.id)};
  }
  const draft=eventCircleDraft({eventId:context.rootId,eventTitle:root.title,eventDomain:root.domain,eventImageUrl:root.imageUrl,formerUid:uid,name:input.name});
  return {action:'form',communityId:id,members,trees:trees.map(tree=>tree.id),community:{...draft,id,lid,
    // The independent join boundary reads door explicitly; invited visibility is
    // descriptive legacy metadata, not a membership gate by itself.
    door:'invite',createdAt:new Date(mintedAt).toISOString(),updatedAt:new Date(mintedAt).toISOString()}};
}
