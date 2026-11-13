// THE IDENTITY REPOSITORY (ring 2026-11-03): the login's binding to a local uid (migration 008), the reviewed
// bindings written at boot (062), and the address a verified login carries (056) — never matched as identity.
import {run,perform,repositoryOf} from './statements.mjs';

export const identityRepository=withSession=>repositoryOf(withSession,{
  // The uid a verified issuer subject answers to — or a fresh candidate when enrollment is open.
  resolve:(c,issuer,subject,explicitUid,open,candidate)=>c.query('SELECT seed.resolve_identity($1,$2,$3,$4,$5) AS uid',[issuer,subject,explicitUid,open,candidate]).then(r=>r.rows[0].uid),
  bindExplicit:(c,issuer,bindings)=>run(c,'SELECT seed.bind_explicit($1,$2::jsonb) AS result',[issuer,JSON.stringify(bindings)]),
  recordEmail:(c,uid,email)=>perform(c,'SELECT seed.record_login_email($1,$2)',[uid,email]),
});
