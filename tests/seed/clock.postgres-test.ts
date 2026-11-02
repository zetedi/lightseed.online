// THE CLOCK against real PostgreSQL (ring 2026-11-03): the ledger that lets one run alone hold a job and
// settles the next morning; the thirst that marks every scheduled tree past its due moment and asks its
// circle once a day — rewriting its standing ask, raising a new one, leaving the courier's row where the
// mail organ is grown; the leaves that seal every completed stay onto its bed's chain with the canonical
// hash under the bed's lock; and the planting caps' backstop at the insert. The API runs as the restricted
// runtime role; the clock's moment is the test's to move.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startCluster, type Cluster } from './harness';
import { createClock } from '../../seed/api/clock.mjs';
import { computeCanonicalHash } from '../../src/domain/chain/verify';

let cluster: Cluster;
beforeAll(() => { cluster = startCluster(55446); });
afterAll(() => cluster.stop());

type Json = Record<string, any>;
const LID = (n: number) => `019a0000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const DAY = 24 * 3600 * 1000;
const iso = (ms: number) => new Date(ms).toISOString();

const serve = async (options: { notify?: boolean } = {}) => {
  const { db } = await cluster.fresh(3);
  let moment = Date.UTC(2026, 10, 3, 7, 0); // 2026-11-03 08:00 Brussels
  const warnings: string[] = [];
  const clock = createClock({ withSession: db.withSession, timeZone: 'Europe/Brussels', notify: options.notify ?? true, log: { warn: (...a: unknown[]) => { warnings.push(a.map(String).join(' ')); } }, now: () => moment });
  const rows = (q: string): Json[] => JSON.parse(cluster.sql(`SELECT coalesce(json_agg(r),'[]') FROM (${q}) r;`)) as Json[];
  const due = () => cluster.sql(`UPDATE seed.clock SET due_at=now()-interval '1 second', lease_until=NULL;`);
  return { db, clock, rows, sql: cluster.sql, warnings, due, at: (ms: number) => { moment = ms; }, now: () => moment, close: () => db.close() };
};

const people = (sql: (q: string) => string) => sql(`
  INSERT INTO users VALUES ('alice','{"displayName":"Alice","email":"alice@x.y"}'),('bob','{"displayName":"Bob","email":"bob@x.y"}'),('staff','{"displayName":"Staff"}');
  INSERT INTO persons VALUES ('alice','{"uid":"alice","lid":"${LID(1)}","displayName":"Alice"}'),('bob','{"uid":"bob","lid":"${LID(2)}","displayName":"Bob"}'),('staff','{"uid":"staff","lid":"${LID(4)}","displayName":"Staff"}');
  INSERT INTO admins VALUES ('staff','{}');`);

describe('the ledger', () => {
  it('runs both jobs once at birth, settles each at its own hour in the zone, and lets one run alone hold a job', async () => {
    const t = await serve();
    try {
      expect(t.rows(`SELECT job, due_at<=now() AS due, lease_until, ran_at FROM seed.clock ORDER BY job`)).toEqual([
        { job: 'leaves', due: true, lease_until: null, ran_at: null }, { job: 'thirst', due: true, lease_until: null, ran_at: null }]);
      const ran = await t.clock.tick();
      expect(ran?.map(r => [r.job, r.outcome]).sort()).toEqual([['leaves', 'done'], ['thirst', 'done']]);
      expect(t.rows(`SELECT job, to_char(due_at at time zone 'Europe/Brussels','YYYY-MM-DD HH24:MI') AS next, lease_until, ran_at IS NOT NULL AS ran, outcome FROM seed.clock ORDER BY job`)).toEqual([
        { job: 'leaves', next: '2026-11-04 03:00', lease_until: null, ran: true, outcome: 'done' },
        { job: 'thirst', next: '2026-11-04 08:00', lease_until: null, ran: true, outcome: 'done' }]);
      expect(await t.clock.tick()).toEqual([]);
      // A job another process holds is left alone until its lease lapses.
      t.sql(`UPDATE seed.clock SET due_at='${iso(t.now() - 60 * 1000)}', lease_until='${iso(t.now() + 5 * 60 * 1000)}' WHERE job='thirst'`);
      expect(await t.clock.tick()).toEqual([]);
      t.sql(`UPDATE seed.clock SET lease_until='${iso(t.now() - 1000)}' WHERE job='thirst'`);
      expect((await t.clock.tick())?.map(r => r.job)).toEqual(['thirst']);
      // The ledger is the clock's alone: the runtime role reads it through no door.
      await expect(t.db.withSession(null, (c: any) => c.query('SELECT * FROM seed.clock'))).rejects.toMatchObject({ code: '42501' });
      await expect(t.db.withSession('alice', (c: any) => c.query('SELECT seed.clock_take(now(), 100)'))).rejects.toMatchObject({ code: '22023' });
    } finally { await t.close(); }
  });
});

describe('the thirst', () => {
  it('marks the overdue, clears the quenched, asks the circle once a day through the principal, rewrites the standing ask and speaks anew after a watering', async () => {
    const t = await serve();
    try {
      people(t.sql);
      const now = t.now();
      t.sql(`
        INSERT INTO lifetrees VALUES
          ('t1','{"lid":"${LID(11)}","anchorUid":"alice","name":"Nur","imageUrl":"https://m/nur.webp","treeType":"LIGHTTREE","visibility":"public","domain":"node.example","createdAt":"2026-01-01T00:00:00.000000Z","watering":{"mode":"scheduled","stage":"planted","intervalDays":3,"lastWateredAt":"${iso(now - 5 * DAY)}","overdue":false}}'),
          ('t2','{"lid":"${LID(12)}","anchorUid":"alice","name":"Quenched","treeType":"LIGHTTREE","visibility":"public","createdAt":"2026-01-01T00:00:00.000000Z","watering":{"mode":"scheduled","stage":"potted","intervalDays":7,"lastWateredAt":"${iso(now - DAY)}","overdue":true}}'),
          ('t3','{"lid":"${LID(13)}","anchorUid":"bob","name":"Alone","treeType":"LIGHTTREE","visibility":"public","createdAt":"2026-01-01T00:00:00.000000Z","watering":{"mode":"scheduled","stage":"planted","intervalDays":2,"lastWateredAt":"${iso(now - 9 * DAY)}"}}'),
          ('t4','{"lid":"${LID(14)}","anchorUid":"bob","name":"Settled","treeType":"LIGHTTREE","visibility":"public","createdAt":"2026-01-01T00:00:00.000000Z","watering":{"mode":"self_sustaining","stage":"self_sustaining"}}');
        INSERT INTO links(from_id,rel,to_id,lid,created_at) VALUES ('bob','guardian','t1','${LID(61)}','2026-06-01T00:00:00Z');`);
      const ran = await t.clock.tick();
      expect(ran?.find(r => r.job === 'thirst')?.report).toEqual({ trees: 3, overdue: 2, asked: 1, rewritten: 0, failed: 0 });
      // t1: overdue, asked — one reach in the guardians' thread, spoken through alice with Nur's face; the courier's row beside it.
      const asks = t.rows(`SELECT id, doc FROM pulses ORDER BY id`);
      expect(asks).toHaveLength(1);
      const ask = asks[0].doc;
      expect(ask).toMatchObject({ type: 'reach', careAlert: 'watering', lifetreeId: 't1', authorId: 'alice', authorName: 'Nur', authorPhoto: 'https://m/nur.webp', participantUids: ['alice', 'bob'],
        threadId: 'grp__t1__guardians__alice', threadName: 'Nur · Guardians', audience: 'guardians', isGroup: true, visibility: 'private', previousHash: 'WATER_ALERT', domain: 'node.example',
        body: "I'm thirsty 💧 — it's been 2 days past my watering. Could a guardian care me? — Nur", recipientUid: null });
      expect(ask.lid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/); expect(typeof ask.createdAt).toBe('string');
      expect(t.rows(`SELECT kind, ref FROM seed.outbox`)).toEqual([{ kind: 'reach', ref: asks[0].id }]);
      const t1 = () => t.rows(`SELECT doc->'watering' AS w FROM lifetrees WHERE id='t1'`)[0].w;
      expect(t1()).toMatchObject({ overdue: true, alertThreadId: 'grp__t1__guardians__alice', alertPulseId: asks[0].id, lastAlertAt: iso(now), lastWateredAt: iso(now - 5 * DAY) });
      // t2 was quenched: the flag falls. t3 is overdue with no one but its anchor to hear: the flag alone. t4 is untouched.
      expect(t.rows(`SELECT id, doc->'watering'->'overdue' AS overdue, doc->'watering'->'alertPulseId' AS ask FROM lifetrees WHERE id IN ('t2','t3','t4') ORDER BY id`))
        .toEqual([{ id: 't2', overdue: false, ask: null }, { id: 't3', overdue: true, ask: null }, { id: 't4', overdue: null, ask: null }]);
      // The same day again: no second ask.
      t.due();
      expect((await t.clock.tick())?.find(r => r.job === 'thirst')?.report).toMatchObject({ asked: 0, rewritten: 0 });
      expect(t.rows(`SELECT count(*) AS n FROM pulses`)[0].n).toBe(1);
      // The next morning: the standing ask is rewritten — one line that keeps count — and no new row.
      t.at(now + DAY); t.due();
      expect((await t.clock.tick())?.find(r => r.job === 'thirst')?.report).toMatchObject({ asked: 0, rewritten: 1 });
      expect(t.rows(`SELECT count(*) AS n FROM pulses`)[0].n).toBe(1);
      expect(t.rows(`SELECT doc->>'body' AS body FROM pulses`)[0].body).toBe("I'm thirsty 💧 — it's been 3 days past my watering. Could a guardian care me? — Nur");
      expect(t1()).toMatchObject({ lastAlertAt: iso(now + DAY), alertPulseId: asks[0].id });
      expect(t.rows(`SELECT count(*) AS n FROM seed.outbox`)[0].n).toBe(1);
      // A watering answers the ask: the tree rests, overdue falls; thirsty again days later, it speaks anew.
      t.sql(`UPDATE lifetrees SET doc=jsonb_set(doc,'{watering,lastWateredAt}','"${iso(now + DAY + 3600 * 1000)}"') WHERE id='t1'`);
      t.at(now + 2 * DAY); t.due();
      expect((await t.clock.tick())?.find(r => r.job === 'thirst')?.report).toMatchObject({ overdue: 1, asked: 0 });
      expect(t1()).toMatchObject({ overdue: false });
      t.at(now + 6 * DAY); t.due();
      expect((await t.clock.tick())?.find(r => r.job === 'thirst')?.report).toMatchObject({ asked: 1, rewritten: 0 });
      expect(t.rows(`SELECT count(*) AS n FROM pulses WHERE doc->>'careAlert'='watering'`)[0].n).toBe(2);
      expect(t1().alertPulseId).not.toBe(asks[0].id);
      // A standing ask that is gone speaks anew instead of failing.
      t.sql(`DELETE FROM pulses WHERE id='${t1().alertPulseId}'`);
      t.at(now + 7 * DAY); t.due();
      expect((await t.clock.tick())?.find(r => r.job === 'thirst')?.report).toMatchObject({ asked: 1, rewritten: 0, failed: 0 });
      expect(t.warnings).toEqual([]);
    } finally { await t.close(); }
  });
  it('leaves no courier row where the mail organ is not grown', async () => {
    const t = await serve({ notify: false });
    try {
      people(t.sql);
      t.sql(`INSERT INTO lifetrees VALUES ('t1','{"lid":"${LID(11)}","anchorUid":"alice","name":"Nur","treeType":"LIGHTTREE","visibility":"public","createdAt":"2026-01-01T00:00:00.000000Z","watering":{"mode":"scheduled","intervalDays":1,"lastWateredAt":"${iso(t.now() - 3 * DAY)}"}}');
        INSERT INTO secret_links(from_id,rel,to_id,lid) VALUES ('bob','keeper','t1','${LID(62)}');`);
      expect((await t.clock.tick())?.find(r => r.job === 'thirst')?.report).toMatchObject({ asked: 1 });
      expect(t.rows(`SELECT count(*) AS n FROM pulses`)[0].n).toBe(1);
      expect(t.rows(`SELECT count(*) AS n FROM seed.outbox`)[0].n).toBe(0);
    } finally { await t.close(); }
  });
});

describe('the leaves', () => {
  it('seals every completed stay onto its bed\'s chain with the canonical hash, once, and refuses a moved head', async () => {
    const t = await serve();
    try {
      people(t.sql);
      t.sql(`
        INSERT INTO lifetrees VALUES ('b1','{"lid":"${LID(21)}","anchorUid":"alice","name":"The attic bed","treeType":"BED","visibility":"node","domain":"","latitude":50.8,"longitude":4.3,"createdAt":"2026-01-01T00:00:00.000000Z","genesisHash":"g1","latestHash":"g1","blockHeight":0}');
        INSERT INTO stays VALUES
          ('s1','{"lid":"${LID(41)}","uid":"bob","bedId":"b1","hostUid":"alice","fromDate":"2026-10-30","toDate":"2026-11-02","status":"accepted","guestName":"Robert","guestTreeName":"Bobs pine","guestTreeGrowthUrl":"https://m/pine.webp"}'),
          ('s2','{"lid":"${LID(42)}","uid":"bob","bedId":"b1","hostUid":"alice","fromDate":"2026-11-03","toDate":"2026-11-05","status":"accepted"}'),
          ('s3','{"lid":"${LID(43)}","uid":"bob","bedId":"b1","hostUid":"alice","fromDate":"2026-10-01","toDate":"2026-10-02","status":"requested"}'),
          ('s4','{"lid":"${LID(44)}","uid":"bob","bedId":"b1","hostUid":"alice","fromDate":"2026-09-01","toDate":"2026-09-02","status":"accepted","leafed":true}');`);
      const ran = await t.clock.tick();
      expect(ran?.find(r => r.job === 'leaves')?.report).toEqual({ today: '2026-11-03', due: 1, leafed: 1, skipped: 0, failed: 0 });
      const leaves = t.rows(`SELECT id, doc FROM pulses`);
      expect(leaves).toHaveLength(1);
      const { hash, hashVersion, createdAt, ...record } = leaves[0].doc;
      expect(record).toEqual({ lifetreeId: 'b1', type: 'stay', visibility: 'node', title: 'Bobs pine', body: 'stayed 2026-10-30 → 2026-11-02', authorId: 'bob', authorName: 'Bobs pine', imageUrl: 'https://m/pine.webp',
        lid: record.lid, id: leaves[0].id, loveCount: 0, commentCount: 0, mintedAt: t.now(), previousHash: 'g1', stayId: 's1' });
      expect(JSON.stringify(leaves[0].doc)).not.toContain('Robert');
      expect(hashVersion).toBe('lifeseed.block.v1');
      expect(hash).toBe(await computeCanonicalHash('g1', t.now(), record));
      expect(typeof createdAt).toBe('string');
      expect(t.rows(`SELECT doc->>'latestHash' AS head, doc->'blockHeight' AS height FROM lifetrees WHERE id='b1'`)).toEqual([{ head: hash, height: 1 }]);
      expect(t.rows(`SELECT id, doc->'leafed' AS leafed FROM stays ORDER BY id`)).toEqual([{ id: 's1', leafed: true }, { id: 's2', leafed: null }, { id: 's3', leafed: null }, { id: 's4', leafed: true }]);
      // Again: nothing is due; the departure day itself is not yet past.
      t.due();
      expect((await t.clock.tick())?.find(r => r.job === 'leaves')?.report).toMatchObject({ due: 0 });
      // Two nights later s2 has departed: its leaf stands on the new head.
      t.at(Date.UTC(2026, 10, 6, 2, 0)); t.due();
      expect((await t.clock.tick())?.find(r => r.job === 'leaves')?.report).toMatchObject({ today: '2026-11-06', due: 1, leafed: 1 });
      expect(t.rows(`SELECT doc->>'previousHash' AS prev, doc->>'title' AS title FROM pulses WHERE doc->>'stayId'='s2'`)).toEqual([{ prev: hash, title: 'A guest' }]);
      expect(t.rows(`SELECT doc->'blockHeight' AS height FROM lifetrees WHERE id='b1'`)[0].height).toBe(2);
      // A record sealed on a head that moved is refused, and nothing is written.
      t.sql(`INSERT INTO stays VALUES ('s5','{"lid":"${LID(45)}","uid":"bob","bedId":"b1","hostUid":"alice","fromDate":"2026-10-10","toDate":"2026-10-12","status":"accepted"}')`);
      const stale = JSON.stringify({ lifetreeId: 'b1', type: 'stay', visibility: 'node', title: 'A guest', body: 'stayed 2026-10-10 → 2026-10-12', authorId: 'bob', authorName: '', lid: LID(99), id: 'p99', loveCount: 0, commentCount: 0, mintedAt: 1, previousHash: 'g1', stayId: 's5', hash: 'a'.repeat(64), hashVersion: 'lifeseed.block.v1' });
      await expect(t.db.withSession(null, (c: any) => c.query(`SELECT seed.stay_leaf_apply('s5', $1::jsonb)`, [stale]))).rejects.toMatchObject({ code: 'LS032' });
      expect(t.rows(`SELECT count(*) AS n FROM pulses`)[0].n).toBe(2);
      expect(t.rows(`SELECT doc->'leafed' AS leafed FROM stays WHERE id='s5'`)[0].leafed).toBeNull();
      expect(t.warnings).toEqual([]);
    } finally { await t.close(); }
  });
});

describe('the planting caps\' backstop', () => {
  it('refuses a tree over its keeper\'s ceiling at the insert, through any door, while staff and the crossing plant freely', async () => {
    const t = await serve();
    try {
      people(t.sql);
      t.sql(`INSERT INTO config VALUES ('limits','{"maxLifetrees":2}');
        INSERT INTO lifetrees VALUES ('t1','{"lid":"${LID(11)}","anchorUid":"alice","name":"One","treeType":"LIGHTTREE","visibility":"public","createdAt":"2026-01-01T00:00:00.000000Z"}'),
          ('t2','{"lid":"${LID(12)}","anchorUid":"alice","name":"Two","treeType":"LIGHTTREE","visibility":"public","createdAt":"2026-01-01T00:00:00.000000Z"}');`);
      const tree = (n: number, over: Json = {}) => ({ action: 'create', collection: 'lifetrees', data: { lid: LID(n), anchorUid: 'alice', name: `Tree ${n}`, treeType: 'LIGHTTREE', visibility: 'public', domain: 'node.example', genesisHash: 'g', latestHash: 'g', blockHeight: 0, validated: false, validatorId: null, ...over } });
      await expect(t.db.docCommand('alice', tree(13))).rejects.toMatchObject({ code: 'LS015' });
      // A bed is furniture, not forest: its own ceiling, not this one.
      await expect(t.db.docCommand('alice', tree(14, { treeType: 'BED', domain: '', latitude: 50.8, longitude: 4.3, visibility: 'node' }))).resolves.toBeTruthy();
      // Staff plant freely; a row no session wrote (the crossing) is not a planting.
      await expect(t.db.docCommand('staff', tree(15, { anchorUid: 'staff' }))).resolves.toBeTruthy();
      t.sql(`INSERT INTO lifetrees VALUES ('t3','{"lid":"${LID(16)}","anchorUid":"alice","name":"Imported","treeType":"LIGHTTREE","visibility":"public"}')`);
      expect(t.rows(`SELECT count(*) AS n FROM lifetrees WHERE doc->>'anchorUid'='alice' AND doc->>'treeType'='LIGHTTREE'`)[0].n).toBe(3);
      // The secret ceiling stands on its own count.
      t.sql(`INSERT INTO lifetrees SELECT 's'||g, jsonb_build_object('lid','019a0000-0000-7000-8000-'||lpad(g::text,12,'0'),'anchorUid','bob','name','s','treeType','SECRET','visibility','private') FROM generate_series(100,111) g;`);
      await expect(t.db.docCommand('bob', tree(17, { anchorUid: 'bob', treeType: 'SECRET', visibility: 'private', domain: '' }))).rejects.toMatchObject({ code: 'LS015' });
    } finally { await t.close(); }
  });
});
