// THE REPAIRS REPOSITORY (ring 2026-11-03): every statement the keeper's audits and repairs speak to
// the soil (seed/schema/061), and nothing else — in the API's layers (seed/README "The layers of
// the API") a repository owns the statements and the session; the service (seed/api/repairs.mjs)
// owns the law between the facts and the apply. Each call is one session as the hand: the soil
// judges the keeper (seed.repair_gate) on every statement.
const run=(c,sql,params)=>c.query(sql,params).then(r=>r.rows[0].result);

/** @typedef {(uid: string | null, work: (c: *) => Promise<*>) => Promise<*>} WithSession */
/** @typedef {ReturnType<typeof repairsRepository>} RepairsRepository */

/** @param {WithSession} withSession */
export const repairsRepository=withSession=>({
  /** @param {string} uid @returns {Promise<{updated: number, skippedSealed: number}>} */
  pulseVisibility:uid=>withSession(uid,c=>run(c,'SELECT seed.repair_pulse_visibility() AS result',[])),
  /** @param {string} uid @returns {Promise<{updated: number, skippedSealed: number}>} */
  pulseTypeCasing:uid=>withSession(uid,c=>run(c,'SELECT seed.repair_pulse_type_casing() AS result',[])),
  /** @param {string} uid @returns {Promise<{updated: number}>} */
  treeVisibility:uid=>withSession(uid,c=>run(c,'SELECT seed.repair_tree_visibility() AS result',[])),
  /** @param {string} uid @returns {Promise<{due: Array<{id: string, createdAt: string | null}>, chained: number}>} */
  visionChainsDue:uid=>withSession(uid,c=>run(c,'SELECT seed.repair_vision_chains_due() AS result',[])),
  /** @param {string} uid @param {string} visionId @param {string} genesisHash @returns {Promise<boolean>} */
  visionChain:(uid,visionId,genesisHash)=>withSession(uid,c=>run(c,'SELECT seed.repair_vision_chain($1,$2) AS result',[visionId,genesisHash])),
  /** @param {string} uid @returns {Promise<{due: Array<{collection: string, id: string, createdAt: string | null}>, skippedSealed: number}>} */
  lidsDue:uid=>withSession(uid,c=>run(c,'SELECT seed.repair_lids_due() AS result',[])),
  /** @param {string} uid @param {string} collection @param {string} id @param {string} lid @returns {Promise<boolean>} */
  lid:(uid,collection,id,lid)=>withSession(uid,c=>run(c,'SELECT seed.repair_lid($1,$2,$3) AS result',[collection,id,lid])),
  /** @param {string} uid @returns {Promise<{due: Array<{id: string, lifetreeId: string | null, createdAt: string | null}>, skippedSealed: number}>} */
  matchIdsDue:uid=>withSession(uid,c=>run(c,'SELECT seed.repair_match_ids_due() AS result',[])),
  /** @param {string} uid @param {string} treeId @returns {Promise<Array<{id: string, status: string | null, createdAt: string | null}>>} */
  alignmentsOfTree:(uid,treeId)=>withSession(uid,c=>run(c,'SELECT seed.repair_alignments_of_tree($1) AS result',[treeId])),
  /** @param {string} uid @param {string} pulseId @param {string} alignmentId @returns {Promise<boolean>} */
  matchId:(uid,pulseId,alignmentId)=>withSession(uid,c=>run(c,'SELECT seed.repair_match_id($1,$2) AS result',[pulseId,alignmentId])),
  /** @param {string} uid @returns {Promise<{nameless: number, twins: Array<{lid: string, addresses: string[]}>}>} */
  lidIndex:uid=>withSession(uid,c=>run(c,'SELECT seed.repair_lid_index() AS result',[])),
});
