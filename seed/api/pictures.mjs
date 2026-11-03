// THE RELEASE OF A PICTURE (ring 2026-11-03): the origin's functions/releasePicture grown on the
// independent node, in the one pattern of seed/schema/044 — FACTS are read under locks (the
// manifest, the holder's document, the actor's standing), the PURE LAW from the shared domain
// bundle is asked (pictureReleaseOf: which seats may be released and who holds them;
// docReferencesPicture: whether the holder still shows the path) and what the law allowed is taken.
// The files are content-addressed and shared, so a release marks each hash an ORPHAN and the SWEEP
// frees a file only when no manifest names it any more — under the hash's advisory lock, the same
// lock a publish takes, in the same transaction that lifts the mark. The sweep runs right after a
// release for its own hashes, and every night (clock.mjs 'sweep') for whatever a disk's refusal or a
// crash left behind. Nothing here trusts a claim: the holder the law named must be the path's own
// (the soil checks), standing is read, the files are the store's.
// THE LAYERS (same day): this is a SERVICE — orchestration and refusals, no SQL. How the soil is
// asked lives in its repository (seed/api/db/pictures.mjs); the files live in the media store.
import {pictureReleaseOf,docReferencesPicture} from '../generated/chain.mjs';
import {seedMediaReferencePath} from '../../src/domain/seedMedia.mjs';
import {refuse} from './organs.mjs';

/** @typedef {import('./db/pictures.mjs').PicturesRepository} PicturesRepository */
/** @typedef {{remove: (hash: string) => Promise<void>}} MediaRemover */
/** @typedef {{warn: (...args: *[]) => void}} Log */

/** @param {{repository: PicturesRepository, media: MediaRemover, hashes: string[], log?: Log}} options */
export async function sweepHashes({repository,media,hashes,log=console}) {
  const report={orphans:hashes.length,freed:0,kept:0,failed:0};
  for(const hash of hashes) {
    try {
      const verdict=await repository.sweep(hash,()=>media.remove(hash));
      if(verdict==='freed')report.freed++;else if(verdict==='kept')report.kept++;
    } catch(error) {report.failed++;log.warn('media sweep failed for',String(hash).slice(0,16),error instanceof Error?error.message:'unknown');}
  }
  return report;
}

// The clock's sweep: every orphan standing, oldest first. Without a media store there is nothing to free.
/** @param {{repository: PicturesRepository, media: MediaRemover | null, log?: Log, limit?: number}} options */
export async function sweepOrphans({repository,media,log=console,limit=500}) {
  if(!media)return {media:false,orphans:0,freed:0,kept:0,failed:0};
  const hashes=await repository.due(limit);
  return sweepHashes({repository,media,hashes,log});
}

// The release a hand asks for by the picture's door on this node. Refusals by name, as the origin's:
// picture_not_ours (not a door of this node), picture_not_releasable (a seat the law never releases),
// picture_not_yours, picture_missing, picture_in_use (the holder still shows it).
/** @param {{repository: PicturesRepository, media: MediaRemover, uid: string, url: string, log?: Log}} options */
export async function releasePicture({repository,media,uid,url,log=console}) {
  const path=seedMediaReferencePath(url);
  if(!path)refuse('picture_not_ours',400);
  const release=pictureReleaseOf(path);
  if(!release)refuse('picture_not_releasable',409);
  const holderKind=release.holder.kind,holderId=holderKind==='community'?release.holder.id:release.holder.uid;
  const hashes=await repository.release(uid,async session=>{
    const context=await session.context(path,holderKind,holderId);
    if(!context?.may)refuse('picture_not_yours',403);
    if(!context.exists)refuse('picture_missing',404);
    if(context.holder!==null && context.holder!==undefined && docReferencesPicture(context.holder,path))refuse('picture_in_use',409);
    return session.release(path,holderKind,holderId);
  });
  const swept=await sweepHashes({repository,media,hashes:Array.isArray(hashes)?hashes:[],log});
  return {released:swept.freed,kept:swept.kept};
}
