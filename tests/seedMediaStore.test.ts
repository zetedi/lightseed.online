import {afterEach,expect,it} from 'vitest';
import {mkdtemp,rm,writeFile,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {createMediaStore} from '../seed/api/media.mjs';
import {SEED_IMAGE_ENCODING} from '../src/domain/seedMedia.mjs';
import {IMAGE_PRIMARY_MAX_EDGE,IMAGE_PRIMARY_QUALITY,IMAGE_VARIANT_SIZES,IMAGE_VARIANT_QUALITY} from '../src/domain/imageVariant';
const sharp=createRequire(resolve('seed/package.json'))('sharp');
const directories:string[]=[];
afterEach(async()=>{await Promise.all(directories.splice(0).map(path=>rm(path,{recursive:true,force:true})));});
async function fixture(){const dir=await mkdtemp(join(tmpdir(),'seed-media-'));directories.push(dir);return {dir,store:await createMediaStore(dir)};}
it('matches existing image sizes and quality, re-encodes real bytes and persists all variants across restart',async()=>{
  expect(SEED_IMAGE_ENCODING).toEqual({maxEdge:IMAGE_PRIMARY_MAX_EDGE,quality:IMAGE_PRIMARY_QUALITY,small:IMAGE_VARIANT_SIZES[0],large:IMAGE_VARIANT_SIZES[1],variantQuality:IMAGE_VARIANT_QUALITY});
  const {dir,store}=await fixture();
  const bytes=await sharp({create:{width:1800,height:900,channels:3,background:'#448855'}}).png().toBuffer();
  const manifest=await store.encode(bytes,'image/png');
  const restarted=await createMediaStore(dir);
  for(const [key,width] of [['primary',1600],['small',480],['large',1200]] as const){
    const output=await restarted.read(manifest[key]);const info=await sharp(output).metadata();
    expect(info.width).toBe(width);expect(info.height).toBe(width/2);
  }
  expect(await store.encode(bytes,'image/png')).toEqual(manifest);
});
it('rejects MIME spoofing and non-images, and detects changed files or symlinks instead of serving them',async()=>{
  const {dir,store}=await fixture();
  await expect(store.encode(Buffer.from('<svg></svg>'),'image/png')).rejects.toThrow('invalid_image');
  const bytes=await sharp({create:{width:2,height:2,channels:3,background:'#448855'}}).png().toBuffer();
  await expect(store.encode(bytes,'image/jpeg')).rejects.toThrow('invalid_image');
  const manifest=await store.encode(bytes,'image/png');
  await writeFile(join(dir,manifest.primary.hash),Buffer.alloc(manifest.primary.size));
  await expect(store.read(manifest.primary)).rejects.toThrow('media_integrity_failure');
  await rm(join(dir,manifest.small.hash));await symlink(join(dir,manifest.primary.hash),join(dir,manifest.small.hash));
  await expect(store.read(manifest.small)).rejects.toThrow();
  await expect(store.read({...manifest.primary,hash:'../secret'})).rejects.toThrow('invalid_media_manifest');
});

it('removes a file by its hash alone — gone already is gone — and says whether a manifest\'s files all stand (ring 2026-11-03)',async()=>{
  const {dir,store}=await fixture();
  const bytes=await sharp({create:{width:600,height:300,channels:3,background:'#335577'}}).png().toBuffer();
  const manifest=await store.encode(bytes,'image/png');
  expect(await store.present(manifest)).toBe(true);
  await store.remove(manifest.small.hash);
  expect(await store.present(manifest)).toBe(false);
  await store.remove(manifest.small.hash); // a second removal is no error
  for(const bad of ['../secret','',manifest.primary.hash.slice(0,63),'/'+manifest.primary.hash,null])await expect(store.remove(bad as never)).rejects.toThrow('invalid_media_manifest');
  await expect(store.present({...manifest,small:{...manifest.small,hash:'../secret'}})).rejects.toThrow('invalid_media_manifest');
  // The same bytes encoded again restore what was removed.
  expect(await store.encode(bytes,'image/png')).toEqual(manifest);
  expect(await store.present(manifest)).toBe(true);
  // A file whose bytes no longer match its hash is not "present": the store never vouches for it, and
  // only its removal (never an encode over it) lets the true bytes land again.
  await writeFile(join(dir,manifest.primary.hash),Buffer.alloc(manifest.primary.size));
  await expect(store.present(manifest)).rejects.toThrow('media_integrity_failure');
  await expect(store.encode(bytes,'image/png')).rejects.toThrow('media_integrity_failure');
  await store.remove(manifest.primary.hash);
  expect(await store.encode(bytes,'image/png')).toEqual(manifest);
  expect(await store.present(manifest)).toBe(true);
});

it('disables SVG decoding before inspecting a mislabeled raster upload',async()=>{
  const svg=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>');
  await expect(sharp(svg).metadata()).rejects.toThrow();
});
