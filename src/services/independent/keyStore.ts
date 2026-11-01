import type {DeviceRecovery} from '../../domain/seedRecovery';
import type {DeviceRotation} from '../../domain/seedKeyRotation';
import type {SigningKeypair} from '../signingCrypto';
export type DeviceSigningKey=SigningKeypair & {uid:string;lid:string;rotation?:DeviceRotation;recovery?:DeviceRecovery};
export interface DeviceKeyStore {
  list(uid:string,lid:string):Promise<DeviceSigningKey[]>;
  save(key:DeviceSigningKey):Promise<void>;
}
// IndexedDB is origin-scoped; UID + stable LID also isolates a rebuilt node/account.
// No seed or phrase is stored. Each key is retained separately for future rotation.
export function independentDeviceKeyStore():DeviceKeyStore {
  const open=()=>new Promise<IDBDatabase>((resolve,reject)=>{
    const request=indexedDB.open('lightseed-independent-signing',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('keys',{keyPath:['uid','lid','publicKeyB64']}).createIndex('person',['uid','lid']);
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(new Error('device_store_unavailable'));
  });
  return {
    async list(uid,lid) {
      const db=await open();
      try {return await new Promise<DeviceSigningKey[]>((resolve,reject)=>{
        const transaction=db.transaction('keys','readonly'),request=transaction.objectStore('keys').index('person').getAll([uid,lid]);
        transaction.oncomplete=()=>resolve(request.result as DeviceSigningKey[]);
        transaction.onerror=transaction.onabort=()=>reject(new Error('device_store_unavailable'));
      });}finally{db.close();}
    },
    async save(key) {
      if(key.privateKey.extractable || key.privateKey.type!=='private' || key.privateKey.algorithm.name!=='Ed25519')throw new Error('invalid_device_key');
      const db=await open();
      try {await new Promise<void>((resolve,reject)=>{
        const transaction=db.transaction('keys','readwrite'),store=transaction.objectStore('keys');
        // Restoring may repair a damaged device copy of this same public key.
        store.put(key);
        transaction.oncomplete=()=>resolve();transaction.onerror=transaction.onabort=()=>reject(new Error('device_store_unavailable'));
      });}finally{db.close();}
    },
  };
}
