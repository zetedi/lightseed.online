// THE MEDIA REPOSITORY (ring 2026-11-03): whether a hand may write at a path, a manifest by its path, and the
// publish under the hashes' locks (migration 060: the files are checked under the lock by the caller, inside
// the same transaction, so a sweep of the same bytes never crosses a publish).
import {perform,repositoryOf} from './statements.mjs';

export const mediaRepository=withSession=>repositoryOf(withSession,{
  writeAllowed:(c,path)=>c.query('SELECT seed.media_write_allowed($1) AS allowed',[path]).then(r=>r.rows[0].allowed===true),
  get:(c,path)=>c.query('SELECT seed.media_get($1) AS media',[path]).then(r=>r.rows[0].media),
  lock:(c,hashes)=>perform(c,'SELECT seed.media_lock($1::text[])',[hashes]),
  publish:(c,path,manifest)=>c.query('SELECT seed.media_publish($1,$2::jsonb) AS media',[path,JSON.stringify(manifest)]).then(r=>r.rows[0].media),
});
