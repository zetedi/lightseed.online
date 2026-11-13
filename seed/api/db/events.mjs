// THE EVENTS REPOSITORY (ring 2026-11-03): an event's circle (migration 048: the facts, then the circle and its
// edges), its creation and editing (047: the draft's facts, then the write), and its duplication (046).
import {run,repositoryOf} from './statements.mjs';

export const eventsRepository=withSession=>repositoryOf(withSession,{
  circleContext:(c,id)=>c.query('SELECT seed.event_circle_context($1) AS context',[id]).then(r=>r.rows[0].context),
  applyCircle:(c,id,prepared,edges)=>run(c,'SELECT seed.apply_event_circle($1,$2::jsonb,$3::jsonb) AS result',[id,JSON.stringify(prepared),JSON.stringify(edges)]),
  draftContext:(c,command)=>c.query('SELECT seed.event_draft_context($1::jsonb) AS context',[JSON.stringify(command)]).then(r=>r.rows[0].context),
  applyWrite:(c,command,record,birthProof,nodeDomain)=>run(c,'SELECT seed.apply_event_write($1::jsonb,$2::jsonb,$3::jsonb,$4) AS result',
    [JSON.stringify(command),JSON.stringify(record),JSON.stringify(birthProof),nodeDomain]),
  copyContext:(c,id)=>c.query('SELECT seed.event_copy_context($1) AS context',[id]).then(r=>r.rows[0].context),
  applyCopy:(c,id,record,birthProof,lid)=>run(c,'SELECT seed.apply_event_copy($1,$2::jsonb,$3::jsonb,$4) AS result',[id,JSON.stringify(record),JSON.stringify(birthProof),lid]),
});
