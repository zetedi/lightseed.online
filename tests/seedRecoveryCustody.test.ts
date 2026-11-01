import {expect,it,vi} from 'vitest';
import {createSeedRecoveryCustody} from '../src/services/independent/recoveryCustody';
import {recoveryCode,recoveryContext,recoveryProposal} from '../src/domain/seedRecovery';
import {keypairFromSeed} from '../src/services/signingCrypto';
import {sha256} from '../src/utils/crypto';
import {seedToPhrase} from '../src/domain/signing';
import type {DeviceKeyStore,DeviceSigningKey} from '../src/services/independent/keyStore';
import type {SeedSession} from '../src/services/independent/session';
import {verifiesRecoveryCandidate,verifiesRecoveryWitness} from '../seed/api/signing.mjs';
async function fixture() {
  const lid='01900000-0000-7000-8000-000000000001',old=await keypairFromSeed(new Uint8Array(32).fill(1));
  const context={uid:'alice',lid,fromFingerprint:await sha256(old.publicKeyB64),suspectedSinceMs:100};
  let current={uid:'alice',lid,publicKeyB64:old.publicKeyB64,fingerprint:context.fromFingerprint,epochId:'anchor',state:'frozen'};
  let state:SeedSession={status:'authenticated',uid:'alice'},fail=false,lost=false;
  const proposals=new Map<string,Record<string,unknown>>(),keys:DeviceSigningKey[]=[];
  const store:DeviceKeyStore={list:async(uid,id)=>keys.filter(k=>k.uid===uid && k.lid===id),save:async(key)=>{
    const index=keys.findIndex(k=>k.uid===key.uid && k.lid===key.lid && k.publicKeyB64===key.publicKeyB64);
    if(index<0)keys.push(structuredClone(key));else keys[index]=structuredClone(key);
  }};
  const session={snapshot:()=>state,read:async(path:string)=>{
    const url=new URL(path,'https://test.invalid');
    if(url.pathname==='/v1/me/profile')return {profile:{uid:current.uid,lid:current.lid}};
    if(url.pathname==='/v1/me/signing-recovery')return {context};
    if(url.pathname==='/v1/signing-identity')return {identity:current};
    if(url.pathname==='/v1/signing-recovery'){
      const proposal=proposals.get(url.searchParams.get('event')!);if(!proposal)throw new Error('api_unavailable');return {proposal};
    }
    throw new Error('unexpected_path');
  },signingCommand:vi.fn(async(value:unknown)=>{
    if(fail)throw new Error('network_failed');
    const command=value as Record<string,string>,uid=state.status==='authenticated'?state.uid:'';
    if(command.action==='begin_recovery') {
      if(!verifiesRecoveryCandidate(context,command))throw new Error('invalid_candidate');
      if(proposals.has(command.eventId))throw new Error('already_exists');
      proposals.set(command.eventId,{...context,...command,id:command.eventId,status:'open'});
    } else if(command.action==='activate_recovery') {
      const proposal=proposals.get(command.eventId)!;
      current={...current,publicKeyB64:String(proposal.toPubkey),fingerprint:String(proposal.toFingerprint),epochId:command.eventId,state:'active'};
      proposal.status='activated';
    } else if(command.action==='witness_recovery') {
      if(!verifiesRecoveryWitness(uid,proposals.get(command.eventId),command))throw new Error('invalid_witness');
    } else throw new Error('unexpected_command');
    if(lost)throw new Error('response_lost');return {};
  })};
  return {session,store,keys,context,proposals,old,getCurrent:()=>current,
    setCurrent:(patch:Partial<typeof current>)=>{current={...current,...patch};},
    setState:(value:SeedSession)=>{state=value;},setFailure:(v:boolean)=>{fail=v;},setLost:(v:boolean)=>{lost=v;}};
}
it('validates recovery context, proposal shape, and codes without confusing UID colons',()=>{
  expect(recoveryCode('account:alice:event')).toEqual({uid:'account:alice',eventId:'event'});
  for(const code of ['no-colon',':event','alice:','alice:bad/event','alice\n:event'])expect(recoveryCode(code)).toBeNull();
  expect(recoveryContext({uid:'alice',lid:'wrong',fromFingerprint:'a'.repeat(64),suspectedSinceMs:1})).toBeNull();
  expect(recoveryProposal({})).toBeNull();
});
it('backs up a fresh recovery key before saving or proposing and reconciles lost success responses',async()=>{
  const f=await fixture(),custody=createSeedRecoveryCustody(f.session,f.store);
  expect(await custody.inspect()).toEqual({frozen:true,codes:[]});
  const {words}=await custody.prepare();expect(words).toHaveLength(24);expect(f.keys).toHaveLength(0);
  expect(f.session.signingCommand).not.toHaveBeenCalled();f.setLost(true);
  const {code}=await custody.confirmBackup();expect(code).toContain('alice:');
  expect(f.keys).toHaveLength(1);expect(f.keys[0].privateKey.extractable).toBe(false);
  expect(f.getCurrent().publicKeyB64).toBe(f.old.publicKeyB64);expect((await custody.inspect()).codes).toEqual([code]);
  const next=createSeedRecoveryCustody(f.session,f.store);
  await expect(next.prepare()).rejects.toThrow('recovery_already_saved');
  // Existing proposal response reconciles retries without producing another event.
  await next.retry(code);expect(f.proposals.size).toBe(1);expect(f.keys).toHaveLength(1);
  const key=f.keys[0];f.keys.length=0;await next.restore(code,words.join(' '));expect(f.keys[0].publicKeyB64).toBe(key.publicKeyB64);
});
it('retains an unpublished candidate across reload and resumes its exact event',async()=>{
  const f=await fixture(),custody=createSeedRecoveryCustody(f.session,f.store);
  await custody.prepare();f.setFailure(true);await expect(custody.confirmBackup()).rejects.toThrow('network_failed');
  const saved=f.keys[0].recovery!,next=createSeedRecoveryCustody(f.session,f.store);
  expect((await next.inspect()).codes).toEqual(['alice:'+saved.command.eventId]);
  f.setFailure(false);await next.retry('alice:'+saved.command.eventId);
  expect(f.session.signingCommand).toHaveBeenLastCalledWith(saved.command);expect(f.proposals.size).toBe(1);
});
it('refuses stale account or frozen context before proposing a saved replacement',async()=>{
  const f=await fixture(),custody=createSeedRecoveryCustody(f.session,f.store);
  await custody.prepare();f.setState({status:'authenticated',uid:'bob'});
  await expect(custody.confirmBackup()).rejects.toThrow('identity_changed');expect(f.keys).toHaveLength(0);
  f.setState({status:'authenticated',uid:'alice'});await custody.prepare();f.context.suspectedSinceMs++;
  await expect(custody.confirmBackup()).rejects.toThrow('identity_changed');expect(f.keys).toHaveLength(0);
});
it('rejects mismatched restoration and requires local possession before activation',async()=>{
  const f=await fixture(),custody=createSeedRecoveryCustody(f.session,f.store);
  const {words}=await custody.prepare(),{code}=await custody.confirmBackup();f.keys.length=0;
  await expect(custody.activate(code)).rejects.toThrow('restore_required');
  await expect(custody.restore(code,seedToPhrase(new Uint8Array(32).fill(9)).join(' '))).rejects.toThrow('restore_mismatch');
  expect(f.keys).toHaveLength(0);await custody.restore(code,words.join(' '));
  f.setLost(true);await custody.activate(code);expect(f.getCurrent().state).toBe('active');
  const calls=f.session.signingCommand.mock.calls.length;await custody.activate(code);expect(f.session.signingCommand).toHaveBeenCalledTimes(calls);
  await custody.retry(code);expect(f.session.signingCommand).toHaveBeenCalledTimes(calls);
});
it('rejects damaged candidate keys before activation',async()=>{
  const f=await fixture(),custody=createSeedRecoveryCustody(f.session,f.store);
  await custody.prepare();const {code}=await custody.confirmBackup();f.keys[0].privateKey=f.old.privateKey;
  f.session.signingCommand.mockClear();await expect(custody.activate(code)).rejects.toThrow('invalid_device_key');expect(f.session.signingCommand).not.toHaveBeenCalled();
});
it('witnesses only the reviewed proposal with the active local key and rechecks before signing',async()=>{
  const f=await fixture(),custody=createSeedRecoveryCustody(f.session,f.store);
  await custody.prepare();const {code}=await custody.confirmBackup(),reviewed=await custody.read(code);
  await expect(custody.witness(reviewed)).rejects.toThrow('recovery_changed');
  const bob=await keypairFromSeed(new Uint8Array(32).fill(8));f.setState({status:'authenticated',uid:'bob'});
  f.setCurrent({uid:'bob',publicKeyB64:bob.publicKeyB64,fingerprint:await sha256(bob.publicKeyB64),state:'active'});
  await f.store.save({...bob,uid:'bob',lid:f.context.lid});
  await custody.witness(reviewed);expect(f.session.signingCommand).toHaveBeenLastCalledWith(expect.objectContaining({action:'witness_recovery',targetUid:'alice',pubkey:bob.publicKeyB64}));
  const proposal=f.proposals.get(reviewed.id)!;proposal.status='activated';
  await expect(custody.witness(reviewed)).rejects.toThrow('recovery_changed');
});
it('does not trust a tampered server recovery proof or a context outside the person identity',async()=>{
  const f=await fixture(),custody=createSeedRecoveryCustody(f.session,f.store);
  await custody.prepare();const {code}=await custody.confirmBackup(),saved=f.keys[0].recovery!;
  f.proposals.get(saved.command.eventId)!.suspectedSinceMs=999;
  await expect(custody.read(code)).rejects.toThrow('invalid_recovery_proposal');
  f.setCurrent({lid:'01900000-0000-7000-8000-000000000002'});
  await expect(custody.prepare()).rejects.toThrow('identity_changed');
});
