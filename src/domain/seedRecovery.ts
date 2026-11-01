import {seedSigningCommand} from './seedSigning.mjs';
export interface RecoveryContext {uid:string;lid:string;fromFingerprint:string;suspectedSinceMs:number}
export interface RecoveryCandidate {action:'begin_recovery';eventId:string;toPubkey:string;toFingerprint:string;newSig:string}
export interface DeviceRecovery {context:RecoveryContext;command:RecoveryCandidate}
export interface RecoveryProposal extends RecoveryContext {id:string;status:'open'|'activated';toPubkey:string;toFingerprint:string;newSig:string}
export function recoveryContext(value:unknown):RecoveryContext|null {
  if(!value || typeof value!=='object')return null;
  const v=value as Record<string,unknown>;
  if(typeof v.uid!=='string' || !v.uid || v.uid.length>128 || /[\u0000-\u001f\u007f]/.test(v.uid)
    || typeof v.lid!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v.lid)
    || typeof v.fromFingerprint!=='string' || !/^[a-f0-9]{64}$/.test(v.fromFingerprint)
    || typeof v.suspectedSinceMs!=='number' || !Number.isSafeInteger(v.suspectedSinceMs) || v.suspectedSinceMs<0 || v.suspectedSinceMs>253402300799999)return null;
  return {uid:v.uid,lid:v.lid,fromFingerprint:v.fromFingerprint,suspectedSinceMs:v.suspectedSinceMs};
}
export function recoveryProposal(value:unknown):RecoveryProposal|null {
  const context=recoveryContext(value);if(!context)return null;
  const v=value as Record<string,unknown>;
  const command=seedSigningCommand({action:'begin_recovery',eventId:v.id,toPubkey:v.toPubkey,toFingerprint:v.toFingerprint,newSig:v.newSig});
  if(!command || (v.status!=='open' && v.status!=='activated') || command.toFingerprint===context.fromFingerprint)return null;
  return {...context,id:command.eventId,status:v.status as 'open'|'activated',toPubkey:command.toPubkey,toFingerprint:command.toFingerprint,newSig:command.newSig};
}
export function sameRecoveryContext(a:RecoveryContext,b:RecoveryContext):boolean {
  return a.uid===b.uid && a.lid===b.lid && a.fromFingerprint===b.fromFingerprint && a.suspectedSinceMs===b.suspectedSinceMs;
}
export function recoveryCode(value:string):{uid:string;eventId:string}|null {
  const split=value.lastIndexOf(':'),uid=value.slice(0,split),eventId=value.slice(split+1);
  return split>0 && uid.length<=128 && !/[\u0000-\u001f\u007f]/.test(uid) && /^[A-Za-z0-9_-]{1,128}$/.test(eventId)?{uid,eventId}:null;
}
