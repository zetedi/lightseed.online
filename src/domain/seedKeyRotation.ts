import {seedSigningCommand} from './seedSigning.mjs';

export interface DeviceRotation {
  action:'rotate'; eventId:string; lid:string;
  fromPubkey:string; toPubkey:string; fromFingerprint:string; toFingerprint:string;
  oldSig:string; newSig:string;
}
// Saved retry receipts contain only public keys and proofs. They never authorize
// a different person or a replacement for an already-replaced current key.
export function pendingDeviceRotation(value:unknown,lid:string,candidate:string,published:string):value is DeviceRotation {
  const command=seedSigningCommand(value);
  return command?.action==='rotate' && command.lid===lid && command.toPubkey===candidate
    && command.fromPubkey===published && candidate!==published;
}
