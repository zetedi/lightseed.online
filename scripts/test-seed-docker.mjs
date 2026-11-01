#!/usr/bin/env node
// Disposable Docker proof. Never mounts seed/data or reads installation credentials.
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, generateKeyPairSync, createHash, sign } from 'node:crypto';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import {seedRotationPreimage,seedRecoveryPreimage,seedRecoveryWitnessPreimage} from '../src/domain/seedSigning.mjs';
import {buildSeedDomain} from '../seed/build-domain.mjs';
import { authFixture } from '../tests/seed/auth-fixture.mjs';

await buildSeedDomain();
const {judgeBlockBirth,blockSignaturePayload,blockSignaturePreimage,computeCanonicalHash}=await import('../seed/generated/chain.mjs');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const directory = await mkdtemp(join(tmpdir(), 'lightseed-docker-'));
const project = `lightseed-check-${randomBytes(6).toString('hex')}`;
const credentials = join(directory, 'runtime.env');
const override = join(directory, 'compose.yml');
const fixture = authFixture();
fixture.config.bindings.push({subject:'issuer-carol',uid:'carol'},{subject:'issuer-dave',uid:'dave'});
const authConfig = join(directory, 'auth.json');
const env = { ...process.env, COMPOSE_PROJECT_NAME: project, COMPOSE_PROFILES: '',
  COMPOSE_FILE: [join(root, 'seed/docker-compose.yml'), override].join(delimiter),
  SEED_NODE_ORIGIN: 'https://app.example.test', SEED_DB_PASSWORD: randomBytes(32).toString('base64url') };
const run = (command, args, input, extraEnv = {}) => new Promise((accept, reject) => {
  const child = spawn(command, args, { cwd: root, env: { ...env, ...extraEnv }, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  child.on('error', reject);
  child.stdin.on('error', () => {});
  child.on('close', code => accept({ code, stdout, stderr }));
  child.stdin.end(input);
});
const checked = async (command, args, input, extraEnv) => {
  const result = await run(command, args, input, extraEnv);
  if (result.code !== 0) {
    // No command arguments or stdout (which may be a private dump) in diagnostics.
    throw new Error(`${command} failed (${result.code}): ${result.stderr.replaceAll(env.SEED_DB_PASSWORD, '[redacted]').slice(-4000)}`);
  }
  return result.stdout;
};
const compose = (args, input) => checked('docker', ['compose', ...args], input);
const sql = query => compose(['exec', '-T', 'db', 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'lightseed', '-d', 'lightseed'], query);
let cleanup = false;
try {
  await writeFile(authConfig, JSON.stringify({ ...fixture.config, enrollment: 'open' }), { mode: 0o644 }); // public keys, inside private test directory
  await writeFile(override, `services:
  db:
    volumes: !override
      - check_data:/var/lib/postgresql/data
    ports: !reset []
  api:
    environment:
      SEED_AUTH_CONFIG: /run/lightseed-auth.json
    volumes:
      - type: bind
        source: ${JSON.stringify(authConfig)}
        target: /run/lightseed-auth.json
        read_only: true
    env_file: !override
      - ${JSON.stringify(credentials)}
    ports: !override
      - '127.0.0.1::8081'
volumes:
  check_data:
`, { mode: 0o600 });
  console.log('Building the PostgreSQL-only API image.');
  cleanup = true;
  await compose(['build', 'api']);
  console.log('Starting a fresh isolated PostgreSQL container.');
  await compose(['up', '-d', '--wait', 'db']);
  await checked(process.execPath, ['scripts/migrate-seed.mjs']);
  await checked(process.execPath, ['scripts/migrate-seed.mjs']);
  await checked(process.execPath, ['scripts/provision-seed.mjs', credentials]);
  await sql(`INSERT INTO links(from_id,rel,to_id,lid,doc) VALUES
    ('alice','joined','vision','public-a','{}'), ('bob','joined','vision','public-b','{}');
    INSERT INTO secret_links(from_id,rel,to_id,lid) VALUES ('alice','keeper','vision','private-seat');
    INSERT INTO communities VALUES ('garden', '{"name":"Garden","door":"invite"}');`);
  console.log('Starting the API with restricted credentials and checking HTTP behavior.');
  await compose(['--profile', 'api', 'up', '-d', '--wait']);
  let origin = 'http://' + (await compose(['port', 'api', '8081'])).trim();
  const get = async (path, token) => {
    const r = await fetch(origin + path, { signal: AbortSignal.timeout(10000), headers: { connection: 'close', ...(token ? { authorization: 'Bearer ' + token } : {}) } });
    return { status: r.status, body: await r.json() };
  };
  assert.equal((await get('/readyz')).status, 200);
  const community = { id: 'garden', name: 'Garden', door: 'invite' };
  assert.deepEqual((await get('/v1/communities')).body, { communities: [community], next: null });
  const enrolledToken = fixture.token({ sub: 'new-independent-person' });
  const enrolled = await get('/v1/me', enrolledToken);
  assert.equal(enrolled.status, 200);
  assert.match(enrolled.body.uid, /^oidc_/);
  const alice = fixture.token({ uid: 'bob' });
  assert.deepEqual((await get('/v1/me', alice)).body, { uid: 'alice' });
  assert.equal((await get('/v1/me/profile', alice)).body.profile, null);
  const savedResponse = await fetch(origin + '/v1/me/profile', { method: 'POST',
    headers: { authorization: 'Bearer ' + alice, 'content-type': 'application/json' },
    body: JSON.stringify({ displayName: 'Alice Willow' }) });
  assert.equal(savedResponse.status, 200);
  const savedProfile = (await savedResponse.json()).profile;
  assert.equal(savedProfile.uid, 'alice');
  assert.deepEqual((await get('/v1/beings?lid='+savedProfile.lid)).body,{being:{kind:'person',id:'alice',lid:savedProfile.lid}});
  const imageBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAEUlEQVQImWNw6Qh16QhlgFAAH2YEhTh+J0EAAAAASUVORK5CYII=', 'base64');
  const upload = await fetch(origin + '/v1/media/upload', { method: 'POST',
    headers: { authorization: 'Bearer ' + alice, 'content-type': 'image/png', 'x-lightseed-media-path': 'users/alice/docker.png' }, body: imageBytes });
  assert.equal(upload.status, 201);
  const uploaded = await upload.json();
  const pictureResponse=await fetch(origin+'/v1/me/profile',{method:'POST',headers:{authorization:'Bearer '+alice,'content-type':'application/json'},
    body:JSON.stringify({action:'set_picture',slot:'siteLogoUrl',path:'users/alice/docker.png'})});
  assert.equal(pictureResponse.status,200);
  Object.assign(savedProfile,(await pictureResponse.json()).profile);
  assert.equal(savedProfile.siteLogoUrl,'/v1/media?path=users/alice/docker.png');
  const mediaBeforeRestart = new Map();
  for (const url of [uploaded.url, uploaded.variants.small, uploaded.variants.large]) {
    const response = await fetch(origin + url); assert.equal(response.status, 200);
    mediaBeforeRestart.set(url, Buffer.from(await response.arrayBuffer()));
  }
  const post = async (path, value, token=alice) => {
    const response = await fetch(origin + path, { method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify(value) });
    assert.equal(response.status, 200); return response.json();
  };
  const originalSigningKey=generateKeyPairSync('ed25519');
  const publicKeyB64=originalSigningKey.publicKey.export({format:'der',type:'spki'}).toString('base64');
  const signingIdentity=(await post('/v1/signing/command',{action:'anchor',publicKeyB64})).identity;
  assert.equal(signingIdentity.uid,'alice');assert.equal(signingIdentity.state,'active');
  assert.deepEqual((await get('/v1/signing-identity?id=alice')).body.identity,signingIdentity);
  assert.deepEqual((await post('/v1/signing/command',{action:'anchor',publicKeyB64})).identity,signingIdentity);
  const nextSigningKey=generateKeyPairSync('ed25519');
  const nextPubkey=nextSigningKey.publicKey.export({format:'der',type:'spki'}).toString('base64');
  const rotation={action:'rotate',eventId:'rotation-docker',lid:signingIdentity.lid,fromPubkey:publicKeyB64,toPubkey:nextPubkey,
    fromFingerprint:signingIdentity.fingerprint,toFingerprint:createHash('sha256').update(nextPubkey).digest('hex')};
  const rotationBytes=Buffer.from(seedRotationPreimage('alice',rotation));
  const rotated=(await post('/v1/signing/command',{...rotation,oldSig:sign(null,rotationBytes,originalSigningKey.privateKey).toString('base64'),
    newSig:sign(null,rotationBytes,nextSigningKey.privateKey).toString('base64')})).identity;
  assert.equal(rotated.publicKeyB64,nextPubkey);Object.assign(signingIdentity,rotated);
  const frozen=(await post('/v1/signing/command',{action:'freeze',epochId:signingIdentity.epochId,fingerprint:signingIdentity.fingerprint})).identity;
  assert.equal(frozen.state,'frozen');Object.assign(signingIdentity,frozen);
  assert.equal((await get('/v1/me/signing-recovery')).status,401);
  const recoveryContext=(await get('/v1/me/signing-recovery',alice)).body.context;
  const recoveryKey=generateKeyPairSync('ed25519');
  const recoveryPubkey=recoveryKey.publicKey.export({format:'der',type:'spki'}).toString('base64');
  const recovery={action:'begin_recovery',eventId:'recovery-docker',toPubkey:recoveryPubkey,toFingerprint:createHash('sha256').update(recoveryPubkey).digest('hex')};
  const recoverySig=sign(null,Buffer.from(seedRecoveryPreimage({...recoveryContext,...recovery})),recoveryKey.privateKey).toString('base64');
  assert.equal((await post('/v1/signing/command',{...recovery,newSig:recoverySig})).eventId,'recovery-docker');
  assert.equal((await get('/v1/signing-recovery?id=alice&event=recovery-docker')).status,401);
  assert.equal((await get('/v1/signing-recovery?id=alice&event=recovery-docker',alice)).body.proposal.status,'open');
  assert.equal((await get('/v1/signing-identity?id=alice')).body.identity.state,'frozen');
  const bobToken=fixture.token({sub:'issuer-bob'});
  await post('/v1/me/profile',{displayName:'Bob'},bobToken);
  const witnessKey=generateKeyPairSync('ed25519');
  const witnessPubkey=witnessKey.publicKey.export({format:'der',type:'spki'}).toString('base64');
  const witnessIdentity=(await post('/v1/signing/command',{action:'anchor',publicKeyB64:witnessPubkey},bobToken)).identity;
  await sql("INSERT INTO initiates VALUES ('bob','{}');");
  const witnessSig=sign(null,Buffer.from(seedRecoveryWitnessPreimage({...recoveryContext,...recovery},'bob')),witnessKey.privateKey).toString('base64');
  assert.deepEqual(await post('/v1/signing/command',{action:'witness_recovery',targetUid:'alice',eventId:recovery.eventId,sig:witnessSig,
    pubkey:witnessPubkey,keyFingerprint:witnessIdentity.fingerprint,epochId:witnessIdentity.epochId},bobToken),{witnessed:true});
  assert.equal((await get('/v1/signing-identity?id=alice')).body.identity.state,'frozen');
  for(const uid of ['carol','dave']) {
    const token=fixture.token({sub:'issuer-'+uid});await post('/v1/me/profile',{displayName:uid},token);
    const key=generateKeyPairSync('ed25519'),pubkey=key.publicKey.export({format:'der',type:'spki'}).toString('base64');
    const current=(await post('/v1/signing/command',{action:'anchor',publicKeyB64:pubkey},token)).identity;
    await sql(`INSERT INTO initiates VALUES ('${uid}','{}');`);
    const sig=sign(null,Buffer.from(seedRecoveryWitnessPreimage({...recoveryContext,...recovery},uid)),key.privateKey).toString('base64');
    await post('/v1/signing/command',{action:'witness_recovery',targetUid:'alice',eventId:recovery.eventId,sig,pubkey,keyFingerprint:current.fingerprint,epochId:current.epochId},token);
  }
  const witnessPath='/v1/signing-recovery-witnesses?id=alice&event='+recovery.eventId;
  assert.equal((await get(witnessPath)).status,401);
  const witnesses=(await get(witnessPath+'&limit=2',bobToken)).body;
  assert.equal(witnesses.items.length,2);assert.ok(witnesses.next);
  const finalWitnesses=(await get(witnessPath+'&after='+encodeURIComponent(witnesses.next),bobToken)).body;
  assert.equal(finalWitnesses.items.length,1);assert.equal(finalWitnesses.next,null);
  assert.deepEqual([...witnesses.items,...finalWitnesses.items].map(w=>w.witnessUid),['bob','carol','dave']);
  const recovered=(await post('/v1/signing/command',{action:'activate_recovery',eventId:recovery.eventId})).identity;
  assert.equal(recovered.state,'active');assert.equal(recovered.publicKeyB64,recoveryPubkey);Object.assign(signingIdentity,recovered);
  assert.equal((await get('/v1/signing-recovery?id=alice&event=recovery-docker',bobToken)).body.proposal.status,'activated');
  const signingHistory=(await get('/v1/signing-history?id=alice&limit=1')).body;
  assert.equal(signingHistory.items[0].type,'anchor');assert.ok(signingHistory.next);
  assert.equal((await get('/v1/signing-history?id=alice&after='+encodeURIComponent(signingHistory.next))).body.items[0].type,'freeze');
  await sql(`INSERT INTO lifetrees VALUES ('mint-tree','{"anchorUid":"alice","latestHash":"root","blockHeight":0}');`);
  const unsignedResponse=await fetch(origin+'/v1/blocks/command',{method:'POST',headers:{authorization:'Bearer '+alice,'content-type':'application/json'},body:JSON.stringify({action:'mint',on:'tree',id:'mint-tree',block:{type:'tree_growth'}})});
  assert.equal(unsignedResponse.status,403);assert.deepEqual(await unsignedResponse.json(),{error:'block_unsigned'});
  const mintBlock={type:'tree_growth',body:'Docker signed growth'};
  const mintJudgment=judgeBlockBirth({on:'tree',minterUid:'alice',isStaff:false,bearer:{exists:true,carer:true,latestHash:'root',blockHeight:0},block:mintBlock});
  assert.equal(mintJudgment.outcome,'mint');
  const mintPayload=blockSignaturePayload({on:'tree',bearerId:'mint-tree',previousHash:'root',content:mintJudgment.content,signerUid:'alice',keyFingerprint:recovered.fingerprint,epochId:recovered.epochId});
  const minted=await post('/v1/blocks/command',{action:'mint',on:'tree',id:'mint-tree',block:mintBlock,signature:{previousHash:'root',keyFingerprint:recovered.fingerprint,epochId:recovered.epochId,sig:sign(null,Buffer.from(blockSignaturePreimage(mintPayload)),recoveryKey.privateKey).toString('base64')}});
  assert.equal(minted.blockHeight,1);assert.equal((await get('/v1/trees?id=mint-tree',alice)).body.tree.latestHash,minted.hash);
  const mintedRecord=JSON.parse((await sql(`SELECT doc FROM pulses WHERE id='${minted.pulseId}';`)).trim());
  assert.equal(await computeCanonicalHash('root',mintedRecord.mintedAt,mintedRecord),minted.hash);
  assert.equal((await get('/v1/pulses?id='+minted.pulseId)).body.pulse.hash,minted.hash);
  assert.equal((await get('/v1/pulses?tree=mint-tree&limit=1')).body.pulses[0].id,minted.pulseId);
  await sql(`INSERT INTO pulses VALUES ('private-reach','{"type":"reach","visibility":"public","authorId":"alice","recipientUid":"bob","lifetreeId":"mint-tree"}');`);
  assert.equal((await get('/v1/pulses?id=private-reach')).status,404);
  assert.equal((await get('/v1/pulses?id=private-reach',bobToken)).body.pulse.id,'private-reach');
  assert.deepEqual((await get('/v1/pulses?tree=mint-tree')).body.pulses.map(pulse=>pulse.id),[minted.pulseId]);

  await sql(`INSERT INTO lifetrees VALUES ('offer-target','{"anchorUid":"bob","name":"Willow","visibility":"public"}');`);
  const createdOffering=(await post('/v1/offerings/command',{action:'create',kind:'service',title:'Docker care',body:'Private terms',appreciation:21,
    fromTreeId:'mint-tree',toKind:'tree',toId:'offer-target',visibility:'private'})).offering;
  assert.equal(createdOffering.authorId,'alice');assert.equal(createdOffering.offeredToKeeperUid,'bob');
  assert.equal(Object.hasOwn(createdOffering,'birthPreimage'),false);
  assert.equal((await get('/v1/pulses?id='+createdOffering.id)).status,404);
  assert.equal((await get('/v1/pulses?id='+createdOffering.id,bobToken)).status,200);
  assert.equal((await get('/v1/trees?id=mint-tree',alice)).body.tree.latestHash,minted.hash);
  assert.equal((await sql(`SELECT count(*) FROM seed.offering_birth_proofs WHERE offering_id='${createdOffering.id}';`)).trim(),'1');
  const offerNotice=JSON.parse((await sql("SELECT doc FROM pulses WHERE doc->>'previousHash'='OFFER_NOTICE';")).trim());
  assert.equal((await get('/v1/pulses?id='+offerNotice.id)).status,404);
  assert.equal((await get('/v1/pulses?id='+offerNotice.id,bobToken)).status,200);
  const editOffering={action:'edit',id:createdOffering.id,title:'Reviewed care',body:'Agreed private terms',appreciation:22,url:'',visibility:'private'};
  const retoldOffering=(await post('/v1/offerings/command',editOffering)).offering;
  assert.equal(retoldOffering.hash,createdOffering.hash);assert.equal(retoldOffering.title,'Reviewed care');
  assert.equal((await post('/v1/offerings/command',{action:'set_active',id:createdOffering.id,active:false})).offering.offeringActive,false);
  await post('/v1/offerings/command',{action:'set_active',id:createdOffering.id,active:true});
  const acceptedOffering=await post('/v1/offerings/command',{action:'accept',id:createdOffering.id},bobToken);
  const lateEdit=await fetch(origin+'/v1/offerings/command',{method:'POST',headers:{authorization:'Bearer '+alice,'content-type':'application/json'},body:JSON.stringify(editOffering)});
  assert.equal(lateEdit.status,409);
  for(const action of ['withdraw','decline']) {
    const temporary=(await post('/v1/offerings/command',{action:'create',kind:'service',title:'Temporary care',body:'Terms',appreciation:1,
      fromTreeId:'mint-tree',toKind:'tree',toId:'offer-target'})).offering;
    const answered=(await post('/v1/offerings/command',{action,id:temporary.id},action==='withdraw'?alice:bobToken)).offering;
    assert.equal(answered.offeringStatus,action==='withdraw'?'withdrawn':'declined');
  }
  assert.equal((await get('/v1/pulses?id='+acceptedOffering.fromPulseId,bobToken)).status,200);
  assert.equal((await get('/v1/pulses?id='+acceptedOffering.toPulseId,alice)).status,200);

  const alignment=(await post('/v1/alignments/command',{action:'propose',fromTreeId:'mint-tree',targetPulseId:acceptedOffering.toPulseId})).alignment;
  assert.equal(alignment.targetUid,'bob');assert.equal(alignment.status,'PENDING');
  assert.equal((await get('/v1/alignments?id='+alignment.id)).status,404);
  await post('/v1/alignments/command',{action:'note',id:alignment.id,text:'Docker agreement'},bobToken);
  const aligned=await post('/v1/alignments/command',{action:'accept',id:alignment.id},bobToken);
  assert.equal((await get('/v1/alignments?id='+alignment.id,alice)).body.alignment.status,'ACCEPTED');
  assert.equal((await get('/v1/trees?id=mint-tree',alice)).body.tree.latestHash,(await get('/v1/pulses?id='+aligned.fromPulseId,alice)).body.pulse.hash);
  const secondAlignment=(await post('/v1/alignments/command',{action:'propose',fromTreeId:'mint-tree',targetPulseId:acceptedOffering.toPulseId})).alignment;
  assert.equal((await post('/v1/alignments/command',{action:'reject',id:secondAlignment.id},bobToken)).alignment.status,'REJECTED');

  await sql(`INSERT INTO pulses VALUES ('event-parent','{"type":"event","authorId":"alice","title":"Docker gathering","visibility":"private","domain":"app.example.test"}');`);
  const copiedEvent=(await post('/v1/events/command',{action:'duplicate',id:'event-parent'})).event;
  assert.equal(copiedEvent.descendsFromId,'event-parent');assert.equal(copiedEvent.authorId,'alice');
  assert.equal((await get('/v1/pulses?id='+copiedEvent.id)).status,404);
  assert.equal((await get('/v1/pulses?id='+copiedEvent.id,alice)).body.pulse.title,'Docker gathering');
  const createdEvent=(await post('/v1/events/command',{action:'create',title:'New gathering',body:'Welcome',eventDate:'2026-11-01T18:00',eventEndDate:'2026-11-02T12:00'})).event;
  assert.equal(createdEvent.authorId,'alice');assert.equal(createdEvent.domain,'app.example.test');
  const retoldEvent=(await post('/v1/events/command',{action:'edit',id:createdEvent.id,title:'Retold gathering',body:'Private words',visibility:'private'})).event;
  assert.equal(retoldEvent.hash,createdEvent.hash);assert.equal((await get('/v1/pulses?id='+createdEvent.id)).status,404);

  await sql(`INSERT INTO links(from_id,rel,to_id,lid) VALUES ('mint-tree','participant','${createdEvent.id}','event-participant-docker');`);
  const eventCircle=await post('/v1/events/command',{action:'form_circle',id:createdEvent.id,name:'Docker circle'});
  assert.equal(eventCircle.gathered,false);assert.equal(eventCircle.members,1);
  const gatheredCircle=await post('/v1/events/command',{action:'form_circle',id:createdEvent.id});
  assert.equal(gatheredCircle.communityId,eventCircle.communityId);assert.equal(gatheredCircle.members,0);
  assert.equal((await get('/v1/communities?id='+eventCircle.communityId,alice)).body.community.door,'invite');

  const createdCommunity = (await post('/v1/communities/command', { action:'create',name:'New Garden',domain:'garden.example',door:'invite' })).community;
  assert.equal(createdCommunity.bornOn, 'app.example.test');
  const attestation={action:'link',from:createdCommunity.id,rel:'recognises',to:'garden'};
  assert.equal((await post('/v1/links/command',attestation)).linked,true);
  assert.equal((await get('/v1/links?from='+createdCommunity.id+'&rel=recognises')).body.links[0].to,'garden');
  assert.equal((await post('/v1/links/command',{...attestation,action:'unlink'})).linked,false);
  const vision=(await post('/v1/visions/command',{action:'create',title:'Together',body:'A new garden',visibility:'private'})).vision;
  assert.equal(vision.authorId,'alice');assert.equal(vision.domain,'app.example.test');
  assert.equal((await get('/v1/visions?id='+vision.id)).status,404);
  const editedVision=(await post('/v1/visions/command',{action:'edit',id:vision.id,title:'Growing',body:'New words',visibility:'public'})).vision;
  assert.equal(editedVision.genesisHash,vision.genesisHash);assert.equal(editedVision.latestHash,vision.latestHash);
  assert.equal((await get('/v1/visions?id='+vision.id)).body.vision.title,'Growing');
  const picturedVision=(await post('/v1/visions/command',{action:'set_pictures',id:vision.id,paths:['users/alice/docker.png']})).vision;
  assert.equal(picturedVision.imageUrl,'/v1/media?path=users/alice/docker.png');
  assert.equal(picturedVision.latestHash,vision.latestHash);
  assert.equal((await get('/v1/visions?id='+vision.id)).body.vision.imageUrls.length,1);
  const disposableVision=(await post('/v1/visions/command',{action:'create',title:'Release test',body:'',visibility:'public'})).vision;
  await post('/v1/links/command',{action:'link',from:'alice',rel:'joined',to:disposableVision.id});
  assert.equal((await post('/v1/visions/command',{action:'release',id:disposableVision.id})).removedLinks,1);
  assert.equal((await get('/v1/visions?id='+disposableVision.id)).status,404);
  assert.deepEqual((await get('/v1/links?to='+disposableVision.id)).body.links,[]);
  const planted = (await post('/v1/trees/command', { action:'plant',name:'Willow',body:'Private birth',treeType:'LIFETREE',visibility:'private' })).tree;
  assert.equal((await get('/v1/beings?lid='+planted.lid)).status,404);
  assert.deepEqual((await get('/v1/beings?lid='+planted.lid,alice)).body,{being:{kind:'tree',id:planted.id,lid:planted.lid}});
  assert.equal(planted.anchorUid,'alice');
  assert.deepEqual((await get('/v1/visions?tree='+planted.id)).body.visions,[]);
  const rootVisions=(await get('/v1/visions?tree='+planted.id,alice)).body.visions;
  assert.equal(rootVisions.length,1);assert.equal(rootVisions[0].authorId,'alice');
  assert.equal((await get('/v1/visions?id='+rootVisions[0].id)).status,404);
  assert.equal((await get('/v1/trees?id=' + planted.id)).status,404);
  assert.equal((await get('/v1/trees?id=' + planted.id,alice)).body.access.editable,true);
  const picturedTree = (await post('/v1/trees/command', { action:'set_pictures',id:planted.id,paths:['users/alice/docker.png'] })).tree;
  assert.equal(picturedTree.imageUrl, '/v1/media?path=users/alice/docker.png');
  assert.equal(picturedTree.latestHash, planted.latestHash);
  const participation={action:'link',from:planted.id,rel:'participant',to:'docker-vision'};
  assert.equal((await post('/v1/links/command',participation)).linked,true);
  assert.deepEqual((await get('/v1/trees?participating=docker-vision')).body.trees,[]);
  assert.equal((await get('/v1/trees?participating=docker-vision',alice)).body.trees[0].id,planted.id);
  assert.equal((await post('/v1/links/command',{...participation,action:'unlink'})).linked,false);
  const treeRequest=await fetch(origin+'/v1/trees/command',{method:'POST',headers:{authorization:'Bearer '+fixture.token({sub:'issuer-bob'}),'content-type':'application/json'},
    body:JSON.stringify({action:'request_keeper',id:planted.id})});
  assert.equal(treeRequest.status,200);
  const treeOffer=await post('/v1/trees/command',{action:'answer_keeper_request',id:planted.id,member:'bob',role:'observer'});
  assert.equal(treeOffer.invite.status,'pending');
  assert.equal((await get('/v1/links?to='+planted.id+'&rel=keeper_request')).body.links.length,0);
  assert.equal((await get('/v1/links?to='+planted.id+'&rel=observer')).body.links.length,0);
  const gardenLink={action:'link',from:planted.id,rel:'grows_in',to:createdCommunity.id};
  assert.equal((await post('/v1/links/command',gardenLink)).linked,true);
  assert.equal((await get('/v1/links?from='+planted.id+'&rel=grows_in')).body.links[0].to,createdCommunity.id);
  assert.deepEqual((await get('/v1/trees?garden='+createdCommunity.id)).body.trees,[]);
  assert.equal((await get('/v1/trees?garden='+createdCommunity.id,alice)).body.trees[0].id,planted.id);
  assert.equal((await post('/v1/links/command',{...gardenLink,action:'unlink'})).linked,false);
  assert.equal((await post('/v1/links/command',{action:'link',from:'alice',rel:'joined',to:'docker-vision'})).linked,true);
  assert.equal((await post('/v1/links/command',{action:'unlink',from:'alice',rel:'joined',to:'docker-vision'})).linked,false);
  const privateFollow=await fetch(origin+'/v1/links/command',{method:'POST',headers:{authorization:'Bearer '+alice,'content-type':'application/json'},
    body:JSON.stringify({action:'link',from:'alice',rel:'guardian',to:planted.id})});
  assert.equal(privateFollow.status,403);


  assert.equal((await get('/v1/me/secret-links', alice)).body.links[0].from, 'alice');
  assert.deepEqual((await get('/v1/me/secret-links', fixture.token({ sub: 'issuer-bob' }))).body.links, []);
  assert.equal((await get('/v1/links?rel=joined')).body.links.length,2);
  assert.equal((await get('/v1/secret-circle-links?to=vision',alice)).status,403);
  assert.equal((await get('/v1/me/secret-links')).status, 401);
  assert.equal((await get('/v1/me', fixture.token({ exp: 1 }))).status, 401);
  const sameNamedSubject = await get('/v1/me', fixture.token({ sub: 'alice' }));
  assert.equal(sameNamedSubject.status, 200);
  assert.notEqual(sameNamedSubject.body.uid, 'alice');
  assert.equal((await get('/v1/me', authFixture().token())).status, 401);
  const first = await get('/v1/links?to=vision&limit=1');
  assert.equal(first.body.links[0].from, 'alice');
  const second = await get('/v1/links?to=vision&after=' + encodeURIComponent(first.body.next));
  assert.equal(second.body.links[0].from, 'bob');
  assert.equal(second.body.next, null);
  assert.equal((await get('/v1/secret-links?to=vision')).status, 404);
  assert.equal((await get('/v1/links?to=vision&uid=alice')).status, 400);
  assert.equal((await fetch(origin + '/v1/links?to=vision', { headers: { authorization: 'Bearer forged' } })).status, 401);
  assert.equal((await fetch(origin + '/v1/links', { method: 'POST' })).status, 405);
  assert.notEqual((await compose(['exec', '-T', 'api', 'id', '-u'])).trim(), '0');
  const immutable = await run('docker', ['compose', 'exec', '-T', 'api', 'touch', '/tmp/forbidden']);
  assert.notEqual(immutable.code, 0);
  const sharedRules = await compose(['exec', '-T', 'api', 'node', '--input-type=module', '-e',
    "import * as law from './generated/chain.mjs'; if(typeof law.touchMemoryOf!=='function' || typeof law.computeCanonicalHash!=='function' || typeof law.judgeBlockBirth!=='function')throw new Error('missing_shared_rules'); if(law.judgeBlockBirth({bearer:{exists:false}}).refusal!=='block_no_bearer')throw new Error('invalid_shared_rules'); try { await import('esbuild'); throw new Error('build_tool_in_runtime'); } catch(e) { if(e.code!=='ERR_MODULE_NOT_FOUND')throw e; }"]);
  assert.equal(sharedRules, '');
  const noFirebase = await compose(['exec', '-T', 'api', 'node', '--input-type=module', '-e',
    "try { await import('firebase'); process.exitCode=1; } catch (e) { if(e.code!=='ERR_MODULE_NOT_FOUND') throw e; }"]);
  assert.equal(noFirebase, '');
  const owner = await run('docker', ['compose', 'run', '--rm', '--no-deps', '-e', 'PGUSER=lightseed', '-e', 'PGPASSWORD', 'api'],
    undefined, { PGPASSWORD: env.SEED_DB_PASSWORD });
  assert.notEqual(owner.code, 0);
  assert.match(owner.stderr, /account is unsafe/);
  const invalidAuth = await run('docker', ['compose', 'run', '--rm', '--no-deps', '-e', 'SEED_AUTH_CONFIG=/missing-trust.json', 'api']);
  assert.notEqual(invalidAuth.code, 0);
  assert.match(invalidAuth.stderr, /Invalid authentication configuration/);
  console.log('Checking database outage responses, restart persistence and a database dump/restore.');
  await compose(['stop', 'db']);
  assert.equal((await get('/healthz')).status, 200);
  const unavailable = await get('/readyz');
  assert.equal(unavailable.status, 503);
  assert.deepEqual(unavailable.body, { error: 'database_unavailable' });
  await compose(['--profile', 'api', 'restart']);
  await compose(['--profile', 'api', 'up', '-d', '--wait']);
  // Docker may allocate a different host port when restarting an ephemeral binding.
  origin = 'http://' + (await compose(['port', 'api', '8081'])).trim();
  for (const [url, bytes] of mediaBeforeRestart) {
    const response = await fetch(origin + url); assert.equal(response.status, 200);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
  }
  assert.equal((await get('/v1/links?to=vision')).body.links.length, 2);
  assert.deepEqual((await get('/v1/me', alice)).body, { uid: 'alice' });
  assert.deepEqual((await get('/v1/me/profile', alice)).body.profile, savedProfile);
  assert.deepEqual((await get('/v1/signing-identity?id=alice')).body.identity,signingIdentity);
  assert.deepEqual((await get('/v1/communities?id=garden')).body, { community });
  assert.deepEqual((await get('/v1/me', enrolledToken)).body, enrolled.body);
  assert.deepEqual((await get('/v1/trees?id=' + planted.id,alice)).body.tree,picturedTree);
  const dump = await compose(['exec', '-T', 'db', 'pg_dump', '-U', 'lightseed', '--no-owner', '--no-acl', 'lightseed']);
  await sql('CREATE DATABASE restore_check;');
  await compose(['exec', '-T', 'db', 'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-U', 'lightseed', '-d', 'restore_check'], dump);
  const restored = await compose(['exec', '-T', 'db', 'psql', '-X', '-qAt', '-U', 'lightseed', '-d', 'restore_check', '-c',
    'SELECT (SELECT count(*) FROM links), (SELECT count(*) FROM secret_links), (SELECT count(*) FROM communities);']);
  assert.equal(restored.trim(), '6|1|3');
  const restoredProfile = await compose(['exec', '-T', 'db', 'psql', '-X', '-qAt', '-U', 'lightseed', '-d', 'restore_check', '-c',
    "SELECT doc->>'lid' FROM persons WHERE id='alice';"]);
  assert.equal(restoredProfile.trim(), savedProfile.lid);
  const restoredTree = await compose(['exec','-T','db','psql','-X','-qAt','-U','lightseed','-d','restore_check','-c',
    `SELECT count(*) FROM lifetrees WHERE id='${planted.id}' AND doc->>'name'='Willow';`]);
  assert.equal(restoredTree.trim(),'1');
  const restoredOfferingProof=await compose(['exec','-T','db','psql','-X','-qAt','-U','lightseed','-d','restore_check','-c',
    `SELECT hash=encode(digest(convert_to(preimage,'UTF8'),'sha256'),'hex') FROM seed.offering_birth_proofs WHERE offering_id='${createdOffering.id}';`]);
  assert.equal(restoredOfferingProof.trim(),'t');
  const restoredEventProof=await compose(['exec','-T','db','psql','-X','-qAt','-U','lightseed','-d','restore_check','-c',
    `SELECT hash=encode(digest(convert_to(preimage,'UTF8'),'sha256'),'hex') FROM seed.event_birth_proofs WHERE event_id='${copiedEvent.id}';`]);
  assert.equal(restoredEventProof.trim(),'t');
  const restoredBindings = await compose(['exec', '-T', 'db', 'psql', '-X', '-qAt', '-U', 'lightseed', '-d', 'restore_check', '-c',
    "SELECT count(*) FROM seed.identity_bindings WHERE subject='new-independent-person';"]);
  assert.equal(restoredBindings.trim(), '1');
  console.log('Docker proof passed: fresh install, migrations, provisioning, HTTP authentication/private-seat isolation, non-root/read-only runtime, owner refusal, outage recovery, restart persistence and data restore.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Docker proof failed.');
  process.exitCode = 1;
} finally {
  if (cleanup) {
    const result = await run('docker', ['compose', '--profile', 'api', 'down', '--volumes', '--remove-orphans', '--rmi', 'local']);
    if (result.code !== 0) {
      console.error(`Test cleanup failed. Inspect Docker project ${project}; private temporary files remain at ${directory}.`);
      process.exitCode = 1;
    } else await rm(directory, { recursive: true, force: true });
  } else await rm(directory, { recursive: true, force: true });
}
