import {judgeBlockBirth,blockSignaturePayload,blockSignaturePreimage,type ChainBearerKind} from '../../domain/chain/birth';
import {seedBlockCommand} from '../../domain/seedBlock.mjs';
import {sha256} from '../../utils/crypto';
import {signPreimage,verifyPreimage} from '../signingCrypto';
import {independentDeviceKeyStore,type DeviceKeyStore} from './keyStore';
import type {createSeedSession} from './session';

type Session=Pick<ReturnType<typeof createSeedSession>,'snapshot'|'read'|'blockCommand'>;
// Preparation is a review, not authority. The node rechecks standing and identity
// while holding the head lock. A prepared attempt is consumed even on network error.
export function createSeedBlockMint(session:Session,store:DeviceKeyStore=independentDeviceKeyStore()) {
  let generation=0;
  let pending:{guard:()=>void;command:object}|null=null;
  return {
    cancel(){generation++;pending=null;},
    async prepare(on:ChainBearerKind,id:string,block:Record<string,unknown>) {
      pending=null;
      const current=session.snapshot(),ticket=++generation;
      if(current.status!=='authenticated')throw new Error('authentication_required');
      const guard=()=>{if(session.snapshot()!==current || ticket!==generation)throw new Error('identity_changed');};
      // Copy before the first await; edits to the caller's form cannot change a review.
      const input=structuredClone(block);
      if(!seedBlockCommand({action:'mint',on,id,block:input}))throw new Error('invalid_command');
      const {profile}=await session.read('/v1/me/profile') as {profile:{uid:string;lid:string}|null};guard();
      if(!profile || profile.uid!==current.uid || typeof profile.lid!=='string'
        || !/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(profile.lid))throw new Error('profile_required');
      const {identity}=await session.read('/v1/signing-identity?id='+encodeURIComponent(current.uid)) as {
        identity:{uid:string;lid:string;publicKeyB64:string;fingerprint:string;epochId:string;state:string}|null};guard();
      if(!identity || identity.uid!==current.uid || identity.lid!==profile.lid)throw new Error('signing_key_required');
      if(identity.state==='frozen')throw new Error('block_key_frozen');
      if(identity.state!=='active' || typeof identity.publicKeyB64!=='string'
        || typeof identity.epochId!=='string' || !/^[A-Za-z0-9_-]{1,128}$/.test(identity.epochId)
        || identity.fingerprint!==await sha256(identity.publicKeyB64))throw new Error('block_key_stale');guard();
      const keys=await store.list(current.uid,profile.lid);guard();
      const key=keys.find(value=>value.uid===current.uid && value.lid===profile.lid && value.publicKeyB64===identity.publicKeyB64);
      if(!key)throw new Error('restore_required');
      if(key.privateKey.extractable || key.privateKey.type!=='private' || key.privateKey.algorithm.name!=='Ed25519')throw new Error('invalid_device_key');
      const response=await session.read('/v1/'+(on==='tree'?'trees':'visions')+'?id='+encodeURIComponent(id)) as Record<string,Record<string,unknown>|null>;guard();
      const bearer=response[on];
      const judgment=judgeBlockBirth({on,minterUid:current.uid,isStaff:false,
        // This only normalizes signed content. It does not assert database standing.
        bearer:{...bearer,exists:!!bearer,carer:true},block:input});
      if(judgment.outcome==='reject')throw new Error(judgment.refusal);
      const preimage=blockSignaturePreimage(blockSignaturePayload({on,bearerId:id,previousHash:judgment.previousHash,
        content:judgment.content,signerUid:current.uid,keyFingerprint:identity.fingerprint,epochId:identity.epochId}));
      const sig=await signPreimage(key.privateKey,preimage);guard();
      if(!await verifyPreimage(identity.publicKeyB64,sig,preimage))throw new Error('invalid_device_key');guard();
      const command={action:'mint',on,id,block:input,signature:{sig,keyFingerprint:identity.fingerprint,epochId:identity.epochId,previousHash:judgment.previousHash}};
      if(!seedBlockCommand(command))throw new Error('invalid_command');
      pending={guard,command};
      return {content:structuredClone(judgment.content),previousHash:judgment.previousHash,keyFingerprint:identity.fingerprint};
    },
    async submit() {
      const attempt=pending;pending=null;
      if(!attempt)throw new Error('review_required');
      attempt.guard();
      const result=await session.blockCommand(attempt.command);attempt.guard();return result;
    },
  };
}
