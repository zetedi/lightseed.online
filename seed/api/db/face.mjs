// THE FACE REPOSITORY (ring 2026-11-03): the statements of the face (migration 059) — the public being a door
// names as a stranger reads it, the place a domain names, the explicitly public beings of the sitemap, and the
// face feed. Every read is the runtime role under the row policies with no session.
import {rows,repositoryOf} from './statements.mjs';

export const faceRepository=withSession=>repositoryOf(withSession,{
  publicBeing:(c,lid)=>rows(c,`
    SELECT * FROM (
      SELECT 1 AS rank, 'tree' AS kind, doc FROM public.lifetrees WHERE doc->>'lid'=$1 AND length(doc->>'lid')=36
      UNION ALL SELECT 2, 'house', doc FROM public.light_houses WHERE doc->>'lid'=$1 AND length(doc->>'lid')=36
      UNION ALL SELECT 3, 'vision', doc FROM public.visions WHERE doc->>'lid'=$1 AND length(doc->>'lid')=36
      UNION ALL SELECT 4, 'pulse', doc FROM public.pulses WHERE doc->>'lid'=$1 AND length(doc->>'lid')=36) found
    ORDER BY rank LIMIT 1`,[lid]).then(r=>r[0]??null),
  place:(c,domain)=>c.query('SELECT seed.mail_place($1) AS place',[domain]).then(r=>r.rows[0].place),
  // THE FRONT DOOR (ring 2026-11-03): the community whose domain or alias is the host, whole, as a stranger reads it.
  placeAt:(c,host)=>rows(c,`SELECT id, doc FROM public.communities WHERE doc->>'domain'=$1
    OR (jsonb_typeof(doc->'domainAliases')='array' AND doc->'domainAliases' @> to_jsonb($1::text))
    ORDER BY seed.vision_moment(doc), id LIMIT 1`,[host]).then(r=>r[0]??null),
  // Only an explicit 'public' is listed — the sitemap is an invitation, not the gate.
  sitemapRows:c=>rows(c,`
    SELECT doc->>'lid' AS lid, doc->'updatedAt' AS updated, doc->'createdAt' AS created FROM public.lifetrees WHERE doc->>'visibility'='public' AND length(doc->>'lid')=36
    UNION ALL SELECT doc->>'lid', doc->'updatedAt', doc->'createdAt' FROM public.light_houses WHERE doc->>'visibility'='public' AND length(doc->>'lid')=36
    UNION ALL SELECT doc->>'lid', doc->'updatedAt', doc->'createdAt' FROM public.visions WHERE doc->>'visibility'='public' AND length(doc->>'lid')=36`),
  events:(c,domain)=>c.query('SELECT seed.face_events($1) AS feed',[domain]).then(r=>r.rows[0].feed),
});
