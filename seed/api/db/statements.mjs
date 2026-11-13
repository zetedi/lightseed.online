// THE STATEMENTS (ring 2026-11-03): the one shape every repository of the API is built from. A
// repository is a closed set of statements — each `(client, ...args)` speaking ONE `SELECT seed.<x>(…)`
// or one fixed query to the soil — and the layers' seam: a service never holds a statement, a
// repository never holds a law. From the statements come two doors: each statement as a ONE-SHOT
// `(uid, ...args)` in a session of its own, and `session(uid, body)` handing the body every statement
// bound to ONE transaction as the hand, so the organ pattern of migration 044 — facts under locks,
// the law between, the apply — stays whole across the seam.
export const run=(c,sql,params=[])=>c.query(sql,params).then(r=>r.rows[0].result);
export const rows=(c,sql,params=[])=>c.query(sql,params).then(r=>r.rows);
export const perform=(c,sql,params=[])=>c.query(sql,params).then(()=>undefined);

/** @template {Record<string, (c: *, ...args: any[]) => Promise<any>>} S
 * @param {(uid: string | null, work: (c: *) => Promise<*>) => Promise<*>} withSession @param {S} statements */
export const repositoryOf=(withSession,statements)=>{
  const bound=c=>Object.fromEntries(Object.entries(statements).map(([name,statement])=>[name,(...args)=>statement(c,...args)]));
  const repository={
    /** Every statement bound to one transaction as the hand. */
    session:(uid,body)=>withSession(uid,c=>body(bound(c))),
    withSession,
  };
  for(const [name,statement] of Object.entries(statements))repository[name]=(uid,...args)=>withSession(uid,c=>statement(c,...args));
  return repository;
};
