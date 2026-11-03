export const SEED_MEDIA_MAX_BYTES=12*1024*1024;
export function seedMediaPath(value) {
  if(typeof value!=='string' || !value || value.length>1024 || !/^[A-Za-z0-9_.~/-]+$/.test(value))return null;
  const parts=value.split('/');
  if(parts.length<2 || parts.some(p=>!p || p==='.' || p==='..' || p.length>255))return null;
  return value;
}
export function seedMediaUploadPath(value) {
  const path=seedMediaPath(value);
  return path && !['thumbs','previews','originals'].includes(path.split('/')[0]) && /\.(?:jpg|jpeg|png|webp)$/.test(path) ? path : null;
}
export function seedMediaReferencePath(value) {
  if(typeof value!=='string' || !value.startsWith('/v1/media?') || value.includes('#'))return null;
  const params=new URLSearchParams(value.slice('/v1/media?'.length));
  if(params.size!==1 || !params.has('path'))return null;
  return seedMediaUploadPath(params.get('path'));
}
// A release asks by the picture's door on this node, and nothing else travels (ring 2026-11-03).
export function seedMediaReleaseInput(value) {
  if(!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).some(k=>k!=='url'))return null;
  return seedMediaReferencePath(value.url)?{url:value.url}:null;
}
export function seedMediaDescriptor(value) {
  return !!value && typeof value==='object' && !Array.isArray(value)
    && Object.keys(value).every(k=>['hash','type','size'].includes(k))
    && /^[a-f0-9]{64}$/.test(value.hash??'') && ['image/jpeg','image/png','image/webp'].includes(value.type)
    && Number.isInteger(value.size) && value.size>0 && value.size<=SEED_MEDIA_MAX_BYTES;
}
// Mirrored against imageVariant.ts by tests until the existing browser module is migrated.
export const SEED_IMAGE_ENCODING={maxEdge:1600,quality:82,small:480,large:1200,variantQuality:80};
