import {keyCustody,parsePhrase,phraseToSeed,restoreConflictsWithPublished,seedToPhrase} from '../../domain/signing';
import {keypairFromSeed,signPreimage,verifyPreimage,type SigningKeypair} from '../signingCrypto';
import {pendingDeviceRotation,type DeviceRotation} from '../../domain/seedKeyRotation';
import {seedRotationPreimage} from '../../domain/seedSigning.mjs';
import {sha256} from '../../utils/crypto';
import type {createSeedSession} from './session';
import {independentDeviceKeyStore,type DeviceKeyStore,type DeviceSigningKey} from './keyStore';

type Session=Pick<ReturnType<typeof createSeedSession>,'snapshot'|'read'|'signingCommand'>;
export function createSeedKeyCustody(session:Session,store:DeviceKeyStore=independentDeviceKeyStore()) {
  let generation=0;
  let draft:{key:DeviceSigningKey;guard:()=>void;fromPubkey?:string}|null=null;
  const start=()=>{
    const current=session.snapshot(),ticket=++generation;
    if(current.status!=='authenticated')throw new Error('authentication_required');
    const guard=()=>{if(session.snapshot()!==current || ticket!==generation)throw new Error('identity_changed');};
    return {uid:current.uid,guard};
  };
  const load=async(uid:string,guard:()=>void,verifyDevice=true)=>{
    const response=await session.read('/v1/me/profile') as {profile:{uid:string;lid:string}|null};guard();
    const profile=response.profile;
    if(!profile || profile.uid!==uid || !/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(profile.lid))throw new Error('profile_required');
    const {identity}=await session.read('/v1/signing-identity?id='+encodeURIComponent(uid)) as {identity:{uid:string;lid:string;publicKeyB64:string;state:string|null}|null};guard();
    if(identity && (identity.uid!==uid || identity.lid!==profile.lid || typeof identity.publicKeyB64!=='string'))throw new Error('invalid_signing_identity');
    const keys=await store.list(uid,profile.lid);guard();
    if(keys.some(key=>key.uid!==uid || key.lid!==profile.lid))throw new Error('invalid_device_key');
    const published=identity?.publicKeyB64??'';
    const ambiguous=!published && keys.length>1;
    const key=keys.find(item=>item.publicKeyB64===published)??keys[0]??null;
    if(key && verifyDevice) {
      if(key.privateKey.extractable || key.privateKey.type!=='private' || key.privateKey.algorithm.name!=='Ed25519')throw new Error('invalid_device_key');
      const challenge='lightseed.device-custody.v1\n'+crypto.randomUUID();
      if(!await verifyPreimage(key.publicKeyB64,await signPreimage(key.privateKey,challenge),challenge))throw new Error('invalid_device_key');guard();
    }
    const rotations=keys.filter(item=>pendingDeviceRotation(item.rotation,profile.lid,item.publicKeyB64,published));
    return {uid,lid:profile.lid,key,published,rotations,active:identity?.state==='active',frozen:identity?.state==='frozen',status:ambiguous?'stale_device':keyCustody(key?.publicKeyB64??null,published)};
  };
  const publish=async(key:DeviceSigningKey,guard:()=>void)=>{
    guard();await store.save(key);guard();
    await session.signingCommand({action:'anchor',publicKeyB64:key.publicKeyB64});guard();
    return {publicKeyB64:key.publicKeyB64};
  };
  const rotate=async(key:DeviceSigningKey,guard:()=>void)=>{
    const state=await load(key.uid,guard);
    if(state.lid!==key.lid)throw new Error('identity_changed');
    // A lost response may follow a committed rotation. Never publish another key.
    if(state.published===key.publicKeyB64)return {publicKeyB64:key.publicKeyB64};
    if(!state.active || !pendingDeviceRotation(key.rotation,key.lid,key.publicKeyB64,state.published))throw new Error('rotation_conflict');
    const command=key.rotation,preimage=seedRotationPreimage(key.uid,command);
    if(key.privateKey.extractable || key.privateKey.type!=='private' || key.privateKey.algorithm.name!=='Ed25519'
      || !await verifyPreimage(key.publicKeyB64,await signPreimage(key.privateKey,preimage),preimage)
      || !await verifyPreimage(command.fromPubkey,command.oldSig,preimage)
      || !await verifyPreimage(command.toPubkey,command.newSig,preimage))throw new Error('invalid_device_key');
    guard();await store.save(key);guard();
    await session.signingCommand(command);guard();
    return {publicKeyB64:key.publicKeyB64};
  };
  return {
    cancel(){generation++;draft=null;},
    async inspect() {
      const {uid,guard}=start();const state=await load(uid,guard);
      return {status:state.status,frozen:state.frozen,publicKeyB64:state.published,rotationPending:state.rotations.length>0};
    },
    async prepare() {
      draft=null;const {uid,guard}=start();const state=await load(uid,guard);
      if(state.status!=='fresh')throw new Error('restore_required');
      const seed=crypto.getRandomValues(new Uint8Array(32));
      try {
        const key=await keypairFromSeed(seed);guard();
        draft={key:{...key,uid,lid:state.lid},guard};
        return {words:seedToPhrase(seed)};
      }finally{seed.fill(0);}
    },
    async prepareRotation() {
      draft=null;const {uid,guard}=start();const state=await load(uid,guard);
      if(state.status!=='ready' || !state.active || state.rotations.length)throw new Error('rotation_unavailable');
      const seed=crypto.getRandomValues(new Uint8Array(32));
      try {
        const key=await keypairFromSeed(seed);guard();
        draft={key:{...key,uid,lid:state.lid},guard,fromPubkey:state.published};
        return {words:seedToPhrase(seed)};
      }finally{seed.fill(0);}
    },
    async retryRotation() {
      draft=null;const {uid,guard}=start();const state=await load(uid,guard);
      if(state.rotations.length!==1)throw new Error('rotation_unavailable');
      return rotate(state.rotations[0],guard);
    },
    async confirmBackup() {
      const pending=draft;if(!pending)throw new Error('backup_required');pending.guard();
      // Keep a durable key before publication so an uncertain network result is recoverable.
      const state=await load(pending.key.uid,pending.guard);
      if(pending.fromPubkey) {
        if(state.lid!==pending.key.lid)throw new Error('identity_changed');
        if(state.published!==pending.key.publicKeyB64) {
          if(state.published!==pending.fromPubkey || !state.key || !state.active)throw new Error('rotation_conflict');
          if(!pending.key.rotation) {
            const claim={action:'rotate' as const,eventId:crypto.randomUUID(),lid:state.lid,
              fromPubkey:state.published,toPubkey:pending.key.publicKeyB64,
              fromFingerprint:await sha256(state.published),toFingerprint:await sha256(pending.key.publicKeyB64)};
            const preimage=seedRotationPreimage(state.uid,claim);
            const command:DeviceRotation={...claim,oldSig:await signPreimage(state.key.privateKey,preimage),newSig:await signPreimage(pending.key.privateKey,preimage)};
            pending.guard();pending.key={...pending.key,rotation:command};
          }
        }
        const result=await rotate(pending.key,pending.guard);draft=null;return result;
      }
      if(state.lid!==pending.key.lid || restoreConflictsWithPublished(pending.key.publicKeyB64,state.published))throw new Error('restore_mismatch');
      const result=await publish(pending.key,pending.guard);draft=null;return result;
    },
    async publishStored() {
      draft=null;const {uid,guard}=start();const state=await load(uid,guard);
      if(!state.key || !['ready','publish_needed'].includes(state.status))throw new Error('restore_required');
      return publish(state.key,guard);
    },
    async restore(phrase:string) {
      draft=null;const {uid,guard}=start();const state=await load(uid,guard,false);
      let seed:Uint8Array;
      try {seed=phraseToSeed(parsePhrase(phrase));}catch{throw new Error('invalid_recovery_phrase');}
      let key:SigningKeypair;
      try {key=await keypairFromSeed(seed);guard();}finally{seed.fill(0);}
      if(restoreConflictsWithPublished(key.publicKeyB64,state.published))throw new Error('restore_mismatch');
      return publish({...key,uid,lid:state.lid},guard);
    },
  };
}
