import {seedEventCommand} from '../../src/domain/seedEvent.mjs';
import {seedAlignmentCommand} from '../../src/domain/seedAlignment.mjs';
import {seedOfferingCommand} from '../../src/domain/seedOffering.mjs';
import {seedBlockCommand} from '../../src/domain/seedBlock.mjs';
import {blockRefusalStatus} from './blocks.mjs';
import {seedSigningCommand} from '../../src/domain/seedSigning.mjs';
import {seedVisionCommand} from '../../src/domain/seedVision.mjs';
import { seedMediaUploadPath, SEED_MEDIA_MAX_BYTES } from '../../src/domain/seedMedia.mjs';
import { seedLinkCommand } from '../../src/domain/seedLink.mjs';
import { seedTreeInviteCommand } from '../../src/domain/seedTreeInvite.mjs';
import { seedTreeCommand } from '../../src/domain/seedTree.mjs';
import { seedInviteCommand } from '../../src/domain/seedInvite.mjs';
import { seedCommunityCommand } from '../../src/domain/seedCommunity.mjs';
import { seedProfileInput } from '../../src/domain/seedProfile.mjs';
import { createServer } from 'node:http';
import { seedRequest } from '../../src/domain/seedRequest.mjs';

/** @param {*} database @param {(authorization: string) => Promise<string | null>} [authenticate]
 * @param {{nodeDomain: string | null, media?: *}} [options] */
export function createApi(database, authenticate = async () => null, options = { nodeDomain: null }) {
  const server = createServer({ maxHeaderSize: 8192 }, async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const send = (status, body) => { res.writeHead(status); res.end(JSON.stringify(body)); };
    try {
      const uid = req.headers.authorization ? await authenticate(req.headers.authorization) : null;
      const request = seedRequest(req.method, req.url, req.headers.authorization, uid !== null);
      if (request.error) {
        if (request.status === 401) res.setHeader('WWW-Authenticate', 'Bearer');
        if (request.status === 405) res.setHeader('Allow', req.url?.endsWith('/command') || req.url === '/v1/media/upload' ? 'POST' : req.url === '/v1/me/profile' ? 'GET, POST' : 'GET');
        send(request.status, { error: request.error });
      } else if (request.kind === 'me') send(200, { uid });
      else if(['eventCommand','alignmentCommand','linkCommand','visionCommand','signingCommand','blockCommand','offeringCommand'].includes(request.kind)) {
        if(!/^application\/json(?:;\s*charset=utf-8)?$/i.test(req.headers['content-type']??'')){send(415,{error:'json_required'});return;}
        const body=await readJsonBody(req,['eventCommand','visionCommand','blockCommand','offeringCommand'].includes(request.kind)?262144:request.kind==='alignmentCommand'?16384:2048);
        if(body.error){res.setHeader('Connection','close');send(body.status,{error:body.error});return;}
        const command=request.kind==='eventCommand'?seedEventCommand(body.value):request.kind==='alignmentCommand'?seedAlignmentCommand(body.value):request.kind==='offeringCommand'?seedOfferingCommand(body.value):request.kind==='blockCommand'?seedBlockCommand(body.value):request.kind==='signingCommand'?seedSigningCommand(body.value):request.kind==='visionCommand'?seedVisionCommand(body.value):seedLinkCommand(body.value);
        if(!command){send(400,{error:'invalid_command'});return;}
        send(200,request.kind==='eventCommand'?await database.eventCommand(uid,command,options.nodeDomain):request.kind==='alignmentCommand'?await database.alignmentCommand(uid,command,options.nodeDomain):request.kind==='offeringCommand'?(command.action==='create'?await database.createOffering(uid,command,options.nodeDomain):command.action==='accept'?await database.acceptOffering(uid,command.id):await database.offeringLifecycle(uid,command)):request.kind==='blockCommand'?await database.blockCommand(uid,command,options.nodeDomain):request.kind==='signingCommand'?await database.signingCommand(uid,command):request.kind==='visionCommand'?await database.visionCommand(uid,command,options.nodeDomain):await database.linkCommand(uid,command));
      }
      else if(request.kind==='being'){const result=await database.being(request,uid);send(result.being===null?404:200,result);}
      else if(request.kind==='alignments'){const result=await database.alignments(request,uid);send(request.id!==null && result.alignment===null?404:200,result);}
      else if(request.kind==='pulses'){const result=await database.pulses(request,uid);send(request.id!==null && result.pulse===null?404:200,result);}
      else if(request.kind==='recoveryWitnesses')send(200,await database.recoveryWitnesses(uid,request));
      else if(request.kind==='recoveryContext')send(200,await database.recoveryContext(uid));
      else if(request.kind==='recoveryProposal'){const result=await database.recoveryProposal(uid,request.id,request.event);send(result.proposal===null?404:200,result);}
      else if(request.kind==='signingHistory')send(200,await database.signingHistory(request));
      else if(request.kind==='signingIdentity')send(200,await database.signingIdentity(request.id));
      else if (request.kind === 'communities') {
        const result = await database.communities(request, uid);
        send(request.id !== null && result.community === null ? 404 : 200, result);
      }
      else if(request.kind === 'mediaRead') {
        if(!options.media){send(503,{error:'media_unavailable'});return;}
        const manifest=await database.mediaGet(request.path);
        if(!manifest){send(404,{error:'media_missing'});return;}
        const descriptor=manifest[request.variant],bytes=await options.media.read(descriptor);
        res.setHeader('Content-Type',descriptor.type);res.setHeader('Content-Length',bytes.length);
        res.setHeader('Cache-Control','public, max-age=31536000, immutable');res.setHeader('ETag','"'+descriptor.hash+'"');
        res.setHeader('Content-Security-Policy',"default-src 'none'; sandbox");res.writeHead(200);res.end(bytes);
      }
      else if(request.kind === 'mediaUpload') {
        res.setHeader('Connection','close');
        if(!options.media){send(503,{error:'media_unavailable'});return;}
        const path=seedMediaUploadPath(req.headers['x-lightseed-media-path']);
        const type=req.headers['content-type'];
        const extension={ 'image/jpeg':/\.jpe?g$/, 'image/png':/\.png$/, 'image/webp':/\.webp$/ }[type];
        if(!path || !extension || !extension.test(path)){send(400,{error:'invalid_media'});return;}
        if(!await database.mediaAllowed(uid,path)){send(403,{error:'forbidden'});return;}
        if(await database.mediaGet(path)){send(409,{error:'media_exists'});return;}
        const body=await readBody(req,SEED_MEDIA_MAX_BYTES,false);
        if(body.error){send(body.status,{error:body.error});return;}
        const manifest=await options.media.encode(body.value,type);
        await database.mediaPublish(uid,path,manifest);
        const url='/v1/media?path='+encodeURIComponent(path);
        send(201,{path,url,variants:{small:url+'&variant=small',large:url+'&variant=large'}});
      }
      else if(request.kind === 'people') {
        const result=await database.people(request);send(request.id!==null && result.person===null ? 404 : 200,result);
      }
      else if (request.kind === 'treeInvites') {
        const result=await database.treeInvites(request,uid);
        send(request.id !== null && result.invite === null ? 404 : 200,result);
      }
      else if (request.kind === 'keeperInvites') send(200, await database.keeperInvites(request, uid));
      else if (request.kind === 'trees') {
        const result = await database.trees(request, uid);
        send(request.id !== null && result.tree === null ? 404 : 200, result);
      }
      else if(request.kind==='visions') {
        const result=await database.visions(request,uid);send(request.id!==null && result.vision===null?404:200,result);
      }
      else if (request.kind === 'invites') {
        const result = await database.invites(request, uid);
        send(request.id !== null && result.invite === null ? 404 : 200, result);
      }
      else if (request.kind === 'profile') send(200, await database.profile(uid));
      else if (request.kind === 'saveProfile' || ['communityCommand', 'inviteCommand', 'treeCommand', 'treeInviteCommand'].includes(request.kind)) {
        if (!/^application\/json(?:;\s*charset=utf-8)?$/i.test(req.headers['content-type'] ?? '')) {
          send(415, { error: 'json_required' }); return;
        }
        const body = await readJsonBody(req, request.kind === 'treeCommand' ? 262144 : request.kind === 'treeInviteCommand' ? 8192 : 2048);
        if (body.error) { res.setHeader('Connection', 'close'); send(body.status, { error: body.error }); return; }
        const isTreeInvite = request.kind === 'treeInviteCommand';
        const isTree = request.kind === 'treeCommand';
        const isInvite = request.kind === 'inviteCommand';
        const isCommunity = request.kind === 'communityCommand' || isInvite || isTree || isTreeInvite;
        const input = isTreeInvite ? seedTreeInviteCommand(body.value) : isTree ? seedTreeCommand(body.value) : isInvite ? seedInviteCommand(body.value) : isCommunity ? seedCommunityCommand(body.value) : seedProfileInput(body.value);
        if (!input) { send(400, { error: isCommunity ? 'invalid_command' : 'invalid_profile' }); return; }
        try { send(200, isTreeInvite ? await database.treeInviteCommand(uid,input) : isTree ? await database.treeCommand(uid, input, options.nodeDomain) : isInvite ? await database.inviteCommand(uid, input) : isCommunity ? await database.communityCommand(uid, input, options.nodeDomain) : await database.profile(uid, input)); }
        catch (error) {
          if (isCommunity && ['42501', 'LS001', 'LS002', 'LS003', 'LS004', 'LS005', 'LS006', 'LS007', 'LS008', 'LS009', 'LS011', 'LS012', 'LS013', 'LS014', 'LS015', 'LS016', 'LS017', 'LS018', 'LS019', 'LS020', 'LS021', 'LS022', 'LS023', '22023'].includes(error.code)) {
            const errors = { '42501': [403, 'forbidden'], LS001: [409, 'profile_required'], LS002: [409, 'node_full'],
              LS003: [404, 'community_missing'], LS004: [409, 'keeper_must_resign'], LS005: [403, 'door_refused'],
              LS006: [409, 'request_missing'], LS007: [404, 'invite_missing'], LS008: [409, 'invite_revoked'], LS009: [409, 'invite_expired'], LS011: [409, 'last_keeper'], LS012: [409, 'identity_needs_review'], LS013: [409, 'membership_required'], LS014: [404, 'tree_missing'], LS015: [409, 'tree_limit'], LS016: [409, 'already_keeper'], LS017: [409, 'rooted_tree_required'], LS018: [409, 'invite_closed'], LS019: [409, 'secret_keepers_only'], LS020: [409, 'role_already_held'], LS021: [409, 'living_tree_required'], LS022: [409, 'not_circle'], LS023: [409, 'already_formed'], '22023': [400, 'invalid_command'] };
            const [status, message] = errors[error.code]; send(status, { error: message });
          } else if (['23514', '23505'].includes(error.code)) send(409, { error: 'identity_needs_review' });
          else if(error.code==='LS001')send(409,{error:'profile_required'});
          else if(error.code==='22023')send(400,{error:'invalid_profile'});
          else throw error;
        }
      }
      else if (request.kind === 'secretLinks') send(200, await database.links({ ...request, direction: 'from', id: uid }, uid));
      else if (request.kind === 'secretCircleLinks') send(200, await database.links({ ...request, kind:'secretLinks' }, uid));
      else if (request.kind === 'health') send(200, { status: 'alive' });
      else if (request.kind === 'ready') {
        await database.ready();
        send(200, { status: 'ready' });
      } else send(200, await database.links(request));
    } catch (error) {
      if(error.code==='OFFERING_REJECTED' && ['not-found','failed-precondition','permission-denied'].includes(error.refusal)) {
        send(error.refusal==='not-found'?404:error.refusal==='permission-denied'?403:409,{error:'offering_unavailable'});return;
      }
      if(error.code==='LID_AMBIGUOUS'){send(409,{error:'identity_needs_review'});return;}
      if(error.code==='LS039'){send(409,{error:'event_circle_unavailable'});return;}
      if(error.code==='LS038'){send(404,{error:'event_unavailable'});return;}
      if(error.code==='EVENT_REJECTED'){send(error.refusal==='event_circle_not_event'?404:['event_duplicate_not_hand','event_circle_not_hand'].includes(error.refusal)?403:409,{error:'event_unavailable'});return;}
      if(error.code==='LS036'){send(404,{error:'alignment_unavailable'});return;}
      if(error.code==='LS037'||error.code==='ALIGNMENT_REJECTED'){send(409,{error:'alignment_unavailable'});return;}
      if(error.code==='LS034'){send(404,{error:'offering_unavailable'});return;}
      if(error.code==='LS035'){send(409,{error:'offering_unavailable'});return;}
      if(error.code==='BLOCK_REJECTED' && blockRefusalStatus(error.refusal)){send(blockRefusalStatus(error.refusal),{error:error.refusal});return;}
      if(error.code==='LS032'){send(409,{error:'block_head_moved'});return;}
      if(error.code==='LS033'){send(404,{error:'block_no_bearer'});return;}
      if(error.code==='22023'){send(400,{error:'invalid_command'});return;}
      if(error.code==='LS030'){send(409,{error:'recovery_quorum_required'});return;}
      if(error.code==='LS029'){send(409,{error:'recovery_not_open'});return;}
      if(error.code==='LS028'){send(409,{error:'recovery_already_exists'});return;}
      if(error.code==='LS027'){send(409,{error:'rotation_already_exists'});return;}
      if(error.code==='LS026'){send(409,{error:'signing_identity_needs_review'});return;}
      if(error.code==='LS001'){send(409,{error:'profile_required'});return;}
      if(error.code==='LS025'){send(404,{error:'vision_missing'});return;}
      if(error.code==='LS024'){send(409,{error:'media_exists'});return;}
      if(error.code==='INVALID_IMAGE'){send(400,{error:'invalid_image'});return;}
      if(error.code==='MEDIA_BUSY'){send(503,{error:'media_busy'});return;}
      if (error.code === '42501') { send(403, { error: 'forbidden' }); return; }
      // Never serialize SQL, connection details, credentials or private record values.
      send(503, { error: 'database_unavailable' });
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  return server;
}

function readJsonBody(req,limit){return readBody(req,limit,true);}
function readBody(req, limit, json) {
  return new Promise(resolve => {
    let size = 0, finished = false;
    const chunks = [];
    const finish = result => { if (!finished) { finished = true; resolve(result); } };
    req.on('data', chunk => {
      if (finished) return;
      size += chunk.length;
      if (size > limit) { chunks.length = 0; finish({ error: 'body_too_large', status: 413 }); }
      else chunks.push(chunk);
    });
    req.on('end', () => {
      if (finished) return;
      try { finish({ value: json ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : Buffer.concat(chunks) }); }
      catch { finish({ error: 'invalid_json', status: 400 }); }
    });
    req.on('error', () => finish({ error: 'invalid_request', status: 400 }));
    req.on('aborted', () => finish({ error: 'invalid_request', status: 400 }));
  });
}
