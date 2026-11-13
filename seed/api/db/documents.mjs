// THE DOCUMENTS REPOSITORY (ring 2026-11-03): the document door (migrations 050–053 — one document under the
// `get` law, a page under the row policies, a write as a claim the law judges, love as its own gesture), the
// graph's edges (links and the secret seats, a page by one direction) and the keeper invitations.
import {run,rows,repositoryOf} from './statements.mjs';

export const documentsRepository=withSession=>repositoryOf(withSession,{
  get:(c,collection,parent,id)=>run(c,'SELECT seed.doc_get($1,$2,$3) AS result',[collection,parent,id]),
  list:(c,collection,parent,equals,contains,within,newest,after,limit)=>run(c,'SELECT seed.doc_list($1,$2,$3::jsonb,$4::jsonb,$5::jsonb,$6,$7::jsonb,$8) AS result',
    [collection,parent,JSON.stringify(equals),JSON.stringify(contains),JSON.stringify(within),newest,after===null?null:JSON.stringify(after),limit]),
  write:(c,command,token)=>run(c,'SELECT seed.doc_write($1::jsonb,$2) AS result',[JSON.stringify(command),token]),
  love:(c,kind,id)=>run(c,'SELECT seed.love_toggle($1,$2) AS result',[kind,id]),
  participation:(c,command,lid)=>run(c,'SELECT seed.participation_command($1::jsonb,$2) AS result',[JSON.stringify(command),lid]),
  garden:(c,command,lid)=>run(c,'SELECT seed.garden_command($1::jsonb,$2) AS result',[JSON.stringify(command),lid]),
  attestation:(c,command,lid)=>run(c,'SELECT seed.community_attestation($1::jsonb,$2) AS result',[JSON.stringify(command),lid]),
  link:(c,command,lid)=>run(c,'SELECT seed.link_command($1::jsonb,$2) AS result',[JSON.stringify(command),lid]),
  keepsSecretTree:(c,id)=>c.query('SELECT seed.keeps_secret_tree($1) AS allowed',[id]).then(r=>r.rows[0].allowed===true),
  // Direction and table are closed internal enums; every user-supplied value is a parameter.
  linksPage:(c,privateSeats,direction,id,rel,after,limit)=>{
    const field=direction==='from'?'from_id':direction==='to'?'to_id':'rel';
    return rows(c,`SELECT id, from_id, rel, to_id, lid, doc, created_at
      FROM public.${privateSeats?'secret_links':'links'} WHERE ${field} = $1 AND ($2::text IS NULL OR rel = $2)
      AND ($3::text IS NULL OR id > $3) ORDER BY id LIMIT $4`,[id,rel,after,limit]);
  },
  keeperInvitesPage:(c,community,invitedUserId,after,limit)=>rows(c,`SELECT id,doc FROM public.community_keeper_invites WHERE doc->>'status'='pending'
    AND ($1::text IS NULL OR doc->>'communityId'=$1)
    AND ($2::text IS NULL OR doc->>'invitedUserId'=$2)
    AND ($3::text IS NULL OR id>$3) ORDER BY id LIMIT $4`,[community,invitedUserId,after,limit]),
});
