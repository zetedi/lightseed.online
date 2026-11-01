import {createHash,createPublicKey,verify} from 'node:crypto';
import {seedSigningCommand,seedRotationPreimage,seedRecoveryPreimage,seedRecoveryWitnessPreimage} from '../../src/domain/seedSigning.mjs';
// Verification precedes the transaction. The SQL apply function is available only
// to the trusted API role, which also establishes the authenticated local UID.
export function verifiesRotation(uid,value) {
  const command=seedSigningCommand(value);
  if(!command || command.action!=='rotate' || typeof uid!=='string' || !uid || uid.length>128 || /[\u0000-\u001f\u007f]/.test(uid))return false;
  const fingerprint=key=>createHash('sha256').update(key,'utf8').digest('hex');
  if(fingerprint(command.fromPubkey)!==command.fromFingerprint || fingerprint(command.toPubkey)!==command.toFingerprint)return false;
  const bytes=Buffer.from(seedRotationPreimage(uid,command),'utf8');
  try {
    return [['fromPubkey','oldSig'],['toPubkey','newSig']].every(([key,sig])=>{
      const publicKey=createPublicKey({key:Buffer.from(command[key],'base64'),format:'der',type:'spki'});
      return publicKey.asymmetricKeyType==='ed25519' && verify(null,bytes,publicKey,Buffer.from(command[sig],'base64'));
    });
  }catch{return false;}
}

export function verifiesRecoveryCandidate(context,value) {
  const command=seedSigningCommand(value);
  if(!command || command.action!=='begin_recovery' || !context || context.fromFingerprint===command.toFingerprint
    || !Number.isSafeInteger(context.suspectedSinceMs) || context.suspectedSinceMs<0
    || createHash('sha256').update(command.toPubkey,'utf8').digest('hex')!==command.toFingerprint)return false;
  try {
    const key=createPublicKey({key:Buffer.from(command.toPubkey,'base64'),format:'der',type:'spki'});
    return key.asymmetricKeyType==='ed25519' && verify(null,Buffer.from(seedRecoveryPreimage({...context,eventId:command.eventId,toFingerprint:command.toFingerprint}),'utf8'),key,Buffer.from(command.newSig,'base64'));
  }catch{return false;}
}

export function verifiesRecoveryWitness(uid,proposal,value) {
  const command=seedSigningCommand(value);
  if(!command || command.action!=='witness_recovery' || typeof uid!=='string' || !uid || uid.length>128 || /[\u0000-\u001f\u007f]/.test(uid) || uid===command.targetUid || !proposal
    || proposal.uid!==command.targetUid || proposal.id!==command.eventId || proposal.status!=='open'
    || !Number.isSafeInteger(proposal.suspectedSinceMs)
    || createHash('sha256').update(command.pubkey,'utf8').digest('hex')!==command.keyFingerprint)return false;
  try {
    const key=createPublicKey({key:Buffer.from(command.pubkey,'base64'),format:'der',type:'spki'});
    return key.asymmetricKeyType==='ed25519' && verify(null,Buffer.from(seedRecoveryWitnessPreimage({...proposal,eventId:command.eventId},uid),'utf8'),key,Buffer.from(command.sig,'base64'));
  }catch{return false;}
}
