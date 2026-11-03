// THE PICTURES REPOSITORY (ring 2026-11-03): every statement the release and the sweep speak to the
// soil, and nothing else — the first repository of the API's layers (seed/README "The layers of the
// API"): HTTP (server.mjs) → services (the organs: orchestration and refusals, no SQL) →
// repositories (seed/api/db/*: every SQL statement, the session and the transaction — PostgreSQL's
// own) → the pure domain. A service asks a repository for FACTS and hands it what the law allowed to
// APPLY; the repository alone decides how the soil is asked. A session here is one transaction as
// the given uid (`seed.uid()`), the organ pattern of migration 044 kept whole: the facts and the
// apply of one release happen inside one session, the law between them is the service's.
const run=(c,sql,params)=>c.query(sql,params).then(r=>r.rows[0].result);

/** @typedef {(uid: string | null, work: (c: *) => Promise<*>) => Promise<*>} WithSession */
/** @typedef {{context: (path: string, holderKind: string, holderId: string) => Promise<*>, release: (path: string, holderKind: string, holderId: string) => Promise<*>}} ReleaseSession */
/** @typedef {ReturnType<typeof picturesRepository>} PicturesRepository */

/** @param {WithSession} withSession */
export const picturesRepository=withSession=>({
  // The release: facts and apply inside ONE session as the hand; the law between them is the caller's.
  /** @template T @param {string} uid @param {(session: ReleaseSession) => Promise<T>} body @returns {Promise<T>} */
  release:(uid,body)=>withSession(uid,c=>body({
    context:(path,holderKind,holderId)=>run(c,'SELECT seed.picture_context($1,$2,$3) AS result',[path,holderKind,holderId]),
    release:(path,holderKind,holderId)=>run(c,'SELECT seed.picture_release($1,$2,$3) AS result',[path,holderKind,holderId]),
  })),
  // One orphan: judged under its hash's lock; when free, the caller takes the file INSIDE the same
  // transaction and the mark is lifted after — 'kept' and 'gone' touch nothing. Returns the verdict.
  /** @param {string} hash @param {() => Promise<void>} take @returns {Promise<'freed' | 'kept' | 'gone'>} */
  sweep:(hash,take)=>withSession(null,async c=>{
    const verdict=await run(c,'SELECT seed.media_orphan_take($1) AS result',[hash]);
    if(verdict!=='free')return verdict;
    await take();
    await c.query('SELECT seed.media_orphan_settle($1)',[hash]);
    return 'freed';
  }),
  // Every orphan standing, oldest first, at most `limit`.
  /** @param {number} limit @returns {Promise<string[]>} */
  due:limit=>withSession(null,c=>run(c,'SELECT seed.media_orphans_due($1) AS result',[limit])),
});
