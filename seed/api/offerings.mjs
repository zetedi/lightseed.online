import {seedOfferingCreation} from '../../src/domain/seedOffering.mjs';
import {beingPath,offeringProblem,createBlock,judgeOfferingAccept,offeringTwinRecords,publicNameOf,computeCanonicalHash,BLOCK_HASH_VERSION} from '../generated/chain.mjs';

// Transaction adapter only: callers must hold the offering, both bearers and
// authority rows until both records, both heads and the answer commit together.
// These are server agreement seals, not signatures made by either participant.
export async function prepareOfferingAcceptance({uid,context,fromId,fromLid,toId,toLid,mintedAt}) {
  const offering=context.offering??{},receiver=context.receiver??{},source=context.source??{};
  const str=value=>typeof value==='string'?value:'';
  const diedAt=receiver.diedAt;
  const diedAtMs=typeof diedAt==='string' && Number.isFinite(Date.parse(diedAt))?Date.parse(diedAt):null;
  const judgment=judgeOfferingAccept({acceptorUid:uid,offering:{exists:!!context.offering,type:offering.type,
    status:offering.offeringStatus,active:offering.offeringActive,authorId:str(offering.authorId),
    toKind:offering.offeredToKind,toId:str(offering.offeredToId),fromTreeId:str(offering.offeringFromTreeId)},
    receiver:{exists:!!context.receiver,standing:context.receiverStanding===true,diedAtMs},
    fromTree:{exists:!!context.source,standing:context.sourceStanding===true}});
  if(judgment.outcome==='reject')throw Object.assign(new Error('Offering refused'),{code:'OFFERING_REJECTED',refusal:judgment.code});
  const height=bearer=>{
    const value=(Number(bearer.blockHeight)||0)+1;
    if(!Number.isSafeInteger(value) || value<1)throw Object.assign(new Error('Invalid chain height'),{code:'22023'});
    return value;
  };
  const fromHeight=height(source),toHeight=height(receiver),profile=context.profile??{};
  const receiverName=offering.offeredToKind==='tree'?receiver.name:receiver.title;
  const name=publicNameOf({displayName:str(profile.displayName)||str(profile.name),anonymous:!!profile.anonymous,treeName:str(receiverName)})||'A being';
  const title=str(offering.title)||'An offering';
  const {from,to}=offeringTwinRecords({id:context.offeringId,lid:str(offering.lid),authorId:offering.authorId,
    authorName:str(offering.authorName)||'A being',domain:str(offering.domain),visibility:str(offering.visibility)||'public',
    toKind:offering.offeredToKind,toId:offering.offeredToId,fromTreeId:offering.offeringFromTreeId},
  {uid,name},{title:'Offering accepted',fromBody:`${title} — offered to ${str(offering.offeredToName)||str(receiverName)||'a being'}, accepted.`,
    toBody:`${title} — offered by ${str(offering.offeringFromTreeName)||str(source.name)||'a tree'}, accepted.`});
  const seal=async(content,bearer,id,lid)=>{
    const previousHash=String(bearer.latestHash||bearer.genesisHash||'0');
    const record={...content,lid,id,mintedAt,previousHash,loveCount:0,commentCount:0};
    return {...record,hash:await computeCanonicalHash(previousHash,mintedAt,record),hashVersion:BLOCK_HASH_VERSION,createdAt:new Date(mintedAt).toISOString()};
  };
  const [fromRecord,toRecord]=await Promise.all([seal(from,source,fromId,fromLid),seal(to,receiver,toId,toLid)]);
  return {fromRecord,toRecord,fromHeight,toHeight};
}

// Birth preparation is separate from authority. The future creation transaction
// supplies the locked source/receiver/bed documents and published media URLs.
export async function prepareOfferingBirth({uid,input,context,id,lid,nodeDomain,mintedAt,noticeId,noticeLid}) {
  const command=seedOfferingCreation(input);
  if(!command)throw Object.assign(new Error('Invalid offering draft'),{code:'22023'});
  const problem=offeringProblem({kind:command.kind,title:command.title,description:command.body,
    suggestedAppreciationLight:command.appreciation,url:command.url,
    ...(command.toKind?{to:{kind:command.toKind,id:command.toId},fromTreeId:command.fromTreeId}:{})});
  if(problem)throw Object.assign(new Error('Invalid offering draft'),{code:'22023'});
  const profile=context.profile??{},source=context.source??{},receiver=context.receiver??{},bed=context.bed??{};
  const str=value=>typeof value==='string'?value:'';
  const name=publicNameOf({displayName:str(profile.displayName)||str(profile.name),anonymous:!!profile.anonymous,treeName:str(source.name)})||'A being';
  const images=context.images??[];
  const payload={title:command.title,body:command.body,content:command.body,
    ...(images.length?{imageUrl:images[0],imageUrls:[...images]}:{}),
    offeringKind:command.kind,offeringAppreciationLight:command.appreciation,offeringActive:true,
    ...(command.url?{offeringUrl:command.url}:{}),
    ...(command.bedId?{offeringBedId:command.bedId,offeringBedName:str(bed.name)}:{}),
    ...(command.toKind?{offeredToKind:command.toKind,offeredToId:command.toId,
      ...(str(receiver.lid)?{offeredToLid:receiver.lid}:{}),
      offeredToName:str(command.toKind==='tree'?receiver.name:receiver.title),
      offeredToKeeperUid:str(command.toKind==='tree'?receiver.anchorUid:receiver.authorId),
      ...(command.toKind==='vision' && str(receiver.rootTreeId)?{offeredToRootTreeId:receiver.rootTreeId}:{}),
      offeringFromTreeId:command.fromTreeId,offeringFromTreeName:str(source.name),offeringStatus:'open'}:{}),
    authorId:uid,authorName:name,...(str(profile.photoURL)?{authorPhoto:profile.photoURL}:{}),
    type:'offering',domain:nodeDomain,visibility:command.visibility};
  const hash=await createBlock('OFFERING',payload,mintedAt);
  // JSONB does not preserve property order. Return proof separately for protected
  // storage/export: later prose/visibility edits must not expose an old private body
  // through a public preimage field on the mutable listing.
  const keeper=payload.offeredToKeeperUid;
  let notice=null;
  if(keeper && keeper!==uid && command.fromTreeId) {
    const partner=command.toKind==='tree'?command.toId:payload.offeredToRootTreeId||keeper;
    const door=beingPath(lid),text=`${name} offered «${command.title}» to ${payload.offeredToName||'your being'}. Answer on its leaf: ${door}`;
    notice={id:noticeId,lid:noticeLid,lifetreeId:command.fromTreeId,type:'reach',visibility:'private',
      title:`Reach: ${payload.offeringFromTreeName||'a tree'} -> ${payload.offeredToName||'a being'}`,
      body:text,content:text,door,reachTreeId:partner,reachTreeName:payload.offeredToName||'',recipientName:payload.offeredToName||'',
      recipientUid:keeper,participantUids:[uid,keeper],threadId:[command.fromTreeId,partner].sort().join('__'),seenBy:[],
      authorId:uid,authorName:payload.offeringFromTreeName||name,...(payload.authorPhoto?{authorPhoto:payload.authorPhoto}:{}),
      domain:nodeDomain,loveCount:0,commentCount:0,previousHash:'OFFER_NOTICE',hash:noticeLid,createdAt:new Date(mintedAt).toISOString()};
  }
  return {record:{...payload,id,lid,loveCount:0,commentCount:0,previousHash:'OFFERING',hash,
    createdAt:new Date(mintedAt).toISOString()},
    birthProof:{preimage:JSON.stringify(payload)+'OFFERING'+mintedAt,mintedAt,authorId:uid,visibility:command.visibility},notice};
}
