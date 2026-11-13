// THE OFFERINGS REPOSITORY (ring 2026-11-03): the lifecycle (migration 043), the atomic birth (042: facts, then
// the record and its proof and notice applied together) and the paired acceptance (facts, then the twin blocks).
import {run,repositoryOf} from './statements.mjs';

export const offeringsRepository=withSession=>repositoryOf(withSession,{
  lifecycle:(c,command)=>run(c,'SELECT seed.offering_lifecycle($1::jsonb) AS result',[JSON.stringify(command)]),
  birthContext:(c,command)=>c.query('SELECT seed.offering_birth_context($1::jsonb) AS context',[JSON.stringify(command)]).then(r=>r.rows[0].context),
  applyBirth:(c,command,record,birthProof,notice)=>run(c,'SELECT seed.apply_offering_birth($1::jsonb,$2::jsonb,$3::jsonb,$4::jsonb) AS result',
    [JSON.stringify(command),JSON.stringify(record),JSON.stringify(birthProof),JSON.stringify(notice)]),
  context:(c,id)=>c.query('SELECT seed.offering_context($1) AS context',[id]).then(r=>r.rows[0].context),
  applyAcceptance:(c,id,fromRecord,toRecord,fromHeight,toHeight)=>run(c,'SELECT seed.apply_offering_acceptance($1,$2::jsonb,$3::jsonb,$4,$5) AS result',
    [id,JSON.stringify(fromRecord),JSON.stringify(toRecord),fromHeight,toHeight]),
});
