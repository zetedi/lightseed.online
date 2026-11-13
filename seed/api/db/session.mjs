// THE SESSION (ring 2026-11-03): PostgreSQL's own — the pool, the guard that refuses an unsafe role, and
// one transaction per hand with `seed.uid` set for the row policies and the soil's functions. Callers
// supply a VERIFIED local identity; never pass request headers or claims straight here. A work
// callback contains database operations only: no external effect may be replayed by the retry.
import pg from 'pg';
import {seedTransactionRetry} from '../../../src/domain/seedTransaction.mjs';

export function createSessions(config) {
  const pool=new pg.Pool({max:10,connectionTimeoutMillis:5000,idleTimeoutMillis:30000,...config});
  pool.on('error',()=>{}); // idle connection failures must not crash the HTTP process
  const abortedTransactions=new WeakSet();
  async function withSession(uid,work) {
    for(let attempt=0;;attempt++) {
      try {return await withSessionOnce(uid,work);}
      catch(error) {if(!seedTransactionRetry({code:error?.code,attempt,aborted:abortedTransactions.has(error)}))throw error;}
    }
  }
  async function withSessionOnce(uid,work) {
    if(uid!==null && (typeof uid!=='string' || !uid.length || uid.length>128 || /[\u0000-\u001f\u007f]/.test(uid)))throw new Error('invalid_session');
    const client=await pool.connect();
    let failed=true,started=false,committed=false;
    try {
      // Refuse dirty connections rather than trust session-wide state from an earlier
      // callback. DISCARD also removes temporary objects and prepared statements.
      await client.query('DISCARD ALL');
      const guard=await client.query(`SELECT
        r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls
        OR EXISTS (SELECT 1 FROM pg_auth_members WHERE member = r.oid)
        OR EXISTS (SELECT 1 FROM pg_database WHERE datname = current_database() AND datdba = r.oid)
        OR has_schema_privilege(current_user, 'public', 'CREATE')
        OR has_schema_privilege(current_user, 'seed', 'CREATE')
        OR EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname IN ('public', 'seed') AND (c.relowner=r.oid
            OR (n.nspname='public' AND c.relkind IN ('r','p') AND NOT c.relrowsecurity))) AS unsafe
        FROM pg_roles r WHERE r.rolname=current_user`);
      if(guard.rows.length!==1 || guard.rows[0].unsafe)throw new Error('unsafe_database_role');
      await client.query('BEGIN');started=true;
      await client.query("SELECT set_config('seed.uid', $1, true)",[uid??'']);
      const result=await work(client);
      await client.query('COMMIT');committed=true;
      await client.query('DISCARD ALL');
      failed=false;
      return result;
    } catch(error) {
      if(started && !committed && ['40001','40P01'].includes(error?.code))abortedTransactions.add(error);
      try {await client.query('ROLLBACK');} catch {/* destroy below */}
      throw error;
    } finally {client.release(failed);}
  }
  return {withSession,close:()=>pool.end()};
}
