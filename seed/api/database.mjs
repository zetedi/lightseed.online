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
import {picturesRepository} from './db/pictures.mjs';
import * as repairs from './repairs.mjs';
import {repairsRepository} from './db/repairs.mjs';
import {seedBlockCommand} from '../../src/domain/seedBlock.mjs';
import {verifiesRotation,verifiesRecoveryCandidate,verifiesRecoveryWitness} from './signing.mjs';
import { seedTransactionRetry } from '../../src/domain/seedTransaction.mjs';
import {SEED_INTERBEING_RELATIONS} from '../../src/domain/seedLink.mjs';
import { randomBytes } from 'node:crypto';
import { uuidv7 } from '../../src/domain/uuidv7.mjs';
import pg from 'pg';

// Server-only. Callers must supply a VERIFIED local identity; never pass request
// headers/claims straight here. HTTP identities come from the configured verifier.
export function createDatabase(config) {
  const pool = new pg.Pool({ max: 10, connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000, ...config });
  pool.on('error', () => {}); // idle connection failures must not crash the HTTP process
  const abortedTransactions=new WeakSet();
  // Work callbacks contain database operations only: no external effects may be replayed.
  async function withSession(uid,work) {
    for(let attempt=0;;attempt++) {
      try {return await withSessionOnce(uid,work);}
      catch(error) {if(!seedTransactionRetry({code:error?.code,attempt,aborted:abortedTransactions.has(error)}))throw error;}
    }
  }
  async function withSessionOnce(uid, work) {
    if (uid !== null && (typeof uid !== 'string' || !uid.length || uid.length > 128 || /[\u0000-\u001f\u007f]/.test(uid))) {
      throw new Error('invalid_session');
    }
    const client = await pool.connect();
    let failed = true, started=false, committed=false;
    try {
      // Refuse dirty connections rather than trust session-wide state from an earlier
      // callback. DISCARD also removes temporary objects and prepared statements.
      await client.query('DISCARD ALL');
      const guard = await client.query(`SELECT
        r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls
        OR EXISTS (SELECT 1 FROM pg_auth_members WHERE member = r.oid)
        OR EXISTS (SELECT 1 FROM pg_database WHERE datname = current_database() AND datdba = r.oid)
        OR has_schema_privilege(current_user, 'public', 'CREATE')
        OR has_schema_privilege(current_user, 'seed', 'CREATE')
        OR EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname IN ('public', 'seed') AND (c.relowner=r.oid
            OR (n.nspname='public' AND c.relkind IN ('r','p') AND NOT c.relrowsecurity))) AS unsafe
        FROM pg_roles r WHERE r.rolname=current_user`);
      if (guard.rows.length !== 1 || guard.rows[0].unsafe) throw new Error('unsafe_database_role');
      await client.query('BEGIN');started=true;
      await client.query("SELECT set_config('seed.uid', $1, true)", [uid ?? '']);
      const result = await work(client);
      await client.query('COMMIT');committed=true;
      await client.query('DISCARD ALL');
      failed = false;
      return result;
    } catch (error) {
      if(started && !committed && ['40001','40P01'].includes(error?.code))abortedTransactions.add(error);
      try { await client.query('ROLLBACK'); } catch { /* destroy below */ }
      throw error;
    } finally { client.release(failed); }
  }
  return {
    withSession,
    /** @param {{lid:string}} request @param {string|null} [uid] */
    async being(request,uid=null) {
      if(!seedBeingQuery(new URLSearchParams({lid:request.lid})))throw Object.assign(new Error('Invalid portable identity'),{code:'22023'});
      return withSession(uid,async c=>{
        // Ordinary SELECTs intentionally run as the non-owner runtime role:
        // RLS includes current secret-tree and paired-record restrictions.
        const rows=(await c.query(`
          SELECT 'tree' AS kind,id,doc->>'lid' AS lid FROM public.lifetrees WHERE doc->>'lid'=$1 AND length(doc->>'lid')=36
          UNION ALL SELECT 'vision',id,doc->>'lid' FROM public.visions WHERE doc->>'lid'=$1 AND length(doc->>'lid')=36
          UNION ALL SELECT 'community',id,doc->>'lid' FROM public.communities WHERE doc->>'lid'=$1 AND length(doc->>'lid')=36
          UNION ALL SELECT 'pulse',id,doc->>'lid' FROM public.pulses WHERE doc->>'lid'=$1 AND length(doc->>'lid')=36
          UNION ALL SELECT 'person',id,$1 FROM seed.person_lid_candidates($1)
          LIMIT 2`,[request.lid])).rows;
        return seedBeingResult(rows);
      });
    },
    async resolveIdentity(issuer, subject, explicitUid, open) {
      return withSession(null, async c => (await c.query('SELECT seed.resolve_identity($1,$2,$3,$4,$5) AS uid',
        [issuer, subject, explicitUid, open, 'oidc_' + uuidv7()])).rows[0].uid);
    },
    ready: () => withSession(null, async c => {
      if(!(await c.query("SELECT has_function_privilege(current_user,'seed.person_lid_candidates(text)','EXECUTE') AS allowed")).rows[0].allowed)throw new Error('being_lookup_unavailable');
      if(!(await c.query("SELECT has_table_privilege(current_user,'public.pulses','SELECT') AND has_function_privilege(current_user,'seed.can_read_pulse(jsonb)','EXECUTE') AS allowed")).rows[0].allowed)throw new Error('pulse_reads_unavailable');
      if(!(await c.query("SELECT has_function_privilege(current_user,'seed.offering_birth_context(jsonb)','EXECUTE') AND has_function_privilege(current_user,'seed.apply_offering_birth(jsonb,jsonb,jsonb,jsonb)','EXECUTE') AND has_function_privilege(current_user,'seed.offering_recipient(jsonb)','EXECUTE') AND has_function_privilege(current_user,'seed.offering_lifecycle(jsonb)','EXECUTE') AS allowed")).rows[0].allowed)throw new Error('offering_creation_unavailable');
      if(!(await c.query("SELECT has_function_privilege(current_user,'seed.offering_context(text)','EXECUTE') AND has_function_privilege(current_user,'seed.apply_offering_acceptance(text,jsonb,jsonb,bigint,bigint)','EXECUTE') AS allowed")).rows[0].allowed)throw new Error('offering_acceptance_unavailable');
      if(!(await c.query("SELECT has_function_privilege(current_user,'seed.event_circle_context(text)','EXECUTE') AND has_function_privilege(current_user,'seed.apply_event_circle(text,jsonb,jsonb)','EXECUTE') AND has_function_privilege(current_user,'seed.event_draft_context(jsonb)','EXECUTE') AND has_function_privilege(current_user,'seed.apply_event_write(jsonb,jsonb,jsonb,text)','EXECUTE') AND has_function_privilege(current_user,'seed.event_copy_context(text)','EXECUTE') AND has_function_privilege(current_user,'seed.apply_event_copy(text,jsonb,jsonb,text)','EXECUTE') AS allowed")).rows[0].allowed)throw new Error('event_duplication_unavailable');
      if(!(await c.query("SELECT has_table_privilege(current_user,'public.alignments','SELECT') AND has_function_privilege(current_user,'seed.alignment_command(jsonb,text,text)','EXECUTE') AND has_function_privilege(current_user,'seed.alignment_context(text)','EXECUTE') AND has_function_privilege(current_user,'seed.apply_alignment_acceptance(text,jsonb,jsonb,bigint,bigint)','EXECUTE') AS allowed")).rows[0].allowed)throw new Error('alignments_unavailable');
      if(!(await c.query("SELECT has_function_privilege(current_user,'seed.block_context(text,text,boolean)','EXECUTE') AND has_function_privilege(current_user,'seed.apply_block(text,text,jsonb,jsonb,bigint)','EXECUTE') AS allowed")).rows[0].allowed)throw new Error('block_mint_unavailable');
      if(!(await c.query("SELECT has_function_privilege(current_user,'seed.signing_anchor(jsonb)','EXECUTE') AND has_function_privilege(current_user,'seed.signing_identity(text)','EXECUTE') AND has_function_privilege(current_user,'seed.signing_freeze(jsonb)','EXECUTE') AND has_function_privilege(current_user,'seed.signing_history(text,text,text,integer)','EXECUTE') AND has_function_privilege(current_user,'seed.apply_key_rotation(jsonb)','EXECUTE') AND has_function_privilege(current_user,'seed.recovery_context()','EXECUTE') AND has_function_privilege(current_user,'seed.apply_recovery_proposal(jsonb)','EXECUTE') AND has_function_privilege(current_user,'seed.recovery_proposal(text,text)','EXECUTE') AND has_function_privilege(current_user,'seed.prepare_recovery_witness(jsonb)','EXECUTE') AND has_function_privilege(current_user,'seed.apply_recovery_witness(jsonb)','EXECUTE') AND has_function_privilege(current_user,'seed.prepare_recovery_activation(text)','EXECUTE') AND has_function_privilege(current_user,'seed.apply_recovery_activation(text,text[])','EXECUTE') AND has_function_privilege(current_user,'seed.recovery_witnesses(text,text,text,integer)','EXECUTE') AS allowed")).rows[0].allowed)throw new Error('signing_unavailable');
      if(!(await c.query("SELECT has_function_privilege(current_user,'seed.doc_get(text,text,text)','EXECUTE') AND has_function_privilege(current_user,'seed.doc_list(text,text,jsonb,jsonb,jsonb,boolean,jsonb,integer)','EXECUTE') AND has_function_privilege(current_user,'seed.doc_write(jsonb,text)','EXECUTE') AND has_function_privilege(current_user,'seed.love_toggle(text,text)','EXECUTE') AND has_table_privilege(current_user,'public.stays','SELECT') AS allowed")).rows[0].allowed)throw new Error('document_door_unavailable');
      await c.query('SELECT id FROM public.links LIMIT 0');
      await c.query('SELECT id FROM public.communities LIMIT 0');
      await c.query('SELECT id FROM public.lifetrees LIMIT 0');
      if(!(await c.query("SELECT has_function_privilege(current_user,'seed.vision_command(jsonb,text,text)','EXECUTE') AND has_function_privilege(current_user,'seed.vision_pictures(jsonb)','EXECUTE') AND has_function_privilege(current_user,'seed.vision_release(jsonb)','EXECUTE') AS allowed")).rows[0].allowed)throw new Error('vision_commands_unavailable');
      await c.query('SELECT seed.can_read_vision(doc),seed.vision_moment(doc) FROM public.visions LIMIT 0');
      const result = await c.query("SELECT seed.my_profile(), has_function_privilege(current_user, 'seed.save_profile(text,text)', 'EXECUTE') AS writable");
      const community = await c.query("SELECT has_function_privilege(current_user, 'seed.community_command(jsonb,text,text)', 'EXECUTE') AS writable");
      const invites = await c.query("SELECT has_function_privilege(current_user, 'seed.community_invites(text,text,text,integer)', 'EXECUTE') AND has_function_privilege(current_user, 'seed.invite_command(jsonb,text,text,text,text)', 'EXECUTE') AS writable");
      const identity = await c.query("SELECT has_function_privilege(current_user, 'seed.resolve_identity(text,text,text,boolean,text)', 'EXECUTE') AS writable");
      const roles = await c.query("SELECT has_function_privilege(current_user, 'seed.community_role_command(jsonb,text)', 'EXECUTE') AS writable");
      const treeWrite = await c.query("SELECT has_function_privilege(current_user, 'seed.tree_command(jsonb,text,text,text,text)', 'EXECUTE') AS writable");
      const keeperRequests = await c.query("SELECT has_function_privilege(current_user, 'seed.keeper_request_command(jsonb,text,text)', 'EXECUTE') AS writable");
      await c.query('SELECT id FROM public.community_keeper_invites LIMIT 0');
      const keeperOffers = await c.query("SELECT has_function_privilege(current_user, 'seed.keeper_offer_command(jsonb,text,text,text,text)', 'EXECUTE') AS writable");
      if (!keeperOffers.rows[0].writable) throw new Error('missing_keeper_offer_permissions');
      if (!keeperRequests.rows[0].writable) throw new Error('missing_keeper_request_permissions');
      const succession=await c.query("SELECT has_function_privilege(current_user, 'seed.tree_resign(jsonb)', 'EXECUTE') AS writable");
      const treeInvites=await c.query("SELECT has_function_privilege(current_user, 'seed.tree_invites(text,text,boolean,text,integer)', 'EXECUTE') AND has_function_privilege(current_user, 'seed.tree_invite_command(jsonb,text,text[])', 'EXECUTE') AS writable");
      const people=await c.query("SELECT has_function_privilege(current_user, 'seed.people(text,text,text,integer)', 'EXECUTE') AS readable");
      const circles=await c.query("SELECT has_function_privilege(current_user, 'seed.form_circle(jsonb)', 'EXECUTE') AS writable");
      const media=await c.query("SELECT has_function_privilege(current_user, 'seed.media_publish(text,jsonb)', 'EXECUTE') AND has_function_privilege(current_user, 'seed.media_get(text)', 'EXECUTE') AND has_function_privilege(current_user, 'seed.media_write_allowed(text)', 'EXECUTE') AS allowed");
      if(!media.rows[0].allowed)throw new Error('missing_media_permissions');
      const pictures=await c.query("SELECT has_function_privilege(current_user, 'seed.tree_pictures(jsonb)', 'EXECUTE') AS writable");
      if(!pictures.rows[0].writable)throw new Error('missing_tree_picture_permissions');
      const profilePictures=await c.query("SELECT has_function_privilege(current_user, 'seed.profile_picture(jsonb)', 'EXECUTE') AS writable");
      if(!profilePictures.rows[0].writable)throw new Error('missing_profile_picture_permissions');
      const graphWrites=await c.query("SELECT has_function_privilege(current_user, 'seed.link_command(jsonb,text)', 'EXECUTE') AS writable");
      if(!graphWrites.rows[0].writable)throw new Error('missing_graph_write_permissions');
      const attestations=await c.query("SELECT has_function_privilege(current_user, 'seed.community_attestation(jsonb,text)', 'EXECUTE') AS writable");
      if(!attestations.rows[0].writable)throw new Error('missing_attestation_permissions');
      const gardens=await c.query("SELECT has_function_privilege(current_user, 'seed.garden_command(jsonb,text)', 'EXECUTE') AS writable");
      if(!gardens.rows[0].writable)throw new Error('missing_garden_permissions');
      const treeRequests=await c.query("SELECT has_function_privilege(current_user, 'seed.tree_keeper_request(jsonb,text,text,text[])', 'EXECUTE') AS writable");
      if(!treeRequests.rows[0].writable)throw new Error('missing_tree_request_permissions');
      const participation=await c.query("SELECT has_function_privilege(current_user, 'seed.participation_command(jsonb,text)', 'EXECUTE') AS writable");
      if(!participation.rows[0].writable)throw new Error('missing_participation_permissions');
      if(!circles.rows[0].writable)throw new Error('missing_circle_permissions');
      if(!people.rows[0].readable)throw new Error('missing_people_permissions');
      if(!treeInvites.rows[0].writable)throw new Error('missing_tree_invite_permissions');
      if (!succession.rows[0].writable) throw new Error('missing_tree_succession_permissions');
      if (!treeWrite.rows[0].writable) throw new Error('missing_tree_permissions');
      if (!roles.rows[0].writable) throw new Error('missing_community_role_permissions');
      if (!identity.rows[0].writable) throw new Error('missing_identity_permissions');
      if (!invites.rows[0].writable) throw new Error('missing_invite_permissions');
      if (!community.rows[0].writable) throw new Error('missing_community_permissions');
      if (!result.rows[0].writable) throw new Error('missing_profile_permissions');
    }),
    /** @param {*} request @param {string | null} [uid] */
    async links(request, uid = null) {
      const privateSeats = request.kind === 'secretLinks';
      if (privateSeats && !uid) throw new Error('authentication_required');
      return withSession(uid, async c => {
        // Direction is a closed internal enum. All user-supplied values are parameters.
        if (!['from', 'to','rel'].includes(request.direction) || (privateSeats && request.direction==='rel')) throw new Error('invalid_direction');
        if(privateSeats && request.direction==='to') {
          const access=await c.query('SELECT seed.keeps_secret_tree($1) AS allowed',[request.id]);
          if(!access.rows[0].allowed)throw Object.assign(new Error('Forbidden'),{code:'42501'});
        }
        const field = request.direction === 'from' ? 'from_id' : request.direction==='to' ? 'to_id' : 'rel';
        const result = await c.query(`SELECT id, from_id, rel, to_id, lid, doc, created_at
          FROM public.${privateSeats ? 'secret_links' : 'links'} WHERE ${field} = $1 AND ($2::text IS NULL OR rel = $2)
          AND ($3::text IS NULL OR id > $3) ORDER BY id LIMIT $4`,
        [request.id, request.rel, request.after, request.limit + 1]);
        const rows = result.rows.slice(0, request.limit);
        return {
          links: rows.map(r => ({ ...r.doc, id: r.id, from: r.from_id, rel: r.rel,
            to: r.to_id, lid: r.lid, createdAt: r.created_at.toISOString() })),
          next: result.rows.length > request.limit ? rows.at(-1).id : null,
        };
      });
    },
    // THE DOCUMENT DOOR (ring 2026-11-02): one document under the `get` law, or a page under the
    // row-level policies — the asking role's own sight, never widened by a filter.
    async docs(request,uid=null) {
      return withSession(uid,async c=>{
        if(request.id!==null) return {doc:(await c.query('SELECT seed.doc_get($1,$2,$3) AS doc',[request.collection,request.parent,request.id])).rows[0].doc};
        const page=(await c.query('SELECT seed.doc_list($1,$2,$3::jsonb,$4::jsonb,$5::jsonb,$6,$7::jsonb,$8) AS page',
          [request.collection,request.parent,JSON.stringify(request.equals),JSON.stringify(request.contains),JSON.stringify(request.within),
            request.newest,request.after===null?null:JSON.stringify(request.after),request.limit])).rows[0].page;
        return {items:page.items,next:page.next};
      });
    },
    // A write as a claim: the law (seed.doc_write) locks, patches, judges and stores; love is its own gesture.
    async docCommand(uid,command) {
      if(command.action==='love') {
        if(!uid)throw new Error('authentication_required');
        return withSession(uid,async c=>(await c.query('SELECT seed.love_toggle($1,$2) AS result',[command.kind,command.id])).rows[0].result);
      }
      return withSession(uid,async c=>(await c.query('SELECT seed.doc_write($1::jsonb,$2) AS result',[JSON.stringify(command),randomBytes(10).toString('hex')])).rows[0].result);
    },
    async linkCommand(uid,command) {
      if(command.rel==='participant')return withSession(uid,async c=>(await c.query('SELECT seed.participation_command($1::jsonb,$2) AS result',[JSON.stringify(command),uuidv7()])).rows[0].result);
      if(command.rel==='grows_in')return withSession(uid,async c=>(await c.query('SELECT seed.garden_command($1::jsonb,$2) AS result',[JSON.stringify(command),uuidv7()])).rows[0].result);
      if(SEED_INTERBEING_RELATIONS.includes(command.rel))return withSession(uid,async c=>(await c.query('SELECT seed.community_attestation($1::jsonb,$2) AS result',[JSON.stringify(command),uuidv7()])).rows[0].result);
      return withSession(uid,async c=>(await c.query('SELECT seed.link_command($1::jsonb,$2) AS result',[JSON.stringify(command),uuidv7()])).rows[0].result);
    },
    /** @param {*} request @param {string | null} [uid] */
    async invites(request, uid = null) {
      return withSession(uid, async c => (await c.query('SELECT seed.community_invites($1,$2,$3,$4) AS result',
        [request.id, request.community, request.after, request.limit])).rows[0].result);
    },
    async inviteCommand(uid, command) {
      if (!uid) throw new Error('authentication_required');
      return withSession(uid, async c => (await c.query('SELECT seed.invite_command($1::jsonb,$2,$3,$4,$5) AS result',
        [JSON.stringify(command), randomBytes(24).toString('hex'), uuidv7(), uuidv7(), uuidv7()])).rows[0].result);
    },
    async mediaAllowed(uid,path) {
      return withSession(uid,async c=>(await c.query('SELECT seed.media_write_allowed($1) AS allowed',[path])).rows[0].allowed===true);
    },
    async mediaGet(path) {
      return withSession(null,async c=>(await c.query('SELECT seed.media_get($1) AS media',[path])).rows[0].media);
    },
    // THE RELEASE OF A PICTURE (ring 2026-11-03): the hashes are locked before the insert and the files
    // checked under the lock, so a sweep of the same bytes never crosses a publish (media_swept: encode again).
    /** @param {string} uid @param {string} path @param {*} manifest @param {((manifest: *) => Promise<boolean>) | null} [present] */
    async mediaPublish(uid,path,manifest,present=null) {
      return withSession(uid,async c=>{
        // Only well-formed hashes are locked here; a malformed manifest meets media_publish's own refusal.
        const hashes=['primary','small','large'].map(k=>manifest?.[k]?.hash).filter(h=>typeof h==='string' && /^[a-f0-9]{64}$/.test(h));
        await c.query('SELECT seed.media_lock($1::text[])',[hashes]);
        if(present && !(await present(manifest)))throw Object.assign(new Error('media_swept'),{code:'MEDIA_SWEPT'});
        return (await c.query('SELECT seed.media_publish($1,$2::jsonb) AS media',[path,JSON.stringify(manifest)])).rows[0].media;
      });
    },
    mediaRelease:(uid,url,media)=>pictures.releasePicture({repository:picturesRepository(withSession),media,uid,url}),
    async people(request) {
      return withSession(null,async c=>(await c.query('SELECT seed.people($1,$2,$3,$4) AS result',[request.id,request.query,request.after,request.limit])).rows[0].result);
    },
    async treeInvites(request,uid) {
      return withSession(uid,async c=>(await c.query('SELECT seed.tree_invites($1,$2,$3,$4,$5) AS result',
        [request.id,request.tree,request.mine,request.after,request.limit])).rows[0].result);
    },
    async treeInviteCommand(uid,command) {
      if(!uid)throw new Error('authentication_required');
      return withSession(uid,async c=>(await c.query('SELECT seed.tree_invite_command($1::jsonb,$2,$3::text[]) AS result',
        [JSON.stringify(command),randomBytes(24).toString('hex'),Array.from({length:5},()=>uuidv7())])).rows[0].result);
    },
    async treeCommand(uid, command, nodeDomain) {
      if(['request_keeper','cancel_keeper_request','decline_keeper_request','answer_keeper_request'].includes(command.action))return withSession(uid,async c=>(await c.query(
        'SELECT seed.tree_keeper_request($1::jsonb,$2,$3,$4::text[]) AS result',[JSON.stringify(command),uuidv7(),randomBytes(24).toString('hex'),Array.from({length:5},()=>uuidv7())])).rows[0].result);
      if(command.action==='set_pictures') return withSession(uid, async c=>(await c.query('SELECT seed.tree_pictures($1::jsonb) AS result',[JSON.stringify(command)])).rows[0].result);
      if (!uid) throw new Error('authentication_required');
      if(command.action==='resign_keeper') return withSession(uid, async c=>(await c.query('SELECT seed.tree_resign($1::jsonb) AS result',[JSON.stringify(command)])).rows[0].result);
      return withSession(uid, async c => (await c.query('SELECT seed.tree_command($1::jsonb,$2,$3,$4,$5) AS result',
        [JSON.stringify(command), uuidv7(), uuidv7(), uuidv7(), nodeDomain])).rows[0].result);
    },
    async keeperInvites(request, uid) {
      if (!uid) throw new Error('authentication_required');
      return withSession(uid, async c => {
        const result = await c.query(`SELECT id,doc FROM public.community_keeper_invites WHERE doc->>'status'='pending'
          AND ($1::text IS NULL OR doc->>'communityId'=$1)
          AND ($2::text IS NULL OR doc->>'invitedUserId'=$2)
          AND ($3::text IS NULL OR id>$3) ORDER BY id LIMIT $4`,
        [request.community,request.mine ? uid : null,request.after,request.limit+1]);
        const rows=result.rows.slice(0,request.limit);
        return { invites:rows.map(row=>({...row.doc,id:row.id})),next:result.rows.length>request.limit ? rows.at(-1).id : null };
      });
    },
    async communityCommand(uid, command, nodeDomain) {
      if (!uid) throw new Error('authentication_required');
      if(command.action==='form_circle')return withSession(uid,async c=>(await c.query('SELECT seed.form_circle($1::jsonb) AS result',[JSON.stringify(command)])).rows[0].result);
      if (['offer_keeper','accept_keeper_offer','decline_keeper_offer'].includes(command.action)) {
        return withSession(uid, async c => (await c.query('SELECT seed.keeper_offer_command($1::jsonb,$2,$3,$4,$5) AS result',
          [JSON.stringify(command),uuidv7(),uuidv7(),uuidv7(),uuidv7()])).rows[0].result);
      }
      if (['request_keeper','cancel_keeper_request','accept_keeper_request','decline_keeper_request'].includes(command.action)) {
        return withSession(uid, async c => (await c.query('SELECT seed.keeper_request_command($1::jsonb,$2,$3) AS result',
          [JSON.stringify(command), uuidv7(), uuidv7()])).rows[0].result);
      }
      if (['grant_steward','revoke_steward','resign_keeper'].includes(command.action)) {
        return withSession(uid, async c => (await c.query('SELECT seed.community_role_command($1::jsonb,$2) AS result',
          [JSON.stringify(command), uuidv7()])).rows[0].result);
      }
      return withSession(uid, async c => (await c.query('SELECT seed.community_command($1::jsonb,$2,$3) AS result',
        [JSON.stringify(command), uuidv7(), nodeDomain])).rows[0].result);
    },
    /** @param {*} request @param {string | null} [uid] */
    async trees(request, uid = null) {
      return withSession(uid, async c => {
        if (request.id !== null) {
          const result = await c.query(`SELECT id,doc,seed.can_edit_tree(id,doc) AS editable,seed.is_tree_keeper(id,doc) AS keeper, seed.is_staff() AS staff, EXISTS(SELECT 1 FROM public.links WHERE from_id=seed.uid() AND rel='steward' AND to_id=lifetrees.id) AS steward FROM public.lifetrees WHERE id=$1`, [request.id]);
          const row = result.rows[0];
          return { tree: row ? { ...row.doc, id: row.id } : null, ...(row && uid ? { access: { editable: row.editable === true, keeper: row.keeper === true, inviteMode: row.keeper || row.staff ? 'all' : row.steward && row.doc.treeType!=='SECRET' ? 'open' : null } } : {}) };
        }
        // Legacy unstamped trees remain reachable by ID or explicit public garden
        // references, not anonymously discoverable in an unscoped forest listing.
        // Circle membership is enforced by RLS, so pagination follows authorized rows.
        const result = await c.query(`SELECT id,doc FROM public.lifetrees WHERE
          (doc ? 'visibility' OR doc->>'anchorUid'=seed.uid() OR seed.is_staff() OR $6::text IS NOT NULL OR $7::text IS NOT NULL OR $8::boolean)
          AND ($1::text IS NULL OR doc->>'domain'=$1) AND ($2::text IS NULL OR doc->>'anchorUid'=$2)
          AND ($3::text IS NULL OR coalesce(doc->>'treeType',CASE WHEN doc->>'isNature'='true' THEN 'GUARDED' ELSE 'LIFETREE' END)=$3)
          AND ($6::text IS NULL OR (coalesce(doc->>'treeType','') NOT IN ('BED','SECRET') AND EXISTS(
            SELECT 1 FROM public.links WHERE from_id=lifetrees.id AND rel='grows_in' AND to_id=$6)))
          AND ($7::text IS NULL OR (coalesce(doc->>'treeType','') NOT IN ('BED','SECRET') AND EXISTS(
            SELECT 1 FROM public.links WHERE from_id=lifetrees.id AND rel='participant' AND to_id=$7)))
          AND (NOT $8::boolean OR seed.can_edit_tree(id,doc))
          AND ($4::text IS NULL OR id>$4) ORDER BY id LIMIT $5`,
        [request.domain, request.anchor, request.treeType, request.after, request.limit+1,request.garden??null,request.participating??null,request.editable===true]);
        const rows = result.rows.slice(0,request.limit);
        return { trees: rows.map(row => ({ ...row.doc, id: row.id })), next: result.rows.length>request.limit ? rows.at(-1).id : null };
      });
    },
    async offeringLifecycle(uid,input) {
      const command=seedOfferingCommand(input);
      if(!command || !['edit','set_active','withdraw','decline'].includes(command.action))throw Object.assign(new Error('Invalid offering command'),{code:'22023'});
      return withSession(uid,async c=>(await c.query('SELECT seed.offering_lifecycle($1::jsonb) AS result',[JSON.stringify(command)])).rows[0].result);
    },
    async createOffering(uid,input,nodeDomain) {
      const command=seedOfferingCreation(input);
      if(!command || typeof nodeDomain!=='string' || !nodeDomain)throw Object.assign(new Error('Invalid offering draft'),{code:'22023'});
      return withSession(uid,async c=>{
        const context=(await c.query('SELECT seed.offering_birth_context($1::jsonb) AS context',[JSON.stringify(command)])).rows[0].context;
        const mintedAt=Date.now();
        const born=await prepareOfferingBirth({uid,input:command,context,nodeDomain,mintedAt,
          id:randomBytes(20).toString('hex'),lid:uuidv7(mintedAt,randomBytes(10)),
          noticeId:randomBytes(20).toString('hex'),noticeLid:uuidv7(mintedAt,randomBytes(10))});
        return (await c.query('SELECT seed.apply_offering_birth($1::jsonb,$2::jsonb,$3::jsonb,$4::jsonb) AS result',
          [JSON.stringify(command),JSON.stringify(born.record),JSON.stringify(born.birthProof),JSON.stringify(born.notice)])).rows[0].result;
      });
    },
    /** @param {*} uid @param {*} input @param {string | null} [nodeDomain] */
    async eventCommand(uid,input,nodeDomain=null) {
      const command=seedEventCommand(input);if(!command)throw Object.assign(new Error('Invalid event command'),{code:'22023'});
      return withSession(uid,async c=>{
        if(command.action==='form_circle') {
          const context=(await c.query('SELECT seed.event_circle_context($1) AS context',[command.id])).rows[0].context;
          const mintedAt=Date.now();
          const prepared=prepareEventCircle({uid,input:command,context,id:randomBytes(20).toString('hex'),lid:uuidv7(mintedAt,randomBytes(10)),mintedAt});
          const edges=[...prepared.members.map(from=>({from,rel:'member'})),...prepared.trees.map(from=>({from,rel:'participant'}))]
            .map(edge=>({...edge,to:prepared.communityId,lid:uuidv7(mintedAt,randomBytes(10))}));
          return (await c.query('SELECT seed.apply_event_circle($1,$2::jsonb,$3::jsonb) AS result',[command.id,JSON.stringify(prepared),JSON.stringify(edges)])).rows[0].result;
        }
        if(command.action!=='duplicate') {
          const context=(await c.query('SELECT seed.event_draft_context($1::jsonb) AS context',[JSON.stringify(command)])).rows[0].context;
          const mintedAt=Date.now();
          const born=command.action==='create'?await prepareEventBirth({uid,input:command,context,id:randomBytes(20).toString('hex'),lid:uuidv7(mintedAt,randomBytes(10)),nodeDomain,mintedAt})
            :{record:prepareEventContent(command,context),birthProof:null};
          return (await c.query('SELECT seed.apply_event_write($1::jsonb,$2::jsonb,$3::jsonb,$4) AS result',
            [JSON.stringify(command),JSON.stringify(born.record),JSON.stringify(born.birthProof),nodeDomain])).rows[0].result;
        }
        const context=(await c.query('SELECT seed.event_copy_context($1) AS context',[command.id])).rows[0].context;
        const mintedAt=Date.now();
        const born=await prepareEventDuplication({uid,parentId:command.id,context,id:randomBytes(20).toString('hex'),lid:uuidv7(mintedAt,randomBytes(10)),mintedAt});
        return (await c.query('SELECT seed.apply_event_copy($1,$2::jsonb,$3::jsonb,$4) AS result',
          [command.id,JSON.stringify(born.record),JSON.stringify(born.birthProof),uuidv7(mintedAt,randomBytes(10))])).rows[0].result;
      });
    },
    async alignmentCommand(uid,input,nodeDomain) {
      const command=seedAlignmentCommand(input);if(!command)throw Object.assign(new Error('Invalid alignment'),{code:'22023'});
      if(command.action==='accept')return this.acceptAlignment(uid,command.id,nodeDomain);
      return withSession(uid,async c=>(await c.query('SELECT seed.alignment_command($1::jsonb,$2,$3) AS result',
        [JSON.stringify(command),randomBytes(20).toString('hex'),uuidv7(Date.now(),randomBytes(10))])).rows[0].result);
    },
    /** @param {*} request @param {string | null} [uid] */
    async alignments(request,uid=null) {
      return withSession(uid,async c=>{
        if(request.id!==null) {
          const row=(await c.query('SELECT id,doc FROM public.alignments WHERE id=$1',[request.id])).rows[0];
          return {alignment:row?{...row.doc,id:row.id}:null};
        }
        const result=await c.query(`SELECT id,doc,to_char(seed.vision_moment(doc) AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS moment
          FROM public.alignments WHERE ($1::text IS NULL OR doc->>'initiatorTreeId'=$1 OR doc->>'targetTreeId'=$1)
          AND (NOT $2::boolean OR doc->>'initiatorUid'=seed.uid() OR doc->>'targetUid'=seed.uid())
          AND (NOT $3::boolean OR doc->>'targetUid'=seed.uid()) AND ($4::text IS NULL OR doc->>'status'=$4)
          AND ($5::timestamptz IS NULL OR (seed.vision_moment(doc),id COLLATE "C")<($5::timestamptz,$6::text COLLATE "C"))
          ORDER BY seed.vision_moment(doc) DESC,id COLLATE "C" DESC LIMIT $7`,
          [request.tree,request.participant,request.target,request.status,request.after?.moment??null,request.after?.id??null,request.limit+1]);
        const rows=result.rows.slice(0,request.limit),last=rows.at(-1);
        return {alignments:rows.map(row=>({...row.doc,id:row.id})),next:result.rows.length>request.limit?JSON.stringify([last.moment,last.id]):null};
      });
    },
    async acceptAlignment(uid,id,nodeDomain) {
      if(typeof id!=='string'||!id||id.length>512||typeof nodeDomain!=='string'||!nodeDomain)throw Object.assign(new Error('Invalid alignment'),{code:'22023'});
      return withSession(uid,async c=>{
        const context=(await c.query('SELECT seed.alignment_context($1) AS context',[id])).rows[0].context;
        const mintedAt=Date.now();
        const born=await prepareAlignmentAcceptance({uid,id,context,nodeDomain,mintedAt,
          sourceId:randomBytes(20).toString('hex'),sourceLid:uuidv7(mintedAt,randomBytes(10)),
          targetId:randomBytes(20).toString('hex'),targetLid:uuidv7(mintedAt,randomBytes(10))});
        return (await c.query('SELECT seed.apply_alignment_acceptance($1,$2::jsonb,$3::jsonb,$4,$5) AS result',
          [id,JSON.stringify(born.fromRecord),JSON.stringify(born.toRecord),born.fromHeight,born.toHeight])).rows[0].result;
      });
    },
    async acceptOffering(uid,id) {
      return withSession(uid,async c=>{
        const context=(await c.query('SELECT seed.offering_context($1) AS context',[id])).rows[0].context;
        const mintedAt=Date.now();
        const born=await prepareOfferingAcceptance({uid,context,mintedAt,
          fromId:randomBytes(20).toString('hex'),fromLid:uuidv7(mintedAt,randomBytes(10)),
          toId:randomBytes(20).toString('hex'),toLid:uuidv7(mintedAt,randomBytes(10))});
        return (await c.query('SELECT seed.apply_offering_acceptance($1,$2::jsonb,$3::jsonb,$4,$5) AS result',
          [id,JSON.stringify(born.fromRecord),JSON.stringify(born.toRecord),born.fromHeight,born.toHeight])).rows[0].result;
      });
    },
    async blockCommand(uid,input,nodeDomain) {
      const command=seedBlockCommand(input);if(!command)throw Object.assign(new Error('Invalid block'),{code:'22023'});
      // THE UNMINT (ring 2026-11-02): the head taken back under domain/unmint, its touch lifted.
      if(command.action==='unmint')return organs.unmint(withSession,uid,command.pulseId);
      return withSession(uid,async c=>{
        const context=(await c.query('SELECT seed.block_context($1,$2,$3) AS context',[command.on,command.id,command.block.care==='watering'])).rows[0].context;
        const mintedAt=Date.now(),id=randomBytes(20).toString('hex'),lid=uuidv7(mintedAt,randomBytes(10));
        const born=await prepareBlock({uid,command,context,id,lid,nodeDomain,mintedAt});
        await c.query('SELECT seed.apply_block($1,$2,$3::jsonb,$4::jsonb,$5)',[command.on,command.id,JSON.stringify(born.record),JSON.stringify(born.patch),born.blockHeight]);
        return born.result;
      });
    },
    async signingIdentity(id) {
      return withSession(null,async c=>(await c.query('SELECT seed.signing_identity($1) AS result',[id])).rows[0].result);
    },
    async signingHistory(request) {
      return withSession(null,async c=>(await c.query('SELECT seed.signing_history($1,$2,$3,$4) AS result',[request.id,request.collection,request.after,request.limit])).rows[0].result);
    },
    async recoveryWitnesses(uid,request) {
      return withSession(uid,async c=>(await c.query('SELECT seed.recovery_witnesses($1,$2,$3,$4) AS result',[request.id,request.event,request.after,request.limit])).rows[0].result);
    },
    async recoveryContext(uid) {
      return withSession(uid,async c=>({context:(await c.query('SELECT seed.recovery_context() AS context')).rows[0].context}));
    },
    async recoveryProposal(uid,id,event) {
      return withSession(uid,async c=>(await c.query('SELECT seed.recovery_proposal($1,$2) AS result',[id,event])).rows[0].result);
    },
    async signingCommand(uid,command) {
      if(command.action==='activate_recovery')return withSession(uid,async c=>{
        const prepared=(await c.query('SELECT seed.prepare_recovery_activation($1) AS prepared',[command.eventId])).rows[0].prepared;
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
        return (await c.query('SELECT seed.apply_recovery_activation($1,$2::text[]) AS result',[command.eventId,[...accepted.values()]])).rows[0].result;
      });
      if(command.action==='witness_recovery')return withSession(uid,async c=>{
        const proposal=(await c.query('SELECT seed.prepare_recovery_witness($1::jsonb) AS proposal',[JSON.stringify(command)])).rows[0].proposal;
        if(!verifiesRecoveryWitness(uid,proposal,command))throw Object.assign(new Error('Invalid witness proof'),{code:'42501'});
        return (await c.query('SELECT seed.apply_recovery_witness($1::jsonb) AS result',[JSON.stringify(command)])).rows[0].result;
      });
      if(command.action==='begin_recovery')return withSession(uid,async c=>{
        const context=(await c.query('SELECT seed.recovery_context() AS context')).rows[0].context;
        if(!verifiesRecoveryCandidate(context,command))throw Object.assign(new Error('Invalid candidate proof'),{code:'42501'});
        return (await c.query('SELECT seed.apply_recovery_proposal($1::jsonb) AS result',[JSON.stringify(command)])).rows[0].result;
      });
      if(command.action==='rotate') {
        if(!verifiesRotation(uid,command))throw Object.assign(new Error('Invalid rotation proof'),{code:'42501'});
        return withSession(uid,async c=>(await c.query('SELECT seed.apply_key_rotation($1::jsonb) AS result',[JSON.stringify(command)])).rows[0].result);
      }
      if(command.action==='freeze')return withSession(uid,async c=>(await c.query('SELECT seed.signing_freeze($1::jsonb) AS result',[JSON.stringify(command)])).rows[0].result);
      return withSession(uid,async c=>(await c.query('SELECT seed.signing_anchor($1::jsonb) AS result',[JSON.stringify(command)])).rows[0].result);
    },
    async visionCommand(uid,command,nodeDomain) {
      if(command.action==='release')return withSession(uid,async c=>(await c.query('SELECT seed.vision_release($1::jsonb) AS result',[JSON.stringify(command)])).rows[0].result);
      if(command.action==='set_pictures')return withSession(uid,async c=>(await c.query('SELECT seed.vision_pictures($1::jsonb) AS result',[JSON.stringify(command)])).rows[0].result);
      return withSession(uid,async c=>(await c.query('SELECT seed.vision_command($1::jsonb,$2,$3) AS result',[JSON.stringify(command),uuidv7(),nodeDomain])).rows[0].result);
    },
    /** @param {*} request @param {string | null} [uid] */
    async pulses(request,uid=null) {
      return withSession(uid,async c=>{
        if(request.id!==null) {
          const row=(await c.query('SELECT id,doc FROM public.pulses WHERE id=$1',[request.id])).rows[0];
          return {pulse:row?{...row.doc,id:row.id}:null};
        }
        const result=await c.query(`SELECT id,doc,to_char(seed.vision_moment(doc) AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS moment
          FROM public.pulses WHERE (doc->>'visibility' IN ('public','node','community','circle')
            OR (jsonb_typeof(doc->'authorId')='string' AND doc->>'authorId'=seed.uid()) OR seed.is_staff() OR seed.offering_twin_party(id,doc) OR seed.offering_recipient(doc)
            OR (jsonb_typeof(doc->'recipientUid')='string' AND doc->>'recipientUid'=seed.uid())
            OR (seed.uid() IS NOT NULL AND jsonb_typeof(doc->'participantUids')='array' AND doc->'participantUids' @> jsonb_build_array(seed.uid())))
          AND ($1::text IS NULL OR doc->>'lifetreeId'=$1 OR doc->>'treeId'=$1)
          AND ($2::text IS NULL OR doc->>'visionId'=$2) AND ($3::text IS NULL OR doc->>'communityId'=$3)
          AND ($4::text IS NULL OR doc->>'authorId'=$4) AND ($5::text IS NULL OR doc->>'recipientUid'=$5)
          AND ($6::text IS NULL OR (jsonb_typeof(doc->'participantUids')='array' AND doc->'participantUids' @> jsonb_build_array($6::text)))
          AND ($7::text IS NULL OR doc->>'type'=$7) AND ($8::text IS NULL OR doc->>'domain'=$8)
          AND ($9::timestamptz IS NULL OR (seed.vision_moment(doc),id COLLATE "C")<($9::timestamptz,$10::text COLLATE "C"))
          ORDER BY seed.vision_moment(doc) DESC,id COLLATE "C" DESC LIMIT $11`,
          [request.tree,request.vision,request.community,request.author,request.recipient,request.participant,request.type,request.domain,
            request.after?.moment??null,request.after?.id??null,request.limit+1]);
        const rows=result.rows.slice(0,request.limit),last=rows.at(-1);
        return {pulses:rows.map(row=>({...row.doc,id:row.id})),next:result.rows.length>request.limit?JSON.stringify([last.moment,last.id]):null};
      });
    },
    /** @param {*} request @param {string | null} [uid] */
    async visions(request,uid=null) {
      return withSession(uid,async c=>{
        if(request.id!==null){
          const result=await c.query('SELECT id,doc FROM public.visions WHERE id=$1',[request.id]);
          const row=result.rows[0];return {vision:row?{...row.doc,id:row.id}:null};
        }
        const result=await c.query(`SELECT id,doc,to_char(seed.vision_moment(doc) AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS moment
          FROM public.visions WHERE (doc->>'visibility' IN ('public','node') OR (jsonb_typeof(doc->'authorId')='string' AND doc->>'authorId'=seed.uid()) OR seed.is_staff() OR seed.offering_twin_party(id,doc) OR seed.offering_recipient(doc))
          AND ($1::text IS NULL OR doc->>'domain'=$1) AND ($2::text IS NULL OR doc->>'authorId'=$2)
          AND ($3::text IS NULL OR doc->>'lifetreeId'=$3)
          AND ($4::text IS NULL OR EXISTS(SELECT 1 FROM public.links WHERE from_id=$4 AND rel='joined' AND to_id=visions.id))
          AND ($5::timestamptz IS NULL OR (seed.vision_moment(doc),id COLLATE "C")<($5::timestamptz,$6::text COLLATE "C"))
          ORDER BY seed.vision_moment(doc) DESC,id COLLATE "C" DESC LIMIT $7`,
        [request.domain,request.author,request.tree,request.joined,request.after?.moment??null,request.after?.id??null,request.limit+1]);
        const rows=result.rows.slice(0,request.limit),last=rows.at(-1);
        return {visions:rows.map(row=>({...row.doc,id:row.id})),next:result.rows.length>request.limit?JSON.stringify([last.moment,last.id]):null};
      });
    },
    /** @param {*} request @param {string | null} [uid] */
    async communities(request, uid = null) {
      return withSession(uid, async c => {
        if (request.id !== null) {
          const result = await c.query('SELECT id, doc FROM public.communities WHERE id = $1', [request.id]);
          const row = result.rows[0];
          if (!row) return { community: null };
          const access = uid ? (await c.query(`SELECT
            ($1::text = $2 OR EXISTS(SELECT 1 FROM public.links WHERE from_id=$1 AND rel='keeper' AND to_id=$3)) AS keeper,
            EXISTS(SELECT 1 FROM public.links WHERE from_id=$1 AND rel='steward' AND to_id=$3) AS steward,
            ($1::text = $2 OR EXISTS(SELECT 1 FROM public.links WHERE from_id=$1 AND rel='member' AND to_id=$3)) AS joined,
            EXISTS(SELECT 1 FROM public.links WHERE from_id=$1 AND rel='join_request' AND to_id=$3) AS requested,
            EXISTS(SELECT 1 FROM public.links WHERE from_id=$1 AND rel='keeper_request' AND to_id=$3) AS "keeperRequested",
            coalesce(seed.can_form_circle($3,$4::jsonb),false) AS "canFormCircle"`,
          [uid, row.doc.anchorUid ?? '', row.id, JSON.stringify(row.doc)])).rows[0] : null;
          return { community: { ...row.doc, id: row.id }, ...(access ? { access } : {}) };

        }
        const result = await c.query(`SELECT id, doc FROM public.communities
          WHERE ($1::text IS NULL OR id > $1) ORDER BY id LIMIT $2`, [request.after, request.limit + 1]);
        const rows = result.rows.slice(0, request.limit);
        return { communities: rows.map(row => ({ ...row.doc, id: row.id })),
          next: result.rows.length > request.limit ? rows.at(-1).id : null };
      });
    },
    /** @param {string} uid @param {{displayName: string} | {action: string, slot: string, path: string | null} | null} [input] */
    async profile(uid, input = null) {
      if(input?.action==='set_picture')return withSession(uid,async c=>({profile:(await c.query('SELECT seed.profile_picture($1::jsonb) AS profile',[JSON.stringify(input)])).rows[0].profile}));
      if (!uid) throw new Error('authentication_required');
      return withSession(uid, async c => {
        const result = input
          ? await c.query('SELECT seed.save_profile($1, $2) AS profile, seed.my_email() AS email', [input.displayName, uuidv7()])
          : await c.query('SELECT seed.my_profile() AS profile, seed.my_email() AS email');
        // The address the login carried (migration 056 record_login_email) rides beside the profile for the shell's own eyes.
        return { profile: result.rows[0].profile, email: result.rows[0].email ?? null };
      });
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
    requestInvite:input=>withSession(null,async c=>(await c.query('SELECT seed.request_invite($1,$2,$3) AS result',[input.email,input.reason,uuidv7()])).rows[0].result),
    unsubscribe:(token,ownDomains)=>withSession(null,async c=>(await c.query('SELECT seed.unsubscribe($1,$2::text[]) AS result',[token,ownDomains])).rows[0].result===true),
    // The address a verified login carries, remembered on the account (never matched as identity).
    recordEmail:(uid,email)=>withSession(null,async c=>{await c.query('SELECT seed.record_login_email($1,$2)',[uid,email]);}),
    // THE ORGANS (ring 2026-11-02): light, staff, the account's departure, the domain proofs and doors.
    lightCommand:(uid,command)=>organs.lightCommand(withSession,uid,command),
    staffCommand:(uid,command)=>organs.staffCommand(withSession,uid,command),
    repairCommand:(uid,command)=>repairs.repairCommand({repository:repairsRepository(withSession),uid,command}),
    accountCommand:(uid,command)=>organs.accountCommand(withSession,uid,command),
    domainCommand:(uid,command,context)=>organs.domainCommand(withSession,uid,command,context),
    close: () => pool.end(),
  };
}
