// THE COMMUNITIES REPOSITORY (ring 2026-11-03): a community and the asking hand's standing at it, the page of
// communities, the founding and the circle's commands (keeper offers and requests, stewardship, the
// community's own command, a circle formed from a tree), its invitations and the stranger's request.
import {run,rows,repositoryOf} from './statements.mjs';

export const communitiesRepository=withSession=>repositoryOf(withSession,{
  one:(c,id)=>rows(c,'SELECT id, doc FROM public.communities WHERE id = $1',[id]).then(r=>r[0]??null),
  access:(c,uid,anchorUid,id,doc)=>rows(c,`SELECT
    ($1::text = $2 OR EXISTS(SELECT 1 FROM public.links WHERE from_id=$1 AND rel='keeper' AND to_id=$3)) AS keeper,
    EXISTS(SELECT 1 FROM public.links WHERE from_id=$1 AND rel='steward' AND to_id=$3) AS steward,
    ($1::text = $2 OR EXISTS(SELECT 1 FROM public.links WHERE from_id=$1 AND rel='member' AND to_id=$3)) AS joined,
    EXISTS(SELECT 1 FROM public.links WHERE from_id=$1 AND rel='join_request' AND to_id=$3) AS requested,
    EXISTS(SELECT 1 FROM public.links WHERE from_id=$1 AND rel='keeper_request' AND to_id=$3) AS "keeperRequested",
    coalesce(seed.can_form_circle($3,$4::jsonb),false) AS "canFormCircle"`,[uid,anchorUid,id,JSON.stringify(doc)]).then(r=>r[0]),
  page:(c,after,limit)=>rows(c,'SELECT id, doc FROM public.communities WHERE ($1::text IS NULL OR id > $1) ORDER BY id LIMIT $2',[after,limit]),
  formCircle:(c,command)=>run(c,'SELECT seed.form_circle($1::jsonb) AS result',[JSON.stringify(command)]),
  keeperOffer:(c,command,lids)=>run(c,'SELECT seed.keeper_offer_command($1::jsonb,$2,$3,$4,$5) AS result',[JSON.stringify(command),...lids]),
  keeperRequest:(c,command,lids)=>run(c,'SELECT seed.keeper_request_command($1::jsonb,$2,$3) AS result',[JSON.stringify(command),...lids]),
  role:(c,command,lid)=>run(c,'SELECT seed.community_role_command($1::jsonb,$2) AS result',[JSON.stringify(command),lid]),
  command:(c,command,lid,nodeDomain)=>run(c,'SELECT seed.community_command($1::jsonb,$2,$3) AS result',[JSON.stringify(command),lid,nodeDomain]),
  invites:(c,id,community,after,limit)=>run(c,'SELECT seed.community_invites($1,$2,$3,$4) AS result',[id,community,after,limit]),
  inviteCommand:(c,command,token,lids)=>run(c,'SELECT seed.invite_command($1::jsonb,$2,$3,$4,$5) AS result',[JSON.stringify(command),token,...lids]),
});
