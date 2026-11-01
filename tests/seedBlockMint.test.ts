import {it,expect,vi} from 'vitest';
import {createSeedBlockMint} from '../src/services/independent/blockMint';
import {keypairFromSeed,verifyPreimage} from '../src/services/signingCrypto';
import {sha256} from '../src/utils/crypto';
import {blockSignaturePayload,blockSignaturePreimage,judgeBlockBirth} from '../src/domain/chain/birth';
import type {SeedSession as SeedSessionState} from '../src/services/independent/session';
async function fixture() {
  const lid='01900000-0000-7000-8000-000000000001',key={...await keypairFromSeed(new Uint8Array(32).fill(12)),uid:'alice',lid};
  let state:SeedSessionState={status:'authenticated',uid:'alice'};
  const identity={uid:'alice',lid,publicKeyB64:key.publicKeyB64,fingerprint:await sha256(key.publicKeyB64),epochId:'anchor_test',state:'active'};
  const bearer={latestHash:'prior',blockHeight:1,visibility:'private',title:'Dream'};
  const session={snapshot:()=>state,read:vi.fn(async(path:string)=>{
    if(path==='/v1/me/profile')return {profile:{uid:'alice',lid}};
    if(path.startsWith('/v1/signing-identity'))return {identity};
    return path.startsWith('/v1/trees')?{tree:bearer}:{vision:bearer};
  }),blockCommand:vi.fn(async(command:unknown)=>({pulseId:'new',command}))};
  const store={list:vi.fn(async()=>[key]),save:vi.fn(async()=>{})};
  return {session,store,identity,bearer,key,setState:(next:SeedSessionState)=>{state=next;}};
}
it('signs server-normalized content and freezes the reviewed request against later edits',async()=>{
  const f=await fixture(),mint=createSeedBlockMint(f.session,f.store),block={type:'tree_growth',body:'Growth'};
  const preparing=mint.prepare('tree','oak',block);block.body='Edited';
  const review=await preparing;expect(review.content.body).toBe('Growth');expect(review.content.visibility).toBe('circle');
  review.content.body='Changed review';await mint.submit();
  const command=f.session.blockCommand.mock.calls[0][0] as {block:Record<string,unknown>;signature:{sig:string}};
  const normalized=judgeBlockBirth({on:'tree',minterUid:'alice',isStaff:false,bearer:{...f.bearer,exists:true,carer:true},block:command.block});
  expect(normalized.outcome).toBe('mint');if(normalized.outcome!=='mint')throw Error('rejected');
  expect(await verifyPreimage(f.key.publicKeyB64,command.signature.sig,blockSignaturePreimage(blockSignaturePayload({
    on:'tree',bearerId:'oak',previousHash:'prior',content:normalized.content,signerUid:'alice',keyFingerprint:f.identity.fingerprint,epochId:'anchor_test'})))).toBe(true);
  expect(command.block.body).toBe('Growth');await expect(mint.submit()).rejects.toThrow('review_required');
});
it('consumes an uncertain attempt without replaying or resigning it',async()=>{
  const f=await fixture(),mint=createSeedBlockMint(f.session,f.store);
  await mint.prepare('vision','dream',{type:'vision_growth',body:'Contribution'});
  f.session.blockCommand.mockRejectedValueOnce(new Error('api_unavailable'));
  await expect(mint.submit()).rejects.toThrow('api_unavailable');
  await expect(mint.submit()).rejects.toThrow('review_required');expect(f.session.blockCommand).toHaveBeenCalledTimes(1);
});
it('refuses missing device keys, frozen identities and inconsistent fingerprints',async()=>{
  const f=await fixture(),mint=createSeedBlockMint(f.session,f.store),block={type:'tree_growth'};
  f.identity.state='frozen';await expect(mint.prepare('tree','oak',block)).rejects.toThrow('block_key_frozen');
  f.identity.state='active';f.identity.fingerprint='wrong';await expect(mint.prepare('tree','oak',block)).rejects.toThrow('block_key_stale');
  f.identity.fingerprint=await sha256(f.key.publicKeyB64);f.store.list.mockResolvedValue([]);
  await expect(mint.prepare('tree','oak',block)).rejects.toThrow('restore_required');expect(f.session.blockCommand).not.toHaveBeenCalled();
});
it('invalidates a review on account changes and explicit cancellation',async()=>{
  const f=await fixture(),mint=createSeedBlockMint(f.session,f.store);
  await mint.prepare('tree','oak',{type:'tree_growth'});f.setState({status:'authenticated',uid:'bob'});
  await expect(mint.submit()).rejects.toThrow('identity_changed');expect(f.session.blockCommand).not.toHaveBeenCalled();
  f.setState({status:'authenticated',uid:'alice'});await mint.prepare('tree','oak',{type:'tree_growth'});mint.cancel();
  await expect(mint.submit()).rejects.toThrow('review_required');
});
