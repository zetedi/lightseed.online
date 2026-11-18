// THE GROUNDING REPOSITORY (ring 2026-11-17): every statement the ground's hands speak to the
// soil (seed/schema/064), and nothing else. A session is one transaction as the given uid: the
// facts and the apply of one act happen inside it, the law between them is the service's
// (seed/api/grounding.mjs).
const run=(c,sql,params)=>c.query(sql,params).then(r=>r.rows[0].result);

/** @typedef {(uid: string | null, work: (c: *) => Promise<*>) => Promise<*>} WithSession */
/** @typedef {ReturnType<typeof groundingRepository>} GroundingRepository */

/** @param {WithSession} withSession */
export const groundingRepository=withSession=>({
  /** @template T @param {string} uid @param {(session: *) => Promise<T>} body @returns {Promise<T>} */
  session:(uid,body)=>withSession(uid,c=>body({
    context:(visionId,treeId)=>run(c,'SELECT seed.ground_context($1,$2) AS result',[visionId,treeId]),
    applyAsk:(visionId,treeId,linkLid)=>run(c,'SELECT seed.apply_ground_ask($1,$2,$3) AS result',[visionId,treeId,linkLid]),
    dropAsk:(visionId,treeId)=>run(c,'SELECT seed.ground_ask_drop($1,$2) AS result',[visionId,treeId]),
    applyGround:(visionId,treeId,treeRecord,visionRecord,treeHeight,visionHeight,linkLid)=>run(c,
      'SELECT seed.apply_ground($1,$2,$3::jsonb,$4::jsonb,$5,$6,$7) AS result',
      [visionId,treeId,JSON.stringify(treeRecord),JSON.stringify(visionRecord),treeHeight,visionHeight,linkLid]),
    // A vision released (migration 071): its grounds' facts, their end, then the release itself (030) — one transaction.
    visionGroundsContext:visionId=>run(c,'SELECT seed.vision_grounds_context($1) AS result',[visionId]),
    applyVisionGroundsEnd:(visionId,records)=>run(c,'SELECT seed.apply_vision_grounds_end($1,$2::jsonb) AS result',[visionId,JSON.stringify(records)]),
    visionRelease:command=>run(c,'SELECT seed.vision_release($1::jsonb) AS result',[JSON.stringify(command)]),
    applyRelease:(visionId,treeId,treeRecord,visionRecord,treeHeight,visionHeight)=>run(c,
      'SELECT seed.apply_ground_release($1,$2,$3::jsonb,$4::jsonb,$5,$6) AS result',
      [visionId,treeId,treeRecord?JSON.stringify(treeRecord):null,visionRecord?JSON.stringify(visionRecord):null,treeHeight,visionHeight]),
  })),
});
