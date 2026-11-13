// THE BEINGS REPOSITORY (ring 2026-11-03): a true name resolved to the visible records that carry it
// (migration 049), and the people a hand may find — ordinary SELECTs as the non-owner runtime role, so the
// row policies (secret trees, paired records) decide what is seen.
import {run,rows,repositoryOf} from './statements.mjs';

export const beingsRepository=withSession=>repositoryOf(withSession,{
  lookup:(c,lid)=>rows(c,`
    SELECT 'tree' AS kind,id,doc->>'lid' AS lid FROM public.lifetrees WHERE doc->>'lid'=$1 AND length(doc->>'lid')=36
    UNION ALL SELECT 'vision',id,doc->>'lid' FROM public.visions WHERE doc->>'lid'=$1 AND length(doc->>'lid')=36
    UNION ALL SELECT 'community',id,doc->>'lid' FROM public.communities WHERE doc->>'lid'=$1 AND length(doc->>'lid')=36
    UNION ALL SELECT 'pulse',id,doc->>'lid' FROM public.pulses WHERE doc->>'lid'=$1 AND length(doc->>'lid')=36
    UNION ALL SELECT 'person',id,$1 FROM seed.person_lid_candidates($1)
    LIMIT 2`,[lid]),
  people:(c,id,query,after,limit)=>run(c,'SELECT seed.people($1,$2,$3,$4) AS result',[id,query,after,limit]),
});
