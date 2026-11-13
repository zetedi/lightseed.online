// THE ALIGNMENTS REPOSITORY (ring 2026-11-03): one alignment, the participant-private page, the proposal and
// the notes (migration 044), and the paired acceptance (045: the facts, then the twin blocks).
import {run,rows,repositoryOf} from './statements.mjs';

export const alignmentsRepository=withSession=>repositoryOf(withSession,{
  one:(c,id)=>rows(c,'SELECT id,doc FROM public.alignments WHERE id=$1',[id]).then(r=>r[0]??null),
  page:(c,{tree,participant,target,status,afterMoment,afterId,limit})=>rows(c,`SELECT id,doc,to_char(seed.vision_moment(doc) AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS moment
    FROM public.alignments WHERE ($1::text IS NULL OR doc->>'initiatorTreeId'=$1 OR doc->>'targetTreeId'=$1)
    AND (NOT $2::boolean OR doc->>'initiatorUid'=seed.uid() OR doc->>'targetUid'=seed.uid())
    AND (NOT $3::boolean OR doc->>'targetUid'=seed.uid()) AND ($4::text IS NULL OR doc->>'status'=$4)
    AND ($5::timestamptz IS NULL OR (seed.vision_moment(doc),id COLLATE "C")<($5::timestamptz,$6::text COLLATE "C"))
    ORDER BY seed.vision_moment(doc) DESC,id COLLATE "C" DESC LIMIT $7`,
  [tree,participant,target,status,afterMoment,afterId,limit]),
  command:(c,command,id,lid)=>run(c,'SELECT seed.alignment_command($1::jsonb,$2,$3) AS result',[JSON.stringify(command),id,lid]),
  context:(c,id)=>c.query('SELECT seed.alignment_context($1) AS context',[id]).then(r=>r.rows[0].context),
  applyAcceptance:(c,id,fromRecord,toRecord,fromHeight,toHeight)=>run(c,'SELECT seed.apply_alignment_acceptance($1,$2::jsonb,$3::jsonb,$4,$5) AS result',
    [id,JSON.stringify(fromRecord),JSON.stringify(toRecord),fromHeight,toHeight]),
});
