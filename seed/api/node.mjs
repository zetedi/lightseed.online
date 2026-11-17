// THE NODE'S DOORS (ring 2026-11-03): the façade the HTTP edge (server.mjs) calls — every door of the
// independent node as a SERVICE in the API's layers: the command laws, the births and acceptances the
// shared law prepares between a repository's facts and its apply, the refusals by name — and not one
// statement. Those live in seed/api/db/* (the repositories: every SQL statement, the session and the
// transaction, PostgreSQL's own); the pure laws in seed/generated/chain.mjs and src/domain. The old name
// `createDatabase` is kept for main and the tests: database.mjs re-exports this.
// Server-only. Callers must supply a VERIFIED local identity; never pass request headers/claims straight
// here. HTTP identities come from the configured verifier.
import {seedBeingQuery,seedBeingResult} from '../../src/domain/seedBeing.mjs';
import {prepareEventDuplication,prepareEventBirth,prepareEventContent,prepareEventCircle} from './events.mjs';
import {seedEventCommand} from '../../src/domain/seedEvent.mjs';
import {seedAlignmentCommand} from '../../src/domain/seedAlignment.mjs';
import {seedOfferingCommand,seedOfferingCreation} from '../../src/domain/seedOffering.mjs';
import {prepareOfferingBirth,prepareOfferingAcceptance} from './offerings.mjs';
import {prepareAlignmentAcceptance} from './alignments.mjs';
import {prepareBlock} from './blocks.mjs';
import * as organs from './organs.mjs';
import * as pictures from './pictures.mjs';
import * as grounding from './grounding.mjs';
import * as repairs from './repairs.mjs';
import {seedBlockCommand} from '../../src/domain/seedBlock.mjs';
import {verifiesRotation,verifiesRecoveryCandidate,verifiesRecoveryWitness} from './signing.mjs';
import {SEED_INTERBEING_RELATIONS} from '../../src/domain/seedLink.mjs';
import {randomBytes} from 'node:crypto';
import {uuidv7} from '../../src/domain/uuidv7.mjs';
import {createSessions} from './db/session.mjs';
import {readiness} from './db/readiness.mjs';
import {identityRepository} from './db/identity.mjs';
import {beingsRepository} from './db/beings.mjs';
import {documentsRepository} from './db/documents.mjs';
import {communitiesRepository} from './db/communities.mjs';
import {treesRepository} from './db/trees.mjs';
import {mediaRepository} from './db/media.mjs';
import {chainsRepository} from './db/chains.mjs';
import {offeringsRepository} from './db/offerings.mjs';
import {eventsRepository} from './db/events.mjs';
import {alignmentsRepository} from './db/alignments.mjs';
import {signingRepository} from './db/signing.mjs';
import {mailRepository} from './db/mail.mjs';
import {picturesRepository} from './db/pictures.mjs';
import {groundingRepository} from './db/grounding.mjs';
import {repairsRepository} from './db/repairs.mjs';

const token=()=>randomBytes(24).toString('hex');
const docId=()=>randomBytes(20).toString('hex');
const lidAt=mintedAt=>uuidv7(mintedAt,randomBytes(10));
// One page of records from a `limit + 1` read: the records with their ids, and the bookmark for the next page.
const page=(result,limit,next=rows=>rows.at(-1).id)=>{
  const rows=result.slice(0,limit);
  return {rows:rows.map(row=>({...row.doc,id:row.id})),next:result.length>limit?next(rows):null};
};
const momentNext=rows=>{const last=rows.at(-1);return JSON.stringify([last.moment,last.id]);};

export function createNode(config) {
  const {withSession,close}=createSessions(config);
  const db={
    identity:identityRepository(withSession),beings:beingsRepository(withSession),documents:documentsRepository(withSession),
    communities:communitiesRepository(withSession),trees:treesRepository(withSession),media:mediaRepository(withSession),
    chains:chainsRepository(withSession),offerings:offeringsRepository(withSession),events:eventsRepository(withSession),
    alignments:alignmentsRepository(withSession),signing:signingRepository(withSession),mail:mailRepository(withSession),
    pictures:picturesRepository(withSession),repairs:repairsRepository(withSession),grounding:groundingRepository(withSession),
  };
  return {
    withSession,
    /** @param {{lid:string}} request @param {string|null} [uid] */
    async being(request,uid=null) {
      if(!seedBeingQuery(new URLSearchParams({lid:request.lid})))throw Object.assign(new Error('Invalid portable identity'),{code:'22023'});
      return seedBeingResult(await db.beings.lookup(uid,request.lid));
    },
    resolveIdentity:(issuer,subject,explicitUid,open)=>db.identity.resolve(null,issuer,subject,explicitUid,open,'oidc_'+uuidv7()),
    // THE BINDING CEREMONY (ring 2026-11-03): the reviewed bindings become durable rows at boot (seed.bind_explicit).
    bindExplicit:(issuer,bindings)=>db.identity.bindExplicit(null,issuer,bindings),
    ready:readiness(withSession),
    /** @param {*} request @param {string | null} [uid] @returns {Promise<*>} */
    async links(request,uid=null) {
      const privateSeats=request.kind==='secretLinks';
      if(privateSeats && !uid)throw new Error('authentication_required');
      return db.documents.session(uid,async s=>{
        if(!['from','to','rel'].includes(request.direction) || (privateSeats && request.direction==='rel'))throw new Error('invalid_direction');
        if(privateSeats && request.direction==='to' && !(await s.keepsSecretTree(request.id)))throw Object.assign(new Error('Forbidden'),{code:'42501'});
        const result=await s.linksPage(privateSeats,request.direction,request.id,request.rel,request.after,request.limit+1);
        const rows=result.slice(0,request.limit);
        return {links:rows.map(r=>({...r.doc,id:r.id,from:r.from_id,rel:r.rel,to:r.to_id,lid:r.lid,createdAt:r.created_at.toISOString()})),
          next:result.length>request.limit?rows.at(-1).id:null};
      });
    },
    // THE DOCUMENT DOOR (ring 2026-11-02): one document under the `get` law, or a page under the
    // row-level policies — the asking role's own sight, never widened by a filter.
    async docs(request,uid=null) {
      if(request.id!==null)return {doc:await db.documents.get(uid,request.collection,request.parent,request.id)};
      const result=await db.documents.list(uid,request.collection,request.parent,request.equals,request.contains,request.within,request.newest,request.after,request.limit);
      return {items:result.items,next:result.next};
    },
    // A write as a claim: the law (seed.doc_write) locks, patches, judges and stores; love is its own gesture.
    async docCommand(uid,command) {
      if(command.action==='love') {
        if(!uid)throw new Error('authentication_required');
        return db.documents.love(uid,command.kind,command.id);
      }
      return db.documents.write(uid,command,randomBytes(10).toString('hex'));
    },
    async linkCommand(uid,command) {
      if(command.rel==='participant')return db.documents.participation(uid,command,uuidv7());
      if(command.rel==='grows_in')return db.documents.garden(uid,command,uuidv7());
      if(SEED_INTERBEING_RELATIONS.includes(command.rel))return db.documents.attestation(uid,command,uuidv7());
      return db.documents.link(uid,command,uuidv7());
    },
    /** @param {*} request @param {string | null} [uid] @returns {Promise<*>} */
    invites:(request,uid=null)=>db.communities.invites(uid,request.id,request.community,request.after,request.limit),
    async inviteCommand(uid,command) {
      if(!uid)throw new Error('authentication_required');
      return db.communities.inviteCommand(uid,command,token(),[uuidv7(),uuidv7(),uuidv7()]);
    },
    mediaAllowed:(uid,path)=>db.media.writeAllowed(uid,path),
    mediaGet:path=>db.media.get(null,path),
    // THE RELEASE OF A PICTURE (ring 2026-11-03): the hashes are locked before the insert and the files
    // checked under the lock, so a sweep of the same bytes never crosses a publish (media_swept: encode again).
    /** @param {string} uid @param {string} path @param {*} manifest @param {((manifest: *) => Promise<boolean>) | null} [present] */
    mediaPublish:(uid,path,manifest,present=null)=>db.media.session(uid,async s=>{
      // Only well-formed hashes are locked here; a malformed manifest meets media_publish's own refusal.
      const hashes=['primary','small','large'].map(k=>manifest?.[k]?.hash).filter(h=>typeof h==='string' && /^[a-f0-9]{64}$/.test(h));
      await s.lock(hashes);
      if(present && !(await present(manifest)))throw Object.assign(new Error('media_swept'),{code:'MEDIA_SWEPT'});
      return s.publish(path,manifest);
    }),
    mediaRelease:(uid,url,media)=>pictures.releasePicture({repository:db.pictures,media,uid,url}),
    people:request=>db.beings.people(null,request.id,request.query,request.after,request.limit),
    treeInvites:(request,uid)=>db.trees.invites(uid,request.id,request.tree,request.mine,request.after,request.limit),
    async treeInviteCommand(uid,command) {
      if(!uid)throw new Error('authentication_required');
      return db.trees.inviteCommand(uid,command,token(),Array.from({length:5},()=>uuidv7()));
    },
    async treeCommand(uid,command,nodeDomain) {
      if(['request_keeper','cancel_keeper_request','decline_keeper_request','answer_keeper_request'].includes(command.action))
        return db.trees.keeperRequest(uid,command,uuidv7(),token(),Array.from({length:5},()=>uuidv7()));
      if(command.action==='set_pictures')return db.trees.pictures(uid,command);
      if(!uid)throw new Error('authentication_required');
      if(command.action==='resign_keeper')return db.trees.resign(uid,command);
      return db.trees.command(uid,command,[uuidv7(),uuidv7(),uuidv7()],nodeDomain);
    },
    async keeperInvites(request,uid) {
      if(!uid)throw new Error('authentication_required');
      const {rows,next}=page(await db.documents.keeperInvitesPage(uid,request.community,request.mine?uid:null,request.after,request.limit+1),request.limit);
      return {invites:rows,next};
    },
    async communityCommand(uid,command,nodeDomain) {
      if(!uid)throw new Error('authentication_required');
      if(command.action==='form_circle')return db.communities.formCircle(uid,command);
      if(['offer_keeper','accept_keeper_offer','decline_keeper_offer'].includes(command.action))return db.communities.keeperOffer(uid,command,[uuidv7(),uuidv7(),uuidv7(),uuidv7()]);
      if(['request_keeper','cancel_keeper_request','accept_keeper_request','decline_keeper_request'].includes(command.action))return db.communities.keeperRequest(uid,command,[uuidv7(),uuidv7()]);
      if(['grant_steward','revoke_steward','resign_keeper'].includes(command.action))return db.communities.role(uid,command,uuidv7());
      return db.communities.command(uid,command,uuidv7(),nodeDomain);
    },
    /** @param {*} request @param {string | null} [uid] @returns {Promise<*>} */
    async trees(request,uid=null) {
      if(request.id!==null) {
        const row=await db.trees.one(uid,request.id);
        return {tree:row?{...row.doc,id:row.id}:null,...(row && uid?{access:{editable:row.editable===true,keeper:row.keeper===true,
          inviteMode:row.keeper || row.staff?'all':row.steward && row.doc.treeType!=='SECRET'?'open':null}}:{})};
      }
      const {rows,next}=page(await db.trees.page(uid,{domain:request.domain,anchor:request.anchor,treeType:request.treeType,after:request.after,limit:request.limit+1,
        garden:request.garden??null,participating:request.participating??null,editable:request.editable===true}),request.limit);
      return {trees:rows,next};
    },
    async offeringLifecycle(uid,input) {
      const command=seedOfferingCommand(input);
      if(!command || !['edit','set_active','withdraw','decline'].includes(command.action))throw Object.assign(new Error('Invalid offering command'),{code:'22023'});
      return db.offerings.lifecycle(uid,command);
    },
    async createOffering(uid,input,nodeDomain) {
      const command=seedOfferingCreation(input);
      if(!command || typeof nodeDomain!=='string' || !nodeDomain)throw Object.assign(new Error('Invalid offering draft'),{code:'22023'});
      return db.offerings.session(uid,async s=>{
        const context=await s.birthContext(command);
        const mintedAt=Date.now();
        const born=await prepareOfferingBirth({uid,input:command,context,nodeDomain,mintedAt,id:docId(),lid:lidAt(mintedAt),noticeId:docId(),noticeLid:lidAt(mintedAt)});
        return s.applyBirth(command,born.record,born.birthProof,born.notice);
      });
    },
    /** @param {*} uid @param {*} input @param {string | null} [nodeDomain] */
    async eventCommand(uid,input,nodeDomain=null) {
      const command=seedEventCommand(input);if(!command)throw Object.assign(new Error('Invalid event command'),{code:'22023'});
      return db.events.session(uid,async s=>{
        if(command.action==='form_circle') {
          const context=await s.circleContext(command.id);
          const mintedAt=Date.now();
          const prepared=prepareEventCircle({uid,input:command,context,id:docId(),lid:lidAt(mintedAt),mintedAt});
          const edges=[...prepared.members.map(from=>({from,rel:'member'})),...prepared.trees.map(from=>({from,rel:'participant'}))]
            .map(edge=>({...edge,to:prepared.communityId,lid:lidAt(mintedAt)}));
          return s.applyCircle(command.id,prepared,edges);
        }
        if(command.action!=='duplicate') {
          const context=await s.draftContext(command);
          const mintedAt=Date.now();
          const born=command.action==='create'?await prepareEventBirth({uid,input:command,context,id:docId(),lid:lidAt(mintedAt),nodeDomain,mintedAt})
            :{record:prepareEventContent(command,context),birthProof:null};
          return s.applyWrite(command,born.record,born.birthProof,nodeDomain);
        }
        const context=await s.copyContext(command.id);
        const mintedAt=Date.now();
        const born=await prepareEventDuplication({uid,parentId:command.id,context,id:docId(),lid:lidAt(mintedAt),mintedAt});
        return s.applyCopy(command.id,born.record,born.birthProof,lidAt(mintedAt));
      });
    },
    async alignmentCommand(uid,input,nodeDomain) {
      const command=seedAlignmentCommand(input);if(!command)throw Object.assign(new Error('Invalid alignment'),{code:'22023'});
      if(command.action==='accept')return this.acceptAlignment(uid,command.id,nodeDomain);
      return db.alignments.command(uid,command,docId(),lidAt(Date.now()));
    },
    /** @param {*} request @param {string | null} [uid] @returns {Promise<*>} */
    async alignments(request,uid=null) {
      if(request.id!==null) {
        const row=await db.alignments.one(uid,request.id);
        return {alignment:row?{...row.doc,id:row.id}:null};
      }
      const {rows,next}=page(await db.alignments.page(uid,{tree:request.tree,participant:request.participant,target:request.target,status:request.status,
        afterMoment:request.after?.moment??null,afterId:request.after?.id??null,limit:request.limit+1}),request.limit,momentNext);
      return {alignments:rows,next};
    },
    async acceptAlignment(uid,id,nodeDomain) {
      if(typeof id!=='string'||!id||id.length>512||typeof nodeDomain!=='string'||!nodeDomain)throw Object.assign(new Error('Invalid alignment'),{code:'22023'});
      return db.alignments.session(uid,async s=>{
        const context=await s.context(id);
        const mintedAt=Date.now();
        const born=await prepareAlignmentAcceptance({uid,id,context,nodeDomain,mintedAt,sourceId:docId(),sourceLid:lidAt(mintedAt),targetId:docId(),targetLid:lidAt(mintedAt)});
        return s.applyAcceptance(id,born.fromRecord,born.toRecord,born.fromHeight,born.toHeight);
      });
    },
    async acceptOffering(uid,id) {
      return db.offerings.session(uid,async s=>{
        const context=await s.context(id);
        const mintedAt=Date.now();
        const born=await prepareOfferingAcceptance({uid,context,mintedAt,fromId:docId(),fromLid:lidAt(mintedAt),toId:docId(),toLid:lidAt(mintedAt)});
        return s.applyAcceptance(id,born.fromRecord,born.toRecord,born.fromHeight,born.toHeight);
      });
    },
    async blockCommand(uid,input,nodeDomain) {
      const command=seedBlockCommand(input);if(!command)throw Object.assign(new Error('Invalid block'),{code:'22023'});
      // THE UNMINT (ring 2026-11-02): the head taken back under domain/unmint, its touch lifted.
      if(command.action==='unmint')return organs.unmint(withSession,uid,command.pulseId);
      return db.chains.session(uid,async s=>{
        const context=await s.blockContext(command.on,command.id,command.block.care==='watering');
        const mintedAt=Date.now(),id=docId(),lid=lidAt(mintedAt);
        const born=await prepareBlock({uid,command,context,id,lid,nodeDomain,mintedAt});
        await s.applyBlock(command.on,command.id,born.record,born.patch,born.blockHeight);
        return born.result;
      });
    },
    signingIdentity:id=>db.signing.identity(null,id),
    signingHistory:request=>db.signing.history(null,request.id,request.collection,request.after,request.limit),
    recoveryWitnesses:(uid,request)=>db.signing.recoveryWitnesses(uid,request.id,request.event,request.after,request.limit),
    recoveryContext:async uid=>({context:await db.signing.recoveryContext(uid)}),
    recoveryProposal:(uid,id,event)=>db.signing.recoveryProposal(uid,id,event),
    async signingCommand(uid,command) {
      if(command.action==='activate_recovery')return db.signing.session(uid,async s=>{
        const prepared=await s.prepareActivation(command.eventId);
        const proposal=prepared.proposal;
        if(!verifiesRecoveryCandidate(prepared.context,{action:'begin_recovery',eventId:command.eventId,toPubkey:proposal.toPubkey,toFingerprint:proposal.toFingerprint,newSig:proposal.newSig}))
          throw Object.assign(new Error('Invalid candidate proof'),{code:'42501'});
        const accepted=new Map();
        for(const witness of prepared.witnesses) {
          if(verifiesRecoveryWitness(witness.witnessUid,proposal,{action:'witness_recovery',targetUid:uid,eventId:command.eventId,
            sig:witness.sig,pubkey:witness.pubkey,keyFingerprint:witness.keyFingerprint,epochId:witness.epochId}))accepted.set(witness.witnessUid,witness.id);
          if(accepted.size===3)break;
        }
        if(accepted.size<3)throw Object.assign(new Error('Recovery quorum required'),{code:'LS030'});
        return s.applyActivation(command.eventId,[...accepted.values()]);
      });
      if(command.action==='witness_recovery')return db.signing.session(uid,async s=>{
        const proposal=await s.prepareWitness(command);
        if(!verifiesRecoveryWitness(uid,proposal,command))throw Object.assign(new Error('Invalid witness proof'),{code:'42501'});
        return s.applyWitness(command);
      });
      if(command.action==='begin_recovery')return db.signing.session(uid,async s=>{
        const context=await s.recoveryContext();
        if(!verifiesRecoveryCandidate(context,command))throw Object.assign(new Error('Invalid candidate proof'),{code:'42501'});
        return s.applyProposal(command);
      });
      if(command.action==='rotate') {
        if(!verifiesRotation(uid,command))throw Object.assign(new Error('Invalid rotation proof'),{code:'42501'});
        return db.signing.applyRotation(uid,command);
      }
      if(command.action==='freeze')return db.signing.freeze(uid,command);
      return db.signing.anchor(uid,command);
    },
    async visionCommand(uid,command,nodeDomain) {
      if(command.action==='release')return db.chains.visionRelease(uid,command);
      if(command.action==='set_pictures')return db.chains.visionPictures(uid,command);
      return db.chains.visionCommand(uid,command,uuidv7(),nodeDomain);
    },
    /** @param {*} request @param {string | null} [uid] @returns {Promise<*>} */
    async pulses(request,uid=null) {
      if(request.id!==null) {
        const row=await db.chains.pulse(uid,request.id);
        return {pulse:row?{...row.doc,id:row.id}:null};
      }
      const {rows,next}=page(await db.chains.pulsesPage(uid,{tree:request.tree,vision:request.vision,community:request.community,author:request.author,recipient:request.recipient,
        participant:request.participant,type:request.type,domain:request.domain,afterMoment:request.after?.moment??null,afterId:request.after?.id??null,limit:request.limit+1}),request.limit,momentNext);
      return {pulses:rows,next};
    },
    /** @param {*} request @param {string | null} [uid] @returns {Promise<*>} */
    async visions(request,uid=null) {
      if(request.id!==null) {
        const row=await db.chains.vision(uid,request.id);
        return {vision:row?{...row.doc,id:row.id}:null};
      }
      const {rows,next}=page(await db.chains.visionsPage(uid,{domain:request.domain,author:request.author,tree:request.tree,joined:request.joined,
        afterMoment:request.after?.moment??null,afterId:request.after?.id??null,limit:request.limit+1}),request.limit,momentNext);
      return {visions:rows,next};
    },
    /** @param {*} request @param {string | null} [uid] @returns {Promise<*>} */
    async communities(request,uid=null) {
      if(request.id!==null)return db.communities.session(uid,async s=>{
        const row=await s.one(request.id);
        if(!row)return {community:null};
        const access=uid?await s.access(uid,row.doc.anchorUid??'',row.id,row.doc):null;
        return {community:{...row.doc,id:row.id},...(access?{access}:{})};
      });
      const {rows,next}=page(await db.communities.page(uid,request.after,request.limit+1),request.limit);
      return {communities:rows,next};
    },
    /** @param {string} uid @param {{displayName: string} | {action: string, slot: string, path: string | null} | null} [input] */
    async profile(uid,input=null) {
      if(input?.action==='set_picture')return {profile:await db.trees.profilePicture(uid,input)};
      if(!uid)throw new Error('authentication_required');
      const row=input?await db.trees.saveProfile(uid,input.displayName,uuidv7()):await db.trees.myProfile(uid);
      return {profile:row.profile,email:row.email??null};
    },
    // THE MAIL ORGAN (ring 2026-11-03): the organ is the installation's (seed/api/mail.mjs, configured in main); without one, every letter refuses by name.
    async mailCommand(uid,command,organ) {
      if(!organ && command.action!=='status')organs.refuse('mail_unavailable',503);
      if(!organ)organs.refuse('mail_missing',404);
      return organ.mailCommand(withSession,uid,command);
    },
    // THE AI ORGAN (ring 2026-11-03): a model asked on the hand's behalf, a provider key kept — refused by name when the installation grew no organ.
    async aiCommand(uid,command,organ) {
      if(!organ)organs.refuse('ai_unavailable',503);
      return organ.aiCommand(withSession,uid,command);
    },
    requestInvite:input=>db.mail.requestInvite(null,input.email,input.reason,uuidv7()),
    unsubscribe:(token,ownDomains)=>db.mail.unsubscribe(null,token,ownDomains),
    // The address a verified login carries, remembered on the account (never matched as identity).
    recordEmail:(uid,email)=>db.identity.recordEmail(null,uid,email),
    // THE ORGANS (ring 2026-11-02): light, staff, the account's departure, the domain proofs and doors.
    lightCommand:(uid,command)=>organs.lightCommand(withSession,uid,command),
    staffCommand:(uid,command)=>organs.staffCommand(withSession,uid,command),
    repairCommand:(uid,command)=>repairs.repairCommand({repository:db.repairs,uid,command}),
    // THE GROUND (ring 2026-11-17): the origin's askGround / acceptGround / releaseGround, and the knock let go.
    groundCommand:(uid,command,nodeDomain)=>grounding.groundCommand({repository:db.grounding,uid,command,nodeDomain}),
    accountCommand:(uid,command)=>organs.accountCommand(withSession,uid,command),
    domainCommand:(uid,command,context)=>organs.domainCommand(withSession,uid,command,context),
    close,
  };
}
