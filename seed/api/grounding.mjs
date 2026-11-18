// THE GROUND'S HANDS ON THIS SOIL (ring 2026-11-17): the origin's functions/src/grounding.ts —
// askGround, acceptGround, releaseGround — and the knock's withdrawal, grown on the independent
// node in the one pattern of seed/schema/044. FACTS are read under locks (seed.ground_context:
// both beings, the knock, the standing ground, the hand's standing over the tree, the counts);
// the PURE LAW is asked from the shared domain bundle — the very source the origin's functions
// compile (groundAskRefusal, groundAcceptRefusal, groundReleaseRefusal, groundBlocksOf); and what
// the law allowed is applied (seed.apply_*), where the soil proves the same invariants once more.
// Every refusal leaves by the law's own key, as the origin's does, so one dictionary serves both.
// This is a SERVICE: orchestration and refusals, no SQL (seed/api/db/grounding.mjs).
import {randomBytes} from 'node:crypto';
import {uuidv7} from '../../src/domain/uuidv7.mjs';
import {groundAskRefusal,groundAcceptRefusal,groundReleaseRefusal,groundBlocksOf,visionGoneGroundProse,publicNameOf,computeCanonicalHash,BLOCK_HASH_VERSION} from '../generated/chain.mjs';
import {refuse} from './organs.mjs';

/** @typedef {import('./db/grounding.mjs').GroundingRepository} GroundingRepository */

// The weight each refusal carries at the HTTP edge (the origin's REFUSAL_CODE, as statuses).
const STATUS={ground_no_request:404,ground_not_standing:404,ground_ask_author_only:403,ground_accept_carer_only:403,
  ground_release_not_yours:403,ground_already:409,ground_already_asked:409,ground_vision_full:429,ground_tree_full:429};
const deny=key=>refuse(key,STATUS[key]??409);

const text=value=>typeof value==='string'?value:'';
const docId=()=>randomBytes(20).toString('hex');
const lidAt=ms=>uuidv7(ms,randomBytes(10));
// A being's visibility as the law reads it: absent is the legacy 'public'; a non-string is unreadable.
const visibilityOf=being=>being.visibility===undefined||being.visibility===null?null:typeof being.visibility==='string'?being.visibility:'unreadable';
const treeFactsOf=tree=>({treeType:typeof tree.treeType==='string'?tree.treeType:null,visibility:visibilityOf(tree),diedAtMs:tree.diedAt?1:null});
const visionFactsOf=vision=>({authorId:text(vision.authorId),visibility:visibilityOf(vision)});
const nameOf=(profile,speaksFor)=>publicNameOf({displayName:text(profile?.displayName)||text(profile?.name),anonymous:!!profile?.anonymous,treeName:speaksFor})||'A being';

// The blocks of one act — one for each chain that still exists — sealed canonically over the very
// record that will be stored (blockRecordOf's shape: the origin's stageBlock, field for field).
// `goneVision` is the vision's last record when it is being released: it lends its title and its
// visibility to the tree's block and takes none itself (`vision` is then null).
async function blocksOf({act,visionId,treeId,vision,tree,uid,name,self,nodeDomain,mintedAt,goneVision=null}) {
  const said=vision??goneVision;
  const treeName=text(tree?.name)||'a tree',visionTitle=text(said?.title)||'a vision',grounded=act==='grounded';
  const blocks=groundBlocksOf({act,vision:{id:visionId,visibility:said?visibilityOf(said):null},tree:{id:treeId,visibility:tree?visibilityOf(tree):null},
    actor:{uid,name},self},goneVision?visionGoneGroundProse(name,visionTitle,treeName):{title:grounded?'A vision takes ground':'A ground is released',
    treeBody:grounded?`${name} grounded the vision "${visionTitle}" in ${treeName}.`:`${name} released the vision "${visionTitle}" from ${treeName}.`,
    visionBody:grounded?`${name} grounded this vision in the tree "${treeName}".`:`${name} released this vision from the tree "${treeName}".`});
  const seal=async(content,bearer,bearerKey,bearerId)=>{
    if(!bearer)return {record:null,height:null};
    const previousHash=String(bearer.latestHash||bearer.genesisHash||'0'),height=(Number(bearer.blockHeight)||0)+1;
    if(!Number.isSafeInteger(height)||height<1)throw Object.assign(new Error('Invalid chain height'),{code:'22023'});
    const {authorId,...said}=content;
    const record={lid:lidAt(mintedAt),...said,[bearerKey]:bearerId,authorId,domain:text(bearer.domain)||nodeDomain,id:docId(),
      loveCount:0,commentCount:0,mintedAt,previousHash};
    return {record:{...record,hash:await computeCanonicalHash(previousHash,mintedAt,record),hashVersion:BLOCK_HASH_VERSION,createdAt:new Date(mintedAt).toISOString()},height};
  };
  const [onTree,onVision]=await Promise.all([seal(blocks.tree,tree,'lifetreeId',treeId),seal({...blocks.vision,visionTitle},vision,'visionId',visionId)]);
  return {onTree,onVision};
}

/** @param {{repository: GroundingRepository, uid: string, command: {action: string, visionId: string, treeId: string}, nodeDomain: string}} options */
export async function groundCommand({repository,uid,command,nodeDomain}) {
  const {action,visionId,treeId}=command;
  return repository.session(uid,async s=>{
    const context=await s.context(visionId,treeId);
    const vision=context.vision??null,tree=context.tree??null,ground=context.ground??null,ask=context.ask??null;
    const cares=context.cares===true;

    if(action==='ask') {
      // One answer for "no such vision", "not yours" and "no such tree": the knock is no oracle.
      if(!vision||!tree)deny('ground_ask_author_only');
      const refusal=groundAskRefusal({askerUid:uid,vision:visionFactsOf(vision),tree:treeFactsOf(tree),alreadyGrounded:!!ground,pendingRequest:!!ask,
        visionGroundCount:Number(context.visionGrounds)||0,visionAskCount:Number(context.visionAsks)||0});
      if(refusal)deny(refusal);
      return s.applyAsk(visionId,treeId,lidAt(Date.now()));
    }
    if(action==='drop') {
      if(!ask)deny('ground_no_request');
      if(!cares && text(vision?.authorId)!==uid && text(ask.requestedBy)!==uid)deny('ground_release_not_yours');
      return s.dropAsk(visionId,treeId);
    }
    if(action==='accept') {
      if(!vision||!tree)deny('ground_no_request');
      const refusal=groundAcceptRefusal({accepterUid:uid,accepterCaresForTree:cares,requestedBy:text(ask?.requestedBy)||null,
        vision:visionFactsOf(vision),tree:treeFactsOf(tree),alreadyGrounded:!!ground,
        visionGroundCount:Number(context.visionGrounds)||0,treeVisionCount:Number(context.treeGrounds)||0});
      if(refusal)deny(refusal);
      const mintedAt=Date.now(),self=text(vision.authorId)===uid;
      const {onTree,onVision}=await blocksOf({act:'grounded',visionId,treeId,vision,tree,uid,name:nameOf(context.profile,text(tree.name)),self,nodeDomain,mintedAt});
      return s.applyGround(visionId,treeId,onTree.record,onVision.record,onTree.height,onVision.height,lidAt(mintedAt));
    }
    // release — the vision's author now, or the hand the ground remembers when the vision is gone.
    const visionAuthorId=vision?text(vision.authorId):text(ground?.requestedBy);
    const refusal=groundReleaseRefusal({uid,visionAuthorId:visionAuthorId||null,caresForTree:cares,grounded:!!ground});
    if(refusal)deny(refusal);
    const mintedAt=Date.now();
    const {onTree,onVision}=await blocksOf({act:'released',visionId,treeId,vision,tree,uid,
      name:nameOf(context.profile,cares?text(tree?.name):text(vision?.title)),self:ground.self===true,nodeDomain,mintedAt});
    return s.applyRelease(visionId,treeId,onTree.record,onVision.record,onTree.height,onVision.height);
  });
}

// A VISION IS GONE: ITS GROUNDS END WITH IT (ring 2026-11-18; migration 071; the origin's
// onVisionDeleted). One transaction: the facts of every ground the vision stands in, one sealed
// block for each tree that still exists, the grounds and knocks removed, then the release itself
// (seed.vision_release, which judges the hand: the author, or staff). If the release is refused,
// nothing ended. The block is authored by the hand that released the vision.
/** @param {{repository: GroundingRepository, uid: string, command: {action: string, id: string}, nodeDomain: string}} options */
export async function releaseVision({repository,uid,command,nodeDomain}) {
  return repository.session(uid,async s=>{
    const visionId=command.id;
    // An id the ground could never have carried has no grounds to end; the release judges it as before.
    if(typeof visionId==='string' && visionId.length>0 && !/[\u0000-\u001f\u007f/]/.test(visionId) && !visionId.includes('__')) {
      const context=await s.visionGroundsContext(visionId);
      const vision=context.vision??null,grounds=Array.isArray(context.grounds)?context.grounds:[];
      if(vision) {   // knocks are withdrawn even where no ground stands
        const mintedAt=Date.now(),name=nameOf(context.profile,text(vision.title)),records=[];
        for(const ground of grounds) {
          if(!ground.tree)continue;
          const {onTree}=await blocksOf({act:'released',visionId,treeId:ground.treeId,vision:null,tree:ground.tree,uid,name,self:ground.self===true,nodeDomain,mintedAt,goneVision:vision});
          records.push({treeId:ground.treeId,record:onTree.record,height:onTree.height});
        }
        await s.applyVisionGroundsEnd(visionId,records);
      }
    }
    return s.visionRelease(command);
  });
}
