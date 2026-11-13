// THE CLOCK REPOSITORY (ring 2026-11-03): the statements of the clock (migration 058) — the scheduled trees and
// the thirst's apply, the stays due to become leaves and a leaf's apply under the bed's lock, and the ledger's
// take and settle. The judgments are the clock's (seed/api/clock.mjs).
import {run,perform,repositoryOf} from './statements.mjs';

export const clockRepository=withSession=>repositoryOf(withSession,{
  thirstTrees:c=>run(c,'SELECT seed.thirst_trees() AS result'),
  thirstApply:(c,treeId,patch,standingPulseId,ask,notify)=>run(c,'SELECT seed.thirst_apply($1,$2::jsonb,$3,$4::jsonb,$5) AS result',
    [treeId,JSON.stringify(patch),standingPulseId,ask?JSON.stringify(ask):null,notify]),
  leavesDue:(c,today)=>run(c,'SELECT seed.stay_leaves_due($1) AS result',[today]),
  leafApply:(c,stayId,record)=>run(c,'SELECT seed.stay_leaf_apply($1,$2::jsonb) AS result',[stayId,JSON.stringify(record)]),
  take:(c,momentIso,leaseMs)=>run(c,'SELECT seed.clock_take($1,$2) AS result',[momentIso,leaseMs]),
  settle:(c,job,nextDueIso,outcome,report)=>perform(c,'SELECT seed.clock_settle($1,$2,$3,$4::jsonb)',[job,nextDueIso,outcome,JSON.stringify(report)]),
});
