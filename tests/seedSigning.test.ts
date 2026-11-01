import {expect,it} from 'vitest';
import {generateKeyPairSync} from 'node:crypto';
import {seedSigningCommand,seedSigningQuery} from '../src/domain/seedSigning.mjs';
import {seedRequest} from '../src/domain/seedRequest.mjs';
it('accepts only canonical public Ed25519 key publication without authority fields',()=>{
  const key=generateKeyPairSync('ed25519').publicKey.export({format:'der',type:'spki'}).toString('base64');
  expect(seedSigningCommand({action:'anchor',publicKeyB64:key})).toEqual({action:'anchor',publicKeyB64:key});
  for(const value of [{action:'anchor',publicKeyB64:key,uid:'other'},{action:'anchor',publicKeyB64:key,recordedAt:0},
    {action:'anchor',publicKeyB64:key,privateKey:'secret'},{action:'anchor',publicKeyB64:key+'\n'},
    {action:'anchor',publicKeyB64:'not a key'},{action:'rotate',publicKeyB64:key}])expect(seedSigningCommand(value)).toBeNull();
  expect(seedRequest('POST','/v1/signing/command',undefined)).toMatchObject({status:401});
  expect(seedRequest('POST','/v1/signing/command','Bearer token',true)).toEqual({kind:'signingCommand'});
  expect(seedSigningQuery(new URLSearchParams('id=alice'))).toEqual({kind:'signingIdentity',id:'alice'});
  for(const query of ['id=','id=a&id=b','id=a&private=true'])expect(seedSigningQuery(new URLSearchParams(query))).toBeNull();
});

it('binds freeze to an observed epoch without accepting backdated receipts or replacement keys',async()=>{
  const command={action:'freeze',epochId:'anchor_'+'a'.repeat(64),fingerprint:'a'.repeat(64)};
  expect(seedSigningCommand(command)).toEqual(command);
  for(const extra of [{uid:'other'},{recordedAt:0},{publicKeyB64:'replacement'},{suspectedSinceMs:-1},{suspectedSinceMs:1.2},{epochId:'bad\nepoch'}])expect(seedSigningCommand({...command,...extra})).toBeNull();
  const {seedSigningHistoryQuery}=await import('../src/domain/seedSigning.mjs');
  expect(seedSigningHistoryQuery(new URLSearchParams('id=alice&kind=keys&limit=1'))).toMatchObject({id:'alice',collection:'keys',limit:1});
  for(const query of ['id=','id=a&kind=recoveries','id=a&limit=101','id=a&after=','id=a&id=b'])expect(seedSigningHistoryQuery(new URLSearchParams(query))).toBeNull();
});

it('verifies both rotation signatures over the existing fixed-field contract',async()=>{
  const {createHash,sign}=await import('node:crypto');
  const {verifiesRotation}=await import('../seed/api/signing.mjs');
  const {seedRotationPreimage}=await import('../src/domain/seedSigning.mjs');
  const {keyRotationPreimage}=await import('../src/domain/keyEpoch');
  const old=generateKeyPairSync('ed25519'),next=generateKeyPairSync('ed25519');
  const pub=(key:typeof old)=>key.publicKey.export({format:'der',type:'spki'}).toString('base64');
  const fp=(key:string)=>createHash('sha256').update(key).digest('hex');
  const fields={action:'rotate',eventId:'rotation',lid:'01900000-0000-7000-8000-000000000001',fromPubkey:pub(old),toPubkey:pub(next),fromFingerprint:fp(pub(old)),toFingerprint:fp(pub(next))};
  const preimage=seedRotationPreimage('alice',fields);
  expect(preimage).toBe(keyRotationPreimage({uid:'alice',...fields}));
  const command={...fields,oldSig:sign(null,Buffer.from(preimage),old.privateKey).toString('base64'),newSig:sign(null,Buffer.from(preimage),next.privateKey).toString('base64')};
  expect(verifiesRotation('alice',command)).toBe(true);
  expect(verifiesRotation('bob',command)).toBe(false);
  for(const extra of [{eventId:'different'},{oldSig:command.newSig},{newSig:command.oldSig},{fromFingerprint:'0'.repeat(64)},{uid:'alice'},{oldSig:command.oldSig+'\n'}])expect(verifiesRotation('alice',{...command,...extra})).toBe(false);
});

it('binds a recovery candidate to the frozen identity and existing recovery preimage',async()=>{
  const {createHash,sign}=await import('node:crypto');
  const {seedRecoveryPreimage}=await import('../src/domain/seedSigning.mjs');
  const {keyRecoveryPreimage}=await import('../src/domain/keyEpoch');
  const {verifiesRecoveryCandidate}=await import('../seed/api/signing.mjs');
  const candidate=generateKeyPairSync('ed25519');
  const toPubkey=candidate.publicKey.export({format:'der',type:'spki'}).toString('base64');
  const context={uid:'alice',lid:'01900000-0000-7000-8000-000000000001',fromFingerprint:'a'.repeat(64),suspectedSinceMs:100};
  const command={action:'begin_recovery',eventId:'recover',toPubkey,toFingerprint:createHash('sha256').update(toPubkey).digest('hex')};
  const claim={...context,...command};
  expect(seedRecoveryPreimage(claim)).toBe(keyRecoveryPreimage(claim));
  const proof={...command,newSig:sign(null,Buffer.from(seedRecoveryPreimage(claim)),candidate.privateKey).toString('base64')};
  expect(verifiesRecoveryCandidate(context,proof)).toBe(true);
  for(const changed of [{uid:'bob'},{suspectedSinceMs:101},{lid:'other'}])expect(verifiesRecoveryCandidate({...context,...changed},proof)).toBe(false);
  expect(seedSigningCommand({...proof,suspectedSinceMs:0})).toBeNull();
  expect(seedRequest('GET','/v1/me/signing-recovery',undefined)).toMatchObject({status:401});
  expect(seedRequest('GET','/v1/signing-recovery?id=alice&event=recover',undefined)).toMatchObject({status:401});
});

it('binds recovery witness proofs to the witness UID and exact candidate claim',async()=>{
  const {createHash,sign}=await import('node:crypto');
  const {seedRecoveryWitnessPreimage}=await import('../src/domain/seedSigning.mjs');
  const {keyRecoveryWitnessPreimage}=await import('../src/domain/keyEpoch');
  const {verifiesRecoveryWitness}=await import('../seed/api/signing.mjs');
  const key=generateKeyPairSync('ed25519'),pubkey=key.publicKey.export({format:'der',type:'spki'}).toString('base64');
  const proposal={uid:'alice',id:'recovery',status:'open',lid:'01900000-0000-7000-8000-000000000001',fromFingerprint:'a'.repeat(64),toFingerprint:'b'.repeat(64),suspectedSinceMs:100};
  const claim={...proposal,eventId:proposal.id};
  const preimage=seedRecoveryWitnessPreimage(claim,'bob');
  expect(preimage).toBe(keyRecoveryWitnessPreimage(claim,'bob'));
  const command={action:'witness_recovery',targetUid:'alice',eventId:'recovery',pubkey,keyFingerprint:createHash('sha256').update(pubkey).digest('hex'),epochId:'anchor',sig:sign(null,Buffer.from(preimage),key.privateKey).toString('base64')};
  expect(verifiesRecoveryWitness('bob',proposal,command)).toBe(true);
  expect(verifiesRecoveryWitness(undefined,proposal,command)).toBe(false);
  expect(verifiesRecoveryWitness('bob\n',proposal,command)).toBe(false);
  expect(verifiesRecoveryWitness('alice',proposal,command)).toBe(false);
  expect(verifiesRecoveryWitness('carol',proposal,command)).toBe(false);
  expect(verifiesRecoveryWitness('bob',{...proposal,toFingerprint:'c'.repeat(64)},command)).toBe(false);
  expect(seedSigningCommand({...command,witnessUid:'someone'})).toBeNull();
});

it('accepts activation only by event reference, never caller-supplied quorum or key authority',()=>{
  expect(seedSigningCommand({action:'activate_recovery',eventId:'recovery'})).toEqual({action:'activate_recovery',eventId:'recovery'});
  for(const extra of [{uid:'other'},{witnesses:['a','b','c']},{toPubkey:'key'},{suspectedSinceMs:0},{eventId:''}])expect(seedSigningCommand({action:'activate_recovery',eventId:'recovery',...extra})).toBeNull();
});

it('requires authentication and bounded distinct parameters for recovery witness pages',async()=>{
  const {seedRecoveryWitnessQuery}=await import('../src/domain/seedSigning.mjs');
  const target='/v1/signing-recovery-witnesses?id=alice&event=recover&limit=2';
  expect(seedRequest('GET',target,undefined)).toMatchObject({status:401});
  expect(seedRequest('GET',target,'Bearer verified',true)).toEqual({kind:'recoveryWitnesses',id:'alice',event:'recover',after:null,limit:2});
  expect(seedRecoveryWitnessQuery(new URLSearchParams('id=alice&event=r&after=bob__epoch'))).toMatchObject({after:'bob__epoch',limit:50});
  for(const query of ['id=a','id=a&event=','id=a&event=r&limit=101','id=a&event=r&limit=0','id=a&event=r&limit=1&limit=2',
    'id=a&event=r&after=','id=a&event=r&after=%0A','id=a&event=r&private=true','id=a&event=r&event=x','id=a&id=b&event=r']) {
    expect(seedRecoveryWitnessQuery(new URLSearchParams(query))).toBeNull();
    expect(seedRequest('GET','/v1/signing-recovery-witnesses?'+query,'Bearer verified',true)).toMatchObject({status:400});
  }
});
