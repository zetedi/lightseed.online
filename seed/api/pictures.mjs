// THE RELEASE OF A PICTURE (ring 2026-11-03): the origin's functions/releasePicture grown on the
// independent node, in the one pattern of seed/schema/044 — the API reads FACTS under locks
// (seed.picture_context: the manifest, the holder's document, the actor's standing), asks the PURE
// LAW from the shared domain bundle (pictureReleaseOf: which seats may be released and who holds
// them; docReferencesPicture: whether the holder still shows the path) and takes what the law
// allowed (seed.picture_release). The files are content-addressed and shared, so a release marks
// each hash an ORPHAN and the SWEEP frees a file only when no manifest names it any more — under the
// hash's advisory lock, the same lock a publish takes, in the same transaction that lifts the mark.
// The sweep runs right after a release for its own hashes, and every night (clock.mjs 'sweep') for
// whatever a disk's refusal or a crash left behind. Nothing here trusts a claim: the holder the law
// named must be the path's own (the soil checks), standing is read, the files are the store's.
import {pictureReleaseOf,docReferencesPicture} from '../generated/chain.mjs';
import {seedMediaReferencePath} from '../../src/domain/seedMedia.mjs';
import {refuse} from './organs.mjs';

const run=(c,sql,params)=>c.query(sql,params).then(r=>r.rows[0].result);

// One orphan: judged under its hash's lock, its file taken in the same transaction, the mark lifted after.
// A file gone already is gone (the store's remove says so); a judgement of 'kept' or 'gone' touches no file.
const sweepOne=(withSession,media,hash)=>withSession(null,async c=>{
  const verdict=await run(c,'SELECT seed.media_orphan_take($1) AS result',[hash]);
  if(verdict!=='free')return verdict;
  await media.remove(hash);
  await c.query('SELECT seed.media_orphan_settle($1)',[hash]);
  return 'freed';
});

/** @param {{withSession: *, media: {remove: (hash: string) => Promise<void>}, hashes: string[], log?: {warn: (...args: *[]) => void}}} options */
export async function sweepHashes({withSession,media,hashes,log=console}) {
  const report={orphans:hashes.length,freed:0,kept:0,failed:0};
  for(const hash of hashes) {
    try {
      const verdict=await sweepOne(withSession,media,hash);
      if(verdict==='freed')report.freed++;else if(verdict==='kept')report.kept++;
    } catch(error) {report.failed++;log.warn('media sweep failed for',String(hash).slice(0,16),error instanceof Error?error.message:'unknown');}
  }
  return report;
}

// The clock's sweep: every orphan standing, oldest first. Without a media store there is nothing to free.
/** @param {{withSession: *, media: {remove: (hash: string) => Promise<void>} | null, log?: {warn: (...args: *[]) => void}, limit?: number}} options */
export async function sweepOrphans({withSession,media,log=console,limit=500}) {
  if(!media)return {media:false,orphans:0,freed:0,kept:0,failed:0};
  const hashes=await withSession(null,c=>run(c,'SELECT seed.media_orphans_due($1) AS result',[limit]));
  return sweepHashes({withSession,media,hashes,log});
}

// The release a hand asks for by the picture's door on this node. Refusals by name, as the origin's:
// picture_not_ours (not a door of this node), picture_not_releasable (a seat the law never releases),
// picture_not_yours, picture_missing, picture_in_use (the holder still shows it).
/** @param {{withSession: *, media: {remove: (hash: string) => Promise<void>}, uid: string, url: string, log?: {warn: (...args: *[]) => void}}} options */
export async function releasePicture({withSession,media,uid,url,log=console}) {
  const path=seedMediaReferencePath(url);
  if(!path)refuse('picture_not_ours',400);
  const release=pictureReleaseOf(path);
  if(!release)refuse('picture_not_releasable',409);
  const holderKind=release.holder.kind,holderId=holderKind==='community'?release.holder.id:release.holder.uid;
  const hashes=await withSession(uid,async c=>{
    const context=await run(c,'SELECT seed.picture_context($1,$2,$3) AS result',[path,holderKind,holderId]);
    if(!context?.may)refuse('picture_not_yours',403);
    if(!context.exists)refuse('picture_missing',404);
    if(context.holder!==null && context.holder!==undefined && docReferencesPicture(context.holder,path))refuse('picture_in_use',409);
    return run(c,'SELECT seed.picture_release($1,$2,$3) AS result',[path,holderKind,holderId]);
  });
  const swept=await sweepHashes({withSession,media,hashes:Array.isArray(hashes)?hashes:[],log});
  return {released:swept.freed,kept:swept.kept};
}
