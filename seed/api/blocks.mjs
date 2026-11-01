import {createPublicKey,verify,createHash} from 'node:crypto';
import {judgeBlockBirth,judgeBlockSignature,isBlockSignatureClaim,blockSignaturePayload,blockSignaturePreimage,
  blockRecordOf,computeCanonicalHash,BLOCK_HASH_VERSION,wateringResetOf,touchMemoryOf,publicNameOf} from '../generated/chain.mjs';
const statuses={block_no_bearer:404,block_not_carer:403,block_field_unknown:400,block_field_bad:400,block_type_unlawful:400,
  block_visibility_bad:400,block_witness_forged:409,block_care_type:409,block_reach_loud:409,block_reach_stranger:403,block_seen_forged:409,
  block_unsigned:403,block_signature_bad:403,block_key_stale:409,block_key_frozen:403,block_head_moved:409};
export const blockRefusalStatus=refusal=>Object.hasOwn(statuses,refusal)?statuses[refusal]:null;
const refuse=refusal=>{throw Object.assign(new Error('Block refused'),{code:'BLOCK_REJECTED',refusal});};
// Called only with facts read under transaction locks. No client-supplied identity,
// standing, timestamps, node domain, record ID or head is accepted as authority.
export async function prepareBlock({uid,command,context,id,lid,nodeDomain,mintedAt}) {
  const bearer=context.bearer??{},person=context.person??{};
  const judgment=judgeBlockBirth({on:command.on,minterUid:uid,isStaff:context.isStaff,
    bearer:{...bearer,exists:context.bearer!==null,carer:context.carer},block:command.block});
  if(judgment.outcome==='reject')refuse(judgment.refusal);
  if(!Number.isSafeInteger(judgment.blockHeight) || judgment.blockHeight<1)refuse('block_field_bad');
  const {content,previousHash,blockHeight}=judgment;
  // A partially imported published key must not silently become an unsigned author.
  const hasKey=typeof person.publicKeyPem==='string' && !!person.publicKeyPem;
  if(!hasKey && ((person.publicKeyPem!==undefined && person.publicKeyPem!==null && person.publicKeyPem!=='')
    || person.signingEpochId || person.signingKeyFingerprint || person.signingState==='active'))refuse('block_key_stale');
  if(hasKey && (person.uid!==uid || context.profile?.uid!==uid || !person.lid || context.profile?.lid!==person.lid
    || typeof person.signingEpochId!=='string' || !person.signingEpochId
    || person.signingKeyFingerprint!==createHash('sha256').update(person.publicKeyPem).digest('hex')
    || !['active','frozen'].includes(person.signingState)))refuse('block_key_stale');
  const signer=hasKey?{state:person.signingState,fingerprint:person.signingKeyFingerprint,epochId:person.signingEpochId,pubkey:person.publicKeyPem}
    :{state:person.signingState==='frozen'?'frozen':'none'};
  const claim=command.signature;
  let verified=false;
  if(signer.state==='active' && isBlockSignatureClaim(claim) && claim.previousHash===previousHash
    && claim.epochId===signer.epochId && claim.keyFingerprint===signer.fingerprint) {
    try {
      const key=createPublicKey({key:Buffer.from(signer.pubkey,'base64'),format:'der',type:'spki'});
      verified=key.asymmetricKeyType==='ed25519' && verify(null,Buffer.from(blockSignaturePreimage(blockSignaturePayload({
        on:command.on,bearerId:command.id,previousHash,content,signerUid:uid,keyFingerprint:claim.keyFingerprint,epochId:claim.epochId}))),key,Buffer.from(claim.sig,'base64'));
    }catch{/* invalid key/proof is a refusal */}
  }
  const signed=judgeBlockSignature({signer,claim,headHash:previousHash,verified});
  if(signed.outcome==='reject')refuse(signed.refusal);
  if(signed.outcome==='signed')content.authorSignature=signed.signature;
  const moment=new Date(mintedAt).toISOString(),patch={};
  if(command.on==='tree' && content.type==='tree_growth') {
    if(typeof content.imageUrl==='string' && content.imageUrl)patch.latestGrowthUrl=content.imageUrl;
    patch.lastCaredAt=moment;
    if(content.care==='watering') {
      const user=context.profile??{};
      const name=publicNameOf({displayName:typeof user.displayName==='string'?user.displayName:typeof user.name==='string'?user.name:undefined,
        anonymous:!!user.anonymous,treeName:typeof bearer.name==='string'?bearer.name:undefined})??'';
      const reset=wateringResetOf(bearer,mintedAt,uid,name);
      patch['watering.lastWateredAt']=moment;patch['watering.lastWateredBy']=uid;patch['watering.lastWateredByName']=reset.lastWateredByName;
      patch['watering.overdue']=false;
      if(reset.nextDueAtMs)patch['watering.nextDueAt']=new Date(reset.nextDueAtMs).toISOString();
      if(content.wateringConfirmedBy==='ai')content.wateringConfirmation={...(content.wateringConfirmation??{}),confirmedAt:moment};
      else content.wateringConfirmedBy='pending';
    }
  }
  const domain=typeof bearer.domain==='string' && bearer.domain?bearer.domain:nodeDomain;
  const record=blockRecordOf({on:command.on,bearerId:command.id,content,authorId:uid,lid,id,domain,mintedAt,previousHash});
  const hash=await computeCanonicalHash(previousHash,mintedAt,record),memory=touchMemoryOf(bearer,patch);
  return {record:{...record,...(memory?{bearerBefore:memory}:{}),hash,hashVersion:BLOCK_HASH_VERSION,createdAt:moment},patch,blockHeight,
    result:{pulseId:id,lid,hash,previousHash,blockHeight,mintedAt,...(patch.latestGrowthUrl?{latestGrowthUrl:patch.latestGrowthUrl}:{})}};
}
