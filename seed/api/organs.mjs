// THE ORGANS (ring 2026-11-02): the server hands the origin node keeps in functions/src — the light
// mint, appreciation and the spend, the unmint, the staff roster, the account's departure, the
// anchor's DNS proof and the doors — grown on the independent node. Each follows the one pattern
// of seed/schema/044: the API reads FACTS under locks (seed.<x>_context), asks the PURE LAW from the
// shared domain bundle (the same source the browser and the functions mirror), and stores what the
// law allowed (seed.apply_<x>). Nothing here trusts a claim: identity is the session's, standing is
// read, amounts are the law's, moments are the server's. DNS is observed OUTSIDE every transaction.
import {createHash,createPublicKey,verify,randomBytes} from 'node:crypto';
import {uuidv7} from '../../src/domain/uuidv7.mjs';
import {judgeWitness,kindleDayKeyFromMs,judgeAppreciation,judgeSpend,unmintRefusal,STAFF_OVERRIDABLE_REFUSALS,touchRestoreOf,
  decisionIdentity,decisionSignaturePayload,decisionEpochSignaturePayload,DECISION_DOMAIN,DECISION_EPOCH_DOMAIN,
  keyStandingAt,keyStandingCounts,signingPreimage,normalizeDoor,isDoorName,doorClaimRefusal,
  challengeRecordName,challengeRecordValue,txtProvesChallenge,challengeIsLive,DOMAIN_CHALLENGE_TTL_MS} from '../generated/chain.mjs';

// A refusal the law spoke, carried to the HTTP edge by name (server.mjs answers {error: refusal}).
export const refuse=(refusal,status)=>{throw Object.assign(new Error('Organ refused'),{code:'ORGAN_REFUSED',refusal,status});};
// The light law's refusals, by the weight functions/lightCalls gives each (mirror of REFUSAL_CODE).
const LIGHT_STATUS={gift_nothing:400,gift_whole_units:400,gift_needs_both:400,spend_nothing:400,
  gift_own_offering:409,gift_resting:409,gift_hold_less:409,appreciate_coin_refused:409,appreciate_already:409,
  spend_not_purchase:409,spend_not_passed:409,spend_listening:409,spend_unsigned:409,spend_already:409,spend_coin_refused:409,spend_glow_short:409,
  appreciate_offering_gone:404,spend_no_decision:404,spend_no_offering:404,
  appreciate_not_received:403,spend_no_standing:403};
const lid=()=>uuidv7(Date.now(),randomBytes(10));
const msOf=value=>{
  if(typeof value==='number')return Number.isFinite(value)?value:null;
  if(typeof value!=='string')return null;
  const ms=Date.parse(value);return Number.isFinite(ms)?ms:null;
};
const text=value=>typeof value==='string'?value:'';
const run=(c,sql,params)=>c.query(sql,params).then(r=>r.rows[0].result);

// ── LIGHT ────────────────────────────────────────────────────────────────────────────────────
// The circle witnesses a watering: the facts are the node's (standing, day, rays), the judgment the
// domain's (judgeWitness), the kindle one transaction — confirmation and rays together or not at all.
export function prepareWitness({uid,context,pulseId}) {
  const pulse=context.pulse??{},tree=context.tree??null;
  const carerUid=text(pulse.authorId),treeId=text(context.treeId);
  const judgment=judgeWitness({witnessUid:uid,
    pulse:{exists:!!context.exists,care:pulse.care,wateringConfirmedBy:pulse.wateringConfirmedBy,carerUid,treeId,createdAtMs:msOf(context.createdAt)},
    witnessSinceMs:msOf(context.witnessSince),
    tree:{exists:tree!==null,treeType:tree?.treeType,diedAtMs:tree?msOf(tree.diedAt):null},
    carerRayExists:!!context.carerRayExists,witnessRayExists:!!context.witnessRayExists});
  if(judgment.outcome==='reject')refuse(judgment.code==='not-found'?'watering_missing':judgment.code==='permission-denied'?'forbidden':'witness_refused',
    judgment.code==='not-found'?404:judgment.code==='permission-denied'?403:409);
  if(judgment.outcome==='already')return {already:true,result:{kindled:false,witnessUnits:0,already:true}};
  const place=typeof context.communityId==='string' && context.communityId?{communityId:context.communityId}:{};
  const rays=[judgment.carerRay,judgment.witnessRay].filter(Boolean).map(ray=>({id:`${treeId}__${judgment.dayKey}__${ray.role}`,lid:lid(),
    holderUid:ray.holderUid,role:ray.role,sourceUid:carerUid,treeId,dayKey:judgment.dayKey,...place,units:ray.units,pulseId}));
  return {already:false,rays,result:{kindled:judgment.carerRay!==null,witnessUnits:judgment.witnessRay?judgment.witnessRay.units:0,...(tree?.treeType==='SECRET'?{secret:true}:{})}};
}

// A receiver's light moves to the offering it received (judgeAppreciation): oldest rays first, the
// place's glow share, the rest suspended at the offering.
export function prepareAppreciation({uid,context,offeringId,units}) {
  const o=context.offering??{};
  const rays=(Array.isArray(context.rays)?context.rays:[]).map(r=>({id:text(r.id),units:typeof r.units==='number'?r.units:0,place:typeof r.place==='string' && r.place?r.place:null,dayKey:text(r.dayKey)}));
  const judgment=judgeAppreciation({giverUid:uid,units,
    offering:{exists:!!context.exists,type:o.type,status:o.offeringStatus,active:o.offeringActive,authorId:text(o.authorId),answeredBy:o.offeringAnsweredBy,
      place:typeof context.place==='string' && context.place?context.place:null,acceptsPlaces:Array.isArray(context.acceptsPlaces)?context.acceptsPlaces.filter(p=>typeof p==='string'):[]},
    rays,alreadyGiven:!!context.alreadyGiven});
  if(judgment.outcome==='reject')refuse(judgment.refusal,LIGHT_STATUS[judgment.refusal]??409);
  const glowHome=judgment.glowHome??'NODE';
  const gift={lid:lid(),offeringId,giverUid:uid,units,glow:judgment.glow,suspended:judgment.suspended,glowHome,...(context.place?{communityId:context.place}:{})};
  return {gift,takes:judgment.take,result:{units,glow:judgment.glow,suspended:judgment.suspended}};
}

// ── THE SEAL, RE-VERIFIED ON SERVER GROUND (mirror of functions/src/decisionSeal.ts) ─────────
const canonicalBase64=value=>{try{return Buffer.from(value,'base64').toString('base64')===value;}catch{return false;}};
const verifiesEd25519=(pubkey,signature,preimage)=>{
  try {
    if(!canonicalBase64(pubkey) || !canonicalBase64(signature))return false;
    const key=createPublicKey({key:Buffer.from(pubkey,'base64'),format:'der',type:'spki'});
    return key.asymmetricKeyType==='ed25519' && verify(null,Buffer.from(preimage,'utf8'),key,Buffer.from(signature,'base64'));
  }catch{return false;}
};
const fingerprintOf=pubkey=>createHash('sha256').update(pubkey,'utf8').digest('hex');
// Everything the node read about one signer (persons, lineage, key events, standing), as the law's facts.
const signerFacts=raw=>{
  const personLid=text(raw.lid);
  const events=(Array.isArray(raw.events)?raw.events:[]).flatMap(e=>{
    const recordedAtMs=msOf(e.recordedAt);
    if(!['anchor','rotate','freeze','recover'].includes(String(e.type)) || e.lid!==personLid || typeof e.epochId!=='string' || typeof e.keyFingerprint!=='string' || !recordedAtMs)return [];
    const suspected=msOf(e.suspectedSince);
    return [{eventId:text(e.eventId),type:e.type,epochId:e.epochId,keyFingerprint:e.keyFingerprint,recordedAtMs,
      ...(typeof e.previousFingerprint==='string'?{previousFingerprint:e.previousFingerprint}:{}),...(suspected?{suspectedSinceMs:suspected}:{})}];
  });
  const epochs=events.filter(e=>e.type!=='freeze').map(e=>({epochId:e.epochId,fingerprint:e.keyFingerprint,anchoredAtMs:e.recordedAtMs}));
  const lineage=new Map(Object.entries(raw.keys && typeof raw.keys==='object'?raw.keys:{}).filter(([,pubkey])=>typeof pubkey==='string'));
  return {publicKeyPem:text(raw.publicKeyPem),currentFingerprint:text(raw.currentFingerprint),lineage,epochs,events,member:!!raw.member};
};
const bindsToSigner=(s,facts)=>{
  const inLineage=facts.lineage.get(fingerprintOf(s.pubkey))===s.pubkey;
  if(s.version===3) {
    if(!inLineage || typeof s.keyFingerprint!=='string' || typeof s.epochId!=='string' || s.recordedAtMs===null)return false;
    if(fingerprintOf(s.pubkey)!==s.keyFingerprint)return false;
    return keyStandingCounts(keyStandingAt({epochId:s.epochId,keyFingerprint:s.keyFingerprint,recordedAtMs:s.recordedAtMs},facts.epochs,facts.events,facts.currentFingerprint));
  }
  return (!!facts.publicKeyPem && s.pubkey===facts.publicKeyPem) || inLineage;
};
// The set of VERIFIED signer uids: one per hand, uniting only in consensus, a key the being itself
// published (current, or in its lineage at the receipt time), the payload bound to the slot's own uid.
export function verifiedDecisionSignerCount(identity,mode,signatures,signers) {
  const counted=new Set();
  for(const raw of signatures) {
    const s={uid:text(raw.uid),sig:raw.sig,pubkey:raw.pubkey,position:raw.position,version:raw.version,keyFingerprint:raw.keyFingerprint,epochId:raw.epochId,recordedAtMs:msOf(raw.recordedAt)};
    if(!s.uid || counted.has(s.uid))continue;
    if(mode==='consensus' && s.position!=='unite')continue;
    const facts=signers[s.uid]?signerFacts(signers[s.uid]):null;
    if(!facts || !facts.member)continue;
    if(typeof s.sig!=='string' || typeof s.pubkey!=='string' || !s.sig || !s.pubkey)continue;
    if(!bindsToSigner(s,facts))continue;
    const epochBound=s.version===3 && typeof s.keyFingerprint==='string' && typeof s.epochId==='string';
    const payload=epochBound?decisionEpochSignaturePayload(identity,s.uid,s.keyFingerprint,s.epochId):decisionSignaturePayload(identity,s.uid);
    if(verifiesEd25519(s.pubkey,s.sig,signingPreimage(epochBound?DECISION_EPOCH_DOMAIN:DECISION_DOMAIN,payload)))counted.add(s.uid);
  }
  return counted.size;
}

// The commons moves by a signed purchase decision (judgeSpend), the seal counted here first.
export function prepareSpend({uid,context,decisionId}) {
  const d=context.decision??{},o=context.offering??{};
  const communityId=text(context.communityId);
  let verifiedSigners=0;
  if(context.exists && communityId && typeof d.lid==='string') {
    const identity=decisionIdentity({lid:d.lid,communityId,nature:d.nature,title:text(d.title),body:text(d.body),votesRequired:Number(d.votesRequired)||0});
    verifiedSigners=verifiedDecisionSignerCount(identity,d.mode==='consensus'?'consensus':'threshold',Array.isArray(context.signatures)?context.signatures:[],context.signers??{});
  }
  const judgment=judgeSpend({callerUid:uid,callerStands:!!context.callerStands,
    decision:{exists:!!context.exists,type:d.type,nature:d.nature,status:d.status,listening:d.listening,communityId,votesRequired:Number(d.votesRequired)||0,verifiedSigners,spend:d.spend,alreadySpent:!!context.alreadySpent},
    offering:{exists:!!context.offering,type:o.type,active:o.offeringActive,place:typeof context.place==='string' && context.place?context.place:null,
      acceptsPlaces:Array.isArray(context.acceptsPlaces)?context.acceptsPlaces.filter(p=>typeof p==='string'):[]},
    glowUnits:Number(context.glowUnits)||0});
  if(judgment.outcome==='reject')refuse(judgment.refusal,LIGHT_STATUS[judgment.refusal]??409);
  const spend={lid:lid(),decisionId,communityId,offeringId:text(context.offeringId),units:judgment.units,glow:judgment.glow,suspended:judgment.suspended,
    glowHome:judgment.glowHome??'NODE',verifiedSigners,spentBy:uid};
  return {spend,result:{units:judgment.units,glow:judgment.glow,suspended:judgment.suspended,verifiedSigners}};
}

export function lightCommand(withSession,uid,command) {
  if(command.action==='witness')return withSession(uid,async c=>{
    const context=(await c.query('SELECT seed.witness_context($1) AS context',[command.pulseId])).rows[0].context;
    const prepared=prepareWitness({uid,context,pulseId:command.pulseId});
    if(!prepared.already)await c.query('SELECT seed.apply_witness($1,$2::jsonb)',[command.pulseId,JSON.stringify(prepared.rays)]);
    return prepared.result;
  });
  if(command.action==='appreciate')return withSession(uid,async c=>{
    const context=(await c.query('SELECT seed.appreciation_context($1) AS context',[command.offeringId])).rows[0].context;
    const prepared=prepareAppreciation({uid,context,offeringId:command.offeringId,units:command.units});
    await c.query('SELECT seed.apply_appreciation($1,$2::jsonb,$3::jsonb)',[command.offeringId,JSON.stringify(prepared.gift),JSON.stringify(prepared.takes)]);
    return prepared.result;
  });
  if(command.action==='spend')return withSession(uid,async c=>{
    const context=(await c.query('SELECT seed.spend_context($1) AS context',[command.decisionId])).rows[0].context;
    const prepared=prepareSpend({uid,context,decisionId:command.decisionId});
    await c.query('SELECT seed.apply_spend($1,$2::jsonb)',[command.decisionId,JSON.stringify(prepared.spend)]);
    return prepared.result;
  });
  return withSession(uid,c=>run(c,'SELECT seed.reset_light() AS result'));
}

// ── THE UNMINT: the head taken back, its touch lifted (domain/unmint) ───────────────────────
export function prepareUnmint({uid,context}) {
  if(!context.exists)refuse('unmint_not_mint',404);
  const pulse=context.pulse??{},tree=context.tree??null;
  const refusal=unmintRefusal(pulse,{latestHash:tree?.latestHash},uid);
  if(refusal && !(context.isStaff && STAFF_OVERRIDABLE_REFUSALS.has(refusal)))refuse(refusal,refusal==='unmint_not_author'?403:409);
  if(!tree)refuse('unmint_not_mint',404);
  if(tree.latestHash!==pulse.hash)refuse('unmint_not_last',409);
  const watering=tree.watering && typeof tree.watering==='object'?tree.watering:{};
  const restore=touchRestoreOf({memory:pulse.bearerBefore && typeof pulse.bearerBefore==='object'?pulse.bearerBefore:null,
    block:{mintedAtMs:typeof pulse.mintedAt==='number'?pulse.mintedAt:null,createdAtMs:msOf(pulse.createdAt),imageUrl:typeof pulse.imageUrl==='string'?pulse.imageUrl:null},
    tree:{latestGrowthUrl:typeof tree.latestGrowthUrl==='string'?tree.latestGrowthUrl:null,lastCaredAtMs:msOf(tree.lastCaredAt),lastWateredAtMs:msOf(watering.lastWateredAt)}});
  return {lifted:restore.set,cleared:restore.clear,names:[...Object.keys(restore.set),...restore.clear]};
}
export function unmint(withSession,uid,pulseId) {
  return withSession(uid,async c=>{
    const context=(await c.query('SELECT seed.unmint_context($1) AS context',[pulseId])).rows[0].context;
    const prepared=prepareUnmint({uid,context});
    const head=await run(c,'SELECT seed.apply_unmint($1,$2::jsonb,$3::text[]) AS result',[pulseId,JSON.stringify(prepared.lifted),prepared.cleared]);
    return {...head,lifted:prepared.names};
  });
}

// ── STAFF and the ACCOUNT'S DEPARTURE: the law stands in SQL alone ───────────────────────────
export const staffCommand=(withSession,uid,command)=>withSession(uid,c=>run(c,'SELECT seed.staff_command($1::jsonb) AS result',[JSON.stringify(command)]));
export const accountCommand=(withSession,uid,command)=>withSession(uid,c=>run(c,'SELECT seed.delete_account($1,$2) AS result',
  [command.action==='delete_mine'?uid:command.uid,command.action==='delete_mine'?(command.heirUid??null):null]));

// ── DOMAIN PROOFS AND DOORS ─────────────────────────────────────────────────────────────────
// The node's own hostname is a node door; the faces the installation names (SEED_FACE_DOORS) are
// face doors granted by the steward; every other hostname is a custom door proven by DNS.
export const doorKindOf=(door,{nodeDomain,faceDoors})=>door===nodeDomain?'node':(faceDoors??[]).includes(door)?'face':'custom';
const token=()=>randomBytes(16).toString('hex'); // 128 bits, opaque, single-use
const challengeRecord=(name,challenge)=>({recordName:challengeRecordName(name),recordValue:challengeRecordValue(challenge.token)});
const liveness=(challenge,nowMs)=>{
  if(!challenge)refuse('no_challenge',409);
  if(challenge.usedAt)refuse('challenge_used',409);
  if(!challengeIsLive({usedAtMs:null,createdAtMs:msOf(challenge.createdAt)??0},nowMs))refuse('challenge_expired',409);
};
// The TXT observation, outside every transaction: a resolver failure is "not found", a wrong value "mismatch".
async function observe(resolveTxt,name,challengeToken) {
  let records;
  try {records=await resolveTxt(name);}catch{refuse('txt_not_found',409);}
  if(!Array.isArray(records) || !txtProvesChallenge(records,challengeToken))refuse('txt_mismatch',409);
}
export async function domainCommand(withSession,uid,command,{nodeDomain,faceDoors,resolveTxt}) {
  const ttl=DOMAIN_CHALLENGE_TTL_MS,cid=command.communityId;
  if(command.action==='start_verification') {
    const {challenge,domain}=await withSession(uid,c=>run(c,'SELECT seed.domain_challenge($1,$2,$3) AS result',[cid,token(),ttl]));
    return {domain,...challengeRecord(domain,challenge)};
  }
  if(command.action==='check_verification') {
    const {challenge,domain}=await withSession(uid,c=>run(c,'SELECT seed.domain_challenge($1,NULL,$2) AS result',[cid,ttl]));
    liveness(challenge,Date.now());
    if(challenge.domain!==domain)refuse('domain_changed',409);
    await observe(resolveTxt,challengeRecordName(challenge.domain),challenge.token);
    return withSession(uid,c=>run(c,'SELECT seed.domain_verified($1,$2,$3) AS result',[cid,challenge.token,ttl]));
  }
  if(command.action==='list_doors') {
    const claims=await withSession(uid,c=>run(c,'SELECT seed.door_claims($1) AS result',[cid]));
    if(claims===null)refuse('forbidden',403);
    return {claims:claims.map(x=>({door:x.door,kind:x.kind,...(x.token?challengeRecord(x.door,x):{})}))};
  }
  const door=normalizeDoor(text(command.door));
  if(!isDoorName(door))refuse('door_not_hostname',400);
  const kind=doorKindOf(door,{nodeDomain,faceDoors});
  if(command.action==='start_door') {
    const read=await withSession(uid,c=>run(c,'SELECT seed.door_claim($1,$2,NULL,NULL,$3) AS result',[cid,door,ttl]));
    const refusal=doorClaimRefusal({door,kind,community:{id:cid,domain:read.community?.domain,domainAliases:read.community?.domainAliases},claimedBy:read.claimant?{id:read.claimant}:null});
    if(refusal)refuse(refusal,409);
    const {challenge}=await withSession(uid,c=>run(c,'SELECT seed.door_claim($1,$2,$3,$4,$5) AS result',[cid,door,kind,kind==='custom'?token():null,ttl]));
    return {door,kind,...(kind==='custom'?challengeRecord(door,challenge):{})};
  }
  if(command.action==='check_door') {
    const {challenge}=await withSession(uid,c=>run(c,'SELECT seed.door_claim($1,$2,NULL,NULL,$3) AS result',[cid,door,ttl]));
    if(!challenge || !challenge.token)refuse('no_challenge',409);
    liveness(challenge,Date.now());
    await observe(resolveTxt,challengeRecordName(door),challenge.token);
    return withSession(uid,c=>run(c,'SELECT seed.door_open($1,$2,false,$3,$4) AS result',[cid,door,challenge.token,ttl]));
  }
  if(command.action==='grant_door') {
    if(kind!=='face')refuse('door_not_face',409);
    return withSession(uid,c=>run(c,'SELECT seed.door_open($1,$2,true,NULL,$3) AS result',[cid,door,ttl]));
  }
  return withSession(uid,c=>run(c,'SELECT seed.door_withdraw($1,$2) AS result',[cid,door]));
}
