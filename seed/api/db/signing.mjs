// THE SIGNING REPOSITORY (ring 2026-11-03): a being's public key identity and history (migrations 031–033), the
// recovery's proposals, witnesses and activation (034–036) — the proofs are verified in the service between
// the prepare and the apply.
import {run,repositoryOf} from './statements.mjs';

export const signingRepository=withSession=>repositoryOf(withSession,{
  identity:(c,id)=>run(c,'SELECT seed.signing_identity($1) AS result',[id]),
  history:(c,id,collection,after,limit)=>run(c,'SELECT seed.signing_history($1,$2,$3,$4) AS result',[id,collection,after,limit]),
  recoveryWitnesses:(c,id,event,after,limit)=>run(c,'SELECT seed.recovery_witnesses($1,$2,$3,$4) AS result',[id,event,after,limit]),
  recoveryContext:c=>c.query('SELECT seed.recovery_context() AS context').then(r=>r.rows[0].context),
  recoveryProposal:(c,id,event)=>run(c,'SELECT seed.recovery_proposal($1,$2) AS result',[id,event]),
  prepareActivation:(c,eventId)=>c.query('SELECT seed.prepare_recovery_activation($1) AS prepared',[eventId]).then(r=>r.rows[0].prepared),
  applyActivation:(c,eventId,witnessIds)=>run(c,'SELECT seed.apply_recovery_activation($1,$2::text[]) AS result',[eventId,witnessIds]),
  prepareWitness:(c,command)=>c.query('SELECT seed.prepare_recovery_witness($1::jsonb) AS proposal',[JSON.stringify(command)]).then(r=>r.rows[0].proposal),
  applyWitness:(c,command)=>run(c,'SELECT seed.apply_recovery_witness($1::jsonb) AS result',[JSON.stringify(command)]),
  applyProposal:(c,command)=>run(c,'SELECT seed.apply_recovery_proposal($1::jsonb) AS result',[JSON.stringify(command)]),
  applyRotation:(c,command)=>run(c,'SELECT seed.apply_key_rotation($1::jsonb) AS result',[JSON.stringify(command)]),
  freeze:(c,command)=>run(c,'SELECT seed.signing_freeze($1::jsonb) AS result',[JSON.stringify(command)]),
  anchor:(c,command)=>run(c,'SELECT seed.signing_anchor($1::jsonb) AS result',[JSON.stringify(command)]),
});
