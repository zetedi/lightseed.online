import {parsePhrase,phraseToSeed,seedToPhrase} from '../../domain/signing';
import {recoveryContext,recoveryProposal,sameRecoveryContext,recoveryCode,type RecoveryContext,type RecoveryProposal} from '../../domain/seedRecovery';
import {seedRecoveryPreimage,seedRecoveryWitnessPreimage} from '../../domain/seedSigning.mjs';
import {sha256} from '../../utils/crypto';
import {keypairFromSeed,signPreimage,verifyPreimage} from '../signingCrypto';
import {independentDeviceKeyStore,type DeviceKeyStore,type DeviceSigningKey} from './keyStore';
import type {createSeedSession} from './session';
type Session=Pick<ReturnType<typeof createSeedSession>,'snapshot'|'read'|'signingCommand'>;
type Identity={uid:string;lid:string;publicKeyB64:string;fingerprint:string;epochId:string;state:string};
export function createSeedRecoveryCustody(session:Session,store:DeviceKeyStore=independentDeviceKeyStore()) {
  let generation=0,draft:{key:DeviceSigningKey;context:RecoveryContext;guard:()=>void}|null=null;
  const start=()=>{
    const snapshot=session.snapshot(),ticket=++generation;
    if(snapshot.status!=='authenticated')throw new Error('authentication_required');
    return {uid:snapshot.uid,guard:()=>{if(snapshot!==session.snapshot() || ticket!==generation)throw new Error('identity_changed');}};
  };
  const identity=async(uid:string,guard:()=>void)=>{
    const response=await session.read('/v1/signing-identity?id='+encodeURIComponent(uid)) as {identity:Identity|null};guard();
    const value=response.identity;
    if(!value || value.uid!==uid || !value.lid || !value.publicKeyB64 || value.fingerprint!==await sha256(value.publicKeyB64))throw new Error('invalid_signing_identity');
    guard();return value;
  };
  const own=async(uid:string,guard:()=>void)=>{
    const current=await identity(uid,guard),response=await session.read('/v1/me/profile') as {profile:{uid:string;lid:string}|null};guard();
    if(response.profile?.uid!==uid || response.profile.lid!==current.lid)throw new Error('identity_changed');
    const keys=await store.list(uid,current.lid);guard();
    if(keys.some(key=>key.uid!==uid || key.lid!==current.lid))throw new Error('invalid_device_key');
    return {current,keys};
  };
  const frozenContext=async(uid:string,guard:()=>void)=>{
    const response=await session.read('/v1/me/signing-recovery') as {context:unknown};guard();
    const context=recoveryContext(response.context);if(!context || context.uid!==uid)throw new Error('invalid_recovery_context');
    const {current}=await own(uid,guard);
    if(current.state!=='frozen' || current.lid!==context.lid || current.fingerprint!==context.fromFingerprint)throw new Error('identity_changed');
    return context;
  };
  const proof=async(key:DeviceSigningKey,preimage:string,guard:()=>void)=>{
    if(key.privateKey.extractable || key.privateKey.type!=='private' || key.privateKey.algorithm.name!=='Ed25519')throw new Error('invalid_device_key');
    const sig=await signPreimage(key.privateKey,preimage);guard();
    if(!await verifyPreimage(key.publicKeyB64,sig,preimage))throw new Error('invalid_device_key');guard();return sig;
  };
  const proposal=async(uid:string,eventId:string,guard:()=>void)=>{
    const response=await session.read('/v1/signing-recovery?id='+encodeURIComponent(uid)+'&event='+encodeURIComponent(eventId)) as {proposal:unknown};guard();
    const value=recoveryProposal(response.proposal);
    if(!value || value.uid!==uid || value.id!==eventId || await sha256(value.toPubkey)!==value.toFingerprint
      || !await verifyPreimage(value.toPubkey,value.newSig,seedRecoveryPreimage({...value,eventId})))throw new Error('invalid_recovery_proposal');
    guard();return value;
  };
  const matches=(value:RecoveryProposal,key:DeviceSigningKey)=>key.recovery
    && sameRecoveryContext(value,key.recovery.context) && value.toPubkey===key.publicKeyB64
    && value.id===key.recovery.command.eventId && value.newSig===key.recovery.command.newSig;
  const submit=async(key:DeviceSigningKey,guard:()=>void)=>{
    const saved=key.recovery;if(!saved)throw new Error('recovery_not_saved');
    const {current}=await own(key.uid,guard);
    if(current.publicKeyB64===key.publicKeyB64 && current.lid===key.lid) {
      const recorded=await proposal(key.uid,saved.command.eventId,guard);
      if(recorded.status!=='activated' || !matches(recorded,key))throw new Error('recovery_changed');
      await proof(key,seedRecoveryPreimage({...recorded,eventId:recorded.id}),guard);
      return {code:key.uid+':'+saved.command.eventId};
    }
    const context=await frozenContext(key.uid,guard);
    if(!sameRecoveryContext(context,saved.context) || key.lid!==context.lid || saved.command.toPubkey!==key.publicKeyB64)throw new Error('identity_changed');
    const preimage=seedRecoveryPreimage({...context,...saved.command});
    if(await sha256(key.publicKeyB64)!==saved.command.toFingerprint || !await verifyPreimage(key.publicKeyB64,saved.command.newSig,preimage))throw new Error('invalid_device_key');
    guard();await proof(key,preimage,guard);
    await store.save(key);guard();
    try {await session.signingCommand(saved.command);guard();}
    catch(error) {
      guard();let recorded:RecoveryProposal;
      try {recorded=await proposal(key.uid,saved.command.eventId,guard);}catch{throw error;}
      if(!matches(recorded,key))throw error;
    }
    return {code:key.uid+':'+saved.command.eventId};
  };
  return {
    cancel(){generation++;draft=null;},
    async inspect() {
      const {uid,guard}=start(),{current,keys}=await own(uid,guard);
      return {frozen:current.state==='frozen',codes:keys.filter(key=>key.recovery && key.recovery.context.fromFingerprint===current.fingerprint)
        .map(key=>uid+':'+key.recovery!.command.eventId)};
    },
    async prepare() {
      draft=null;const {uid,guard}=start(),context=await frozenContext(uid,guard);
      const keys=await store.list(uid,context.lid);guard();
      if(keys.some(key=>key.recovery?.context.fromFingerprint===context.fromFingerprint))throw new Error('recovery_already_saved');
      const seed=crypto.getRandomValues(new Uint8Array(32));
      try {const key=await keypairFromSeed(seed);guard();draft={key:{...key,uid,lid:context.lid},context,guard};return {words:seedToPhrase(seed)};}
      finally{seed.fill(0);}
    },
    async confirmBackup() {
      const pending=draft;if(!pending)throw new Error('backup_required');pending.guard();
      const {key,context,guard}=pending;
      if(!key.recovery) {
        const claim={action:'begin_recovery' as const,eventId:crypto.randomUUID(),toPubkey:key.publicKeyB64,toFingerprint:await sha256(key.publicKeyB64)};
        const newSig=await proof(key,seedRecoveryPreimage({...context,...claim}),guard);
        key.recovery={context,command:{...claim,newSig}};
      }
      const result=await submit(key,guard);draft=null;return result;
    },
    async retry(code:string) {
      draft=null;const {uid,guard}=start(),parsed=recoveryCode(code);
      if(!parsed || parsed.uid!==uid)throw new Error('invalid_recovery_code');
      const {keys}=await own(uid,guard),key=keys.find(item=>item.recovery?.command.eventId===parsed.eventId);
      if(!key)throw new Error('restore_required');return submit(key,guard);
    },
    async read(code:string) {
      const {guard}=start(),parsed=recoveryCode(code);if(!parsed)throw new Error('invalid_recovery_code');
      return proposal(parsed.uid,parsed.eventId,guard);
    },
    async restore(code:string,phrase:string) {
      draft=null;const {uid,guard}=start(),parsed=recoveryCode(code);
      if(!parsed || parsed.uid!==uid)throw new Error('invalid_recovery_code');
      const value=await proposal(uid,parsed.eventId,guard),{current}=await own(uid,guard);
      if(current.lid!==value.lid || (current.fingerprint!==value.fromFingerprint && current.fingerprint!==value.toFingerprint))throw new Error('identity_changed');
      let seed:Uint8Array;try{seed=phraseToSeed(parsePhrase(phrase));}catch{throw new Error('invalid_recovery_phrase');}
      try {
        const key=await keypairFromSeed(seed);guard();if(key.publicKeyB64!==value.toPubkey)throw new Error('restore_mismatch');
        await store.save({...key,uid,lid:value.lid,recovery:{context:{uid,lid:value.lid,fromFingerprint:value.fromFingerprint,suspectedSinceMs:value.suspectedSinceMs},
          command:{action:'begin_recovery',eventId:value.id,toPubkey:value.toPubkey,toFingerprint:value.toFingerprint,newSig:value.newSig}}});guard();
      }finally{seed.fill(0);}
    },
    async witness(reviewed:RecoveryProposal) {
      const {uid,guard}=start();
      const value=await proposal(reviewed.uid,reviewed.id,guard);
      if(value.status!=='open' || value.uid===uid || JSON.stringify(value)!==JSON.stringify(reviewed))throw new Error('recovery_changed');
      const {current,keys}=await own(uid,guard),key=keys.find(item=>item.publicKeyB64===current.publicKeyB64);
      if(current.state!=='active' || !key)throw new Error('restore_required');
      const sig=await proof(key,seedRecoveryWitnessPreimage({...value,eventId:value.id},uid),guard);
      await session.signingCommand({action:'witness_recovery',targetUid:value.uid,eventId:value.id,sig,pubkey:key.publicKeyB64,keyFingerprint:current.fingerprint,epochId:current.epochId});guard();
    },
    async activate(code:string) {
      const {uid,guard}=start(),parsed=recoveryCode(code);if(!parsed || parsed.uid!==uid)throw new Error('invalid_recovery_code');
      const value=await proposal(uid,parsed.eventId,guard),{current,keys}=await own(uid,guard);
      const key=keys.find(item=>item.publicKeyB64===value.toPubkey);if(!key || current.lid!==value.lid)throw new Error('restore_required');
      await proof(key,seedRecoveryPreimage({...value,eventId:value.id}),guard);
      if(current.publicKeyB64===value.toPubkey && value.status==='activated')return;
      if(current.state!=='frozen' || current.fingerprint!==value.fromFingerprint || value.status!=='open')throw new Error('recovery_changed');
      try{await session.signingCommand({action:'activate_recovery',eventId:value.id});guard();}
      catch(error){const after=await identity(uid,guard);if(after.publicKeyB64!==value.toPubkey)throw error;}
    },
  };
}
