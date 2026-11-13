// THE LIGHT REPOSITORY (ring 2026-11-03): the statements of the organs of migration 054 — the witness, the
// appreciation and the spend (facts under locks, then the apply), the light's reset, the unmint, the staff
// roster, the account's departure, and the domain proofs and doors. The laws live in the organs
// (seed/api/organs.mjs); DNS is observed there, outside every transaction.
import {run,perform,repositoryOf} from './statements.mjs';

const context=(c,sql,params)=>c.query(sql,params).then(r=>r.rows[0].context);

export const lightRepository=withSession=>repositoryOf(withSession,{
  witnessContext:(c,pulseId)=>context(c,'SELECT seed.witness_context($1) AS context',[pulseId]),
  applyWitness:(c,pulseId,rays)=>perform(c,'SELECT seed.apply_witness($1,$2::jsonb)',[pulseId,JSON.stringify(rays)]),
  appreciationContext:(c,offeringId)=>context(c,'SELECT seed.appreciation_context($1) AS context',[offeringId]),
  applyAppreciation:(c,offeringId,gift,takes)=>perform(c,'SELECT seed.apply_appreciation($1,$2::jsonb,$3::jsonb)',[offeringId,JSON.stringify(gift),JSON.stringify(takes)]),
  spendContext:(c,decisionId)=>context(c,'SELECT seed.spend_context($1) AS context',[decisionId]),
  applySpend:(c,decisionId,spend)=>perform(c,'SELECT seed.apply_spend($1,$2::jsonb)',[decisionId,JSON.stringify(spend)]),
  reset:c=>run(c,'SELECT seed.reset_light() AS result'),
  unmintContext:(c,pulseId)=>context(c,'SELECT seed.unmint_context($1) AS context',[pulseId]),
  applyUnmint:(c,pulseId,lifted,cleared)=>run(c,'SELECT seed.apply_unmint($1,$2::jsonb,$3::text[]) AS result',[pulseId,JSON.stringify(lifted),cleared]),
  staff:(c,command)=>run(c,'SELECT seed.staff_command($1::jsonb) AS result',[JSON.stringify(command)]),
  deleteAccount:(c,target,heir)=>run(c,'SELECT seed.delete_account($1,$2) AS result',[target,heir]),
  domainChallenge:(c,communityId,token,ttl)=>run(c,'SELECT seed.domain_challenge($1,$2,$3) AS result',[communityId,token,ttl]),
  domainVerified:(c,communityId,token,ttl)=>run(c,'SELECT seed.domain_verified($1,$2,$3) AS result',[communityId,token,ttl]),
  doorClaims:(c,communityId)=>run(c,'SELECT seed.door_claims($1) AS result',[communityId]),
  doorClaim:(c,communityId,door,kind,token,ttl)=>run(c,'SELECT seed.door_claim($1,$2,$3,$4,$5) AS result',[communityId,door,kind,token,ttl]),
  doorOpen:(c,communityId,door,granted,token,ttl)=>run(c,'SELECT seed.door_open($1,$2,$3,$4,$5) AS result',[communityId,door,granted,token,ttl]),
  doorWithdraw:(c,communityId,door)=>run(c,'SELECT seed.door_withdraw($1,$2) AS result',[communityId,door]),
});
