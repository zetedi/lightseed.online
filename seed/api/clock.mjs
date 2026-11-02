// THE CLOCK (ring 2026-11-03): the independent node's own rhythm — the API's half of the origin's
// scheduled hands. Every tick the clock takes the due jobs from the ledger (seed.clock, leased so
// one run alone holds a job), runs each on the facts the soil's doors read and the law judges, and
// settles the next due moment in the installation's zone (domain/clock). THE THIRST (the origin's
// checkWateringSchedules): every scheduled tree past its due moment is marked overdue and, once a
// day, asks its circle — rewriting its standing ask or raising a new one, the outbox carrying it
// to the courier where the mail organ is grown. THE LEAVES (mintStayLeaves): every completed stay
// becomes a leaf on its bed's chain, sealed here with the canonical hash and applied under the
// bed's lock. Nothing here is reachable by a request; nothing here reads a clock but `now`.
import {randomBytes,randomUUID} from 'node:crypto';
import {uuidv7} from '../../src/domain/uuidv7.mjs';
import {CLOCK_JOBS,CLOCK_LEASE_MS,nextClockDueMs,localDateOf,judgeThirst,stayLeafIsDue,bedHeadOf,stayLeafRecordOf,
  computeCanonicalHash,BLOCK_HASH_VERSION} from '../generated/chain.mjs';

const run=(c,sql,params)=>c.query(sql,params).then(r=>r.rows[0].result);
const docId=()=>randomBytes(10).toString('hex');

/** @param {{withSession: (uid: string | null, work: (c: *) => Promise<*>) => Promise<*>, timeZone: string, notify?: boolean,
 *   log?: {warn: (...args: *[]) => void}, now?: () => number, leaseMs?: number}} options */
export function createClock({withSession,timeZone,notify=false,log=console,now=Date.now,leaseMs=CLOCK_LEASE_MS}) {
  // THE THIRST: the morning sweep over every scheduled tree.
  async function thirst(moment) {
    const trees=await withSession(null,c=>run(c,'SELECT seed.thirst_trees() AS result',[]));
    const report={trees:trees.length,overdue:0,asked:0,rewritten:0,failed:0};
    for(const tree of trees) {
      try {
        const judgment=judgeThirst(tree,moment);
        if(!judgment)continue;
        if(judgment.overdue)report.overdue++;
        const ask=judgment.ask?{...judgment.ask.content,id:docId(),lid:uuidv7(moment,randomBytes(10)),hash:randomUUID()}:null;
        const result=await withSession(null,c=>run(c,'SELECT seed.thirst_apply($1,$2::jsonb,$3,$4::jsonb,$5) AS result',
          [tree.id,JSON.stringify(judgment.patch),judgment.ask?.standingPulseId??null,ask?JSON.stringify(ask):null,notify]));
        if(result?.rewritten)report.rewritten++;
        else if(result?.raised)report.asked++;
      } catch(error) {report.failed++;log.warn('thirst check failed for tree',tree.id,error instanceof Error?error.message:'unknown');}
    }
    return report;
  }

  // THE LEAVES: every completed stay sealed onto its bed's chain.
  async function leaves(moment) {
    const today=localDateOf(moment,timeZone);
    const due=await withSession(null,c=>run(c,'SELECT seed.stay_leaves_due($1) AS result',[today]));
    const report={today,due:due.length,leafed:0,skipped:0,failed:0};
    for(const item of due) {
      try {
        if(!item?.stay || !item?.bed || !stayLeafIsDue(item.stay,today)){report.skipped++;continue;}
        const previousHash=bedHeadOf(item.bed),mintedAt=now();
        const record=stayLeafRecordOf({stayId:item.id,stay:item.stay,id:docId(),lid:uuidv7(mintedAt,randomBytes(10)),mintedAt,previousHash});
        const hash=await computeCanonicalHash(previousHash,mintedAt,record);
        const result=await withSession(null,c=>run(c,'SELECT seed.stay_leaf_apply($1,$2::jsonb) AS result',[item.id,JSON.stringify({...record,hash,hashVersion:BLOCK_HASH_VERSION})]));
        if(result)report.leafed++;else report.skipped++;
      } catch(error) {
        report.failed++;
        log.warn('stay leaf failed for stay',item?.id,error?.code==='LS032'?'the bed\'s head moved; sealed anew next tick':(error instanceof Error?error.message:'unknown'));
      }
    }
    return report;
  }

  const jobs={thirst,leaves};
  let busy=false,timer=null;
  // One tick: the due jobs, each run and settled; what ran is returned (null while a tick is still under way).
  async function tick() {
    if(busy)return null;
    busy=true;
    const ran=[];
    try {
      const moment=now();
      const due=await withSession(null,c=>run(c,'SELECT seed.clock_take($1,$2) AS result',[new Date(moment).toISOString(),leaseMs]));
      for(const {job} of due) {
        if(!Object.hasOwn(jobs,job))continue;
        let outcome='done',report=null;
        try {report=await jobs[job](moment);}
        catch(error) {outcome='failed';report={error:error instanceof Error?error.message:'unknown'};log.warn(`clock job ${job} failed:`,report.error);}
        const nextDueAt=nextClockDueMs(CLOCK_JOBS[job].hour,timeZone,moment);
        await withSession(null,c=>c.query('SELECT seed.clock_settle($1,$2,$3,$4::jsonb)',[job,new Date(nextDueAt).toISOString(),outcome,JSON.stringify(report)]))
          .catch(error=>log.warn(`clock job ${job} could not be settled:`,error instanceof Error?error.message:'unknown'));
        ran.push({job,outcome,report,nextDueAt});
      }
    } finally {busy=false;}
    return ran;
  }
  return {
    timeZone,
    tick,
    start(intervalMs=60000) {if(timer)return;timer=setInterval(()=>{tick().catch(error=>log.warn('clock tick failed:',error instanceof Error?error.message:'unknown'));},intervalMs);timer.unref();},
    stop() {if(timer){clearInterval(timer);timer=null;}},
  };
}
