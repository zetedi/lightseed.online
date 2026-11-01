import {expect,it,vi} from 'vitest';
import {createSeedKeyCustody} from '../src/services/independent/keyCustody';
import type {DeviceSigningKey,DeviceKeyStore} from '../src/services/independent/keyStore';
import type {SeedSession} from '../src/services/independent/session';
import {keypairFromSeed} from '../src/services/signingCrypto';
import {verifiesRotation} from '../seed/api/signing.mjs';
import {pendingDeviceRotation} from '../src/domain/seedKeyRotation';
import {seedToPhrase} from '../src/domain/signing';
function fixture() {
  let state:SeedSession={status:'authenticated',uid:'alice'};
  let lid='01900000-0000-7000-8000-000000000001';
  let identity:{uid:string;lid:string;publicKeyB64:string;state:string}|null=null;
  let fail=false,loseResponse=false;
  const keys:DeviceSigningKey[]=[];
  const store:DeviceKeyStore={list:async(uid,id)=>keys.filter(key=>key.uid===uid && key.lid===id),save:async key=>{
    const index=keys.findIndex(old=>old.uid===key.uid && old.lid===key.lid && old.publicKeyB64===key.publicKeyB64);
    if(index<0)keys.push(structuredClone(key));else keys[index]=structuredClone(key);
  }};
  const session={snapshot:()=>state,read:async(path:string)=>path==='/v1/me/profile'?{profile:{uid:'alice',lid}}:{identity},
    signingCommand:vi.fn(async(value:unknown)=>{
      if(fail)throw new Error('network_failed');
      const command=value as {action:string;publicKeyB64:string;toPubkey:string};
      if(command.action==='rotate' && !verifiesRotation('alice',command))throw new Error('invalid_rotation');
      identity={uid:'alice',lid,publicKeyB64:command.action==='rotate'?command.toPubkey:command.publicKeyB64,state:identity?.state??'active'};
      if(loseResponse)throw new Error('response_lost');
      return {identity};
    })};
  return {session,store,keys,setLostResponse:(value:boolean)=>{loseResponse=value;},setState:(value:SeedSession)=>{state=value;},setIdentity:(value:typeof identity)=>{identity=value;},setLid:(value:string)=>{lid=value;},setFailure:(value:boolean)=>{fail=value;}};
}
it('keeps phrase/key creation local until backup confirmation and stores a non-extractable key',async()=>{
  const f=fixture(),custody=createSeedKeyCustody(f.session,f.store);
  expect((await custody.inspect()).status).toBe('fresh');
  const {words}=await custody.prepare();expect(words).toHaveLength(24);
  expect(f.keys).toHaveLength(0);expect(f.session.signingCommand).not.toHaveBeenCalled();
  await custody.confirmBackup();
  expect(f.keys).toHaveLength(1);expect(f.keys[0].privateKey.extractable).toBe(false);
  await expect(crypto.subtle.exportKey('pkcs8',f.keys[0].privateKey)).rejects.toThrow();
  expect(f.session.signingCommand).toHaveBeenCalledWith({action:'anchor',publicKeyB64:f.keys[0].publicKeyB64});
  expect(Object.keys(f.keys[0]).sort()).toEqual(['lid','privateKey','publicKey','publicKeyB64','uid']);
  expect((await custody.inspect()).status).toBe('ready');
  const another:DeviceKeyStore={list:async()=>[],save:vi.fn(async()=>{})};
  const restored=await createSeedKeyCustody(f.session,another).restore(words.join(' '));
  expect(restored.publicKeyB64).toBe(f.keys[0].publicKeyB64);
});
it('retains a saved key after uncertain publication and retries without regenerating it',async()=>{
  const f=fixture(),custody=createSeedKeyCustody(f.session,f.store);
  await custody.prepare();f.setFailure(true);
  await expect(custody.confirmBackup()).rejects.toThrow('network_failed');expect(f.keys).toHaveLength(1);
  const next=createSeedKeyCustody(f.session,f.store);expect((await next.inspect()).status).toBe('publish_needed');
  f.setFailure(false);await next.publishStored();expect((await next.inspect()).status).toBe('ready');expect(f.keys).toHaveLength(1);
});
it('refuses a mismatched phrase, preserves frozen state and isolates stable person identities',async()=>{
  const f=fixture(),seed=new Uint8Array(32).fill(4),key=await keypairFromSeed(seed);
  f.setIdentity({uid:'alice',lid:'01900000-0000-7000-8000-000000000001',publicKeyB64:key.publicKeyB64,state:'frozen'});
  const custody=createSeedKeyCustody(f.session,f.store);
  await expect(custody.restore(seedToPhrase(new Uint8Array(32).fill(5)).join(' '))).rejects.toThrow('restore_mismatch');
  expect(f.keys).toHaveLength(0);expect(f.session.signingCommand).not.toHaveBeenCalled();
  await custody.restore(seedToPhrase(seed).join(' '));expect((await custody.inspect()).frozen).toBe(true);
  f.setIdentity(null);f.setLid('01900000-0000-7000-8000-000000000002');
  expect((await custody.inspect()).status).toBe('fresh');
});
it('cancels pending custody across account changes or person replacement before any publication',async()=>{
  const f=fixture(),custody=createSeedKeyCustody(f.session,f.store);
  await custody.prepare();f.setState({status:'authenticated',uid:'bob'});
  await expect(custody.confirmBackup()).rejects.toThrow('identity_changed');expect(f.keys).toHaveLength(0);
  f.setState({status:'authenticated',uid:'alice'});await custody.prepare();f.setLid('01900000-0000-7000-8000-000000000002');
  await expect(custody.confirmBackup()).rejects.toThrow('restore_mismatch');expect(f.keys).toHaveLength(0);
  custody.cancel();await expect(custody.confirmBackup()).rejects.toThrow('backup_required');expect(f.session.signingCommand).not.toHaveBeenCalled();
});

it('lets an explicit phrase choose among unpublished keys and repair a damaged device copy',async()=>{
  const f=fixture(),seed=new Uint8Array(32).fill(7),key=await keypairFromSeed(seed),other=await keypairFromSeed(new Uint8Array(32).fill(8));
  const scope={uid:'alice',lid:'01900000-0000-7000-8000-000000000001'};
  await f.store.save({...key,...scope});await f.store.save({...other,...scope});
  const custody=createSeedKeyCustody(f.session,f.store);
  expect((await custody.inspect()).status).toBe('stale_device');
  await expect(custody.publishStored()).rejects.toThrow('restore_required');
  await custody.restore(seedToPhrase(seed).join(' '));expect((await custody.inspect()).status).toBe('ready');
  f.keys[0].privateKey=other.privateKey;
  await expect(custody.inspect()).rejects.toThrow('invalid_device_key');
  await custody.restore(seedToPhrase(seed).join(' '));expect((await custody.inspect()).status).toBe('ready');
});

it('backs up replacement keys before rotation and retains both keys across a lost response',async()=>{
  const f=fixture(),custody=createSeedKeyCustody(f.session,f.store);
  await custody.prepare();await custody.confirmBackup();const original=f.keys[0].publicKeyB64;
  const {words}=await custody.prepareRotation();expect(words).toHaveLength(24);
  expect(f.keys).toHaveLength(1);expect(f.session.signingCommand).toHaveBeenCalledTimes(1);
  f.setLostResponse(true);await expect(custody.confirmBackup()).rejects.toThrow('response_lost');
  expect(f.keys).toHaveLength(2);expect(f.keys[0].publicKeyB64).toBe(original);
  const command=f.keys[1].rotation!;
  expect(pendingDeviceRotation(command,f.keys[1].lid,f.keys[1].publicKeyB64,original)).toBe(true);
  expect(pendingDeviceRotation({...command,lid:'wrong'},f.keys[1].lid,f.keys[1].publicKeyB64,original)).toBe(false);
  expect(pendingDeviceRotation(command,f.keys[1].lid,f.keys[1].publicKeyB64,command.toPubkey)).toBe(false);
  // Reconfirming the retained draft recognizes success, without sending twice.
  await custody.confirmBackup();expect(f.session.signingCommand).toHaveBeenCalledTimes(2);
  const next=createSeedKeyCustody(f.session,f.store);
  expect(await next.inspect()).toMatchObject({status:'ready',rotationPending:false,publicKeyB64:command.toPubkey});
  f.setLostResponse(false);await next.restore(words.join(' '));expect(f.keys).toHaveLength(2);
});
it('retries a durable rotation after reload with exactly the same candidate and signed event',async()=>{
  const f=fixture(),custody=createSeedKeyCustody(f.session,f.store);
  await custody.prepare();await custody.confirmBackup();await custody.prepareRotation();f.setFailure(true);
  await expect(custody.confirmBackup()).rejects.toThrow('network_failed');const command=f.keys[1].rotation!;
  const next=createSeedKeyCustody(f.session,f.store);
  expect(await next.inspect()).toMatchObject({status:'ready',rotationPending:true});
  await expect(next.prepareRotation()).rejects.toThrow('rotation_unavailable');
  f.setFailure(false);await next.retryRotation();
  expect(f.session.signingCommand).toHaveBeenLastCalledWith(command);expect(f.keys).toHaveLength(2);
  expect((await next.inspect()).publicKeyB64).toBe(command.toPubkey);
});
it('refuses rotation after freezing, account change, or conflicting replacement',async()=>{
  const f=fixture(),custody=createSeedKeyCustody(f.session,f.store);
  await custody.prepare();await custody.confirmBackup();await custody.prepareRotation();
  const old=f.keys[0];f.setIdentity({...old,state:'frozen'});
  await expect(custody.confirmBackup()).rejects.toThrow('rotation_conflict');expect(f.keys).toHaveLength(1);
  await expect(custody.prepareRotation()).rejects.toThrow('rotation_unavailable');
  f.setIdentity({...old,state:'active'});await custody.prepareRotation();f.setState({status:'authenticated',uid:'bob'});
  await expect(custody.confirmBackup()).rejects.toThrow('identity_changed');expect(f.keys).toHaveLength(1);
  f.setState({status:'authenticated',uid:'alice'});await custody.prepareRotation();f.setFailure(true);
  await expect(custody.confirmBackup()).rejects.toThrow('network_failed');
  const other=await keypairFromSeed(new Uint8Array(32).fill(42));f.setIdentity({...old,publicKeyB64:other.publicKeyB64,state:'active'});
  const next=createSeedKeyCustody(f.session,f.store);expect((await next.inspect()).rotationPending).toBe(false);
  await expect(next.retryRotation()).rejects.toThrow('rotation_unavailable');
});
it('does not submit a saved rotation when the device candidate or its proofs are damaged',async()=>{
  const f=fixture(),custody=createSeedKeyCustody(f.session,f.store);
  await custody.prepare();await custody.confirmBackup();await custody.prepareRotation();f.setFailure(true);
  await expect(custody.confirmBackup()).rejects.toThrow('network_failed');
  f.setFailure(false);f.session.signingCommand.mockClear();
  const next=createSeedKeyCustody(f.session,f.store),candidate=f.keys[1];
  candidate.privateKey=f.keys[0].privateKey;
  await expect(next.retryRotation()).rejects.toThrow('invalid_device_key');
  expect(f.session.signingCommand).not.toHaveBeenCalled();
});
