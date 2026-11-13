// THE CHAINS REPOSITORY (ring 2026-11-03): blocks and visions — one by id, the privacy-filtered pages
// (migration 039), the vision's commands, and the block's facts under the head's lock and its apply
// (migration 038; the birth law runs in the service between the two).
import {run,rows,perform,repositoryOf} from './statements.mjs';

export const chainsRepository=withSession=>repositoryOf(withSession,{
  pulse:(c,id)=>rows(c,'SELECT id,doc FROM public.pulses WHERE id=$1',[id]).then(r=>r[0]??null),
  pulsesPage:(c,{tree,vision,community,author,recipient,participant,type,domain,afterMoment,afterId,limit})=>rows(c,`SELECT id,doc,to_char(seed.vision_moment(doc) AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS moment
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
  [tree,vision,community,author,recipient,participant,type,domain,afterMoment,afterId,limit]),
  vision:(c,id)=>rows(c,'SELECT id,doc FROM public.visions WHERE id=$1',[id]).then(r=>r[0]??null),
  visionsPage:(c,{domain,author,tree,joined,afterMoment,afterId,limit})=>rows(c,`SELECT id,doc,to_char(seed.vision_moment(doc) AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS moment
    FROM public.visions WHERE (doc->>'visibility' IN ('public','node') OR (jsonb_typeof(doc->'authorId')='string' AND doc->>'authorId'=seed.uid()) OR seed.is_staff() OR seed.offering_twin_party(id,doc) OR seed.offering_recipient(doc))
    AND ($1::text IS NULL OR doc->>'domain'=$1) AND ($2::text IS NULL OR doc->>'authorId'=$2)
    AND ($3::text IS NULL OR doc->>'lifetreeId'=$3)
    AND ($4::text IS NULL OR EXISTS(SELECT 1 FROM public.links WHERE from_id=$4 AND rel='joined' AND to_id=visions.id))
    AND ($5::timestamptz IS NULL OR (seed.vision_moment(doc),id COLLATE "C")<($5::timestamptz,$6::text COLLATE "C"))
    ORDER BY seed.vision_moment(doc) DESC,id COLLATE "C" DESC LIMIT $7`,
  [domain,author,tree,joined,afterMoment,afterId,limit]),
  visionRelease:(c,command)=>run(c,'SELECT seed.vision_release($1::jsonb) AS result',[JSON.stringify(command)]),
  visionPictures:(c,command)=>run(c,'SELECT seed.vision_pictures($1::jsonb) AS result',[JSON.stringify(command)]),
  visionCommand:(c,command,lid,nodeDomain)=>run(c,'SELECT seed.vision_command($1::jsonb,$2,$3) AS result',[JSON.stringify(command),lid,nodeDomain]),
  blockContext:(c,on,id,watering)=>c.query('SELECT seed.block_context($1,$2,$3) AS context',[on,id,watering]).then(r=>r.rows[0].context),
  applyBlock:(c,on,id,record,patch,height)=>perform(c,'SELECT seed.apply_block($1,$2,$3::jsonb,$4::jsonb,$5)',[on,id,JSON.stringify(record),JSON.stringify(patch),height]),
});
