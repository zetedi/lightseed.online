// THE AI REPOSITORY (ring 2026-11-03): the statements of the AI organ (migration 057) — a kept credential
// removed, saved sealed, or taken for one call; the member-benefit gate; the day's quota. The cipher and the
// rails are the organ's.
import {run,repositoryOf} from './statements.mjs';

export const aiRepository=withSession=>repositoryOf(withSession,{
  remove:(c,scope,holderId,provider,intelligenceId)=>run(c,'SELECT seed.credential_remove($1,$2,$3,$4) AS result',[scope,holderId,provider,intelligenceId]),
  save:(c,scope,holderId,provider,ciphertext,keyId,hint,intelligenceId)=>run(c,'SELECT seed.credential_save($1,$2,$3,$4,$5,$6,$7) AS result',
    [scope,holderId,provider,ciphertext,keyId,hint,intelligenceId]),
  take:(c,scope,holderId,provider)=>run(c,'SELECT seed.credential_take($1,$2,$3) AS result',[scope,holderId,provider]),
  gate:c=>run(c,'SELECT seed.ai_gate() AS result'),
  quota:(c,counter,limit)=>run(c,'SELECT seed.ai_quota($1,$2) AS result',[counter,limit]),
});
