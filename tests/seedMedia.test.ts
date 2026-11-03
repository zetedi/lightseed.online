import {expect,it} from 'vitest';
import {seedMediaPath,seedMediaUploadPath,seedMediaDescriptor,seedMediaReferencePath,seedMediaReleaseInput} from '../src/domain/seedMedia.mjs';
import {withImageExtension} from '../src/domain/imageBytes';
it('every seat the shell asks for lands at the name its bytes earn (ring 2026-11-03: the independent hand once sent the bare path, and the store refused it)',()=>{
  const seats=['communities/c1/logo_1700000000000','communities/c1/hero_1700000000000','communities/c1/1700000000000','communities/c1/pages/1700000000000',
    'communities/c1/lightHouses/IMG_0001.HEIC','users/u1/site-theme/logo_1700000000000','users/u1/trees/ai/1700000000000','users/u1/pulses/ai/1700000000000-0',
    'users/u1/offerings/1700000000000','lightHouses/h1/beds/ai/1700000000000','communities/c1/events/1700000000000'];
  for(const seat of seats){
    expect(seedMediaUploadPath(seat),seat).toBeNull();
    for(const kind of ['webp','jpeg','png'] as const)expect(seedMediaUploadPath(withImageExtension(seat,kind)),`${seat} as ${kind}`).toBe(withImageExtension(seat,kind));
  }
  expect(withImageExtension('communities/c1/lightHouses/IMG_0001.HEIC','webp')).toBe('communities/c1/lightHouses/IMG_0001.webp');
});
it('a release asks by the picture\'s door on this node alone (ring 2026-11-03)',()=>{
  expect(seedMediaReleaseInput({url:'/v1/media?path=communities%2Fc1%2Flogo_1.webp'})).toEqual({url:'/v1/media?path=communities%2Fc1%2Flogo_1.webp'});
  for(const value of [null,'x',[],{},{url:'https://firebasestorage.googleapis.com/v0/b/b/o/communities%2Fc1%2Flogo_1.webp?alt=media'},
    {url:'/v1/media?path=communities/c1/logo_1.webp&variant=small'},{url:'/v1/media?path=communities/c1/logo_1.webp',extra:1},{url:''}])expect(seedMediaReleaseInput(value)).toBeNull();
});
it('recognizes only primary images on this node when editing picture references',()=>{
  expect(seedMediaReferencePath('/v1/media?path=users%2Falice%2Fa.png')).toBe('users/alice/a.png');
  expect(seedMediaReferencePath('/v1/media?path=users/alice/a.png')).toBe('users/alice/a.png');
  for(const value of ['https://another.test/v1/media?path=users/a/a.png','/v1/media?path=users/a/a.png&variant=small',
    '/v1/media?path=users/a/a.png&path=users/a/b.png','/v1/media?path=users/a/a.png#fragment','/v1/media?path=../a.png']) {
    expect(seedMediaReferencePath(value)).toBeNull();
  }
});
it('accepts bounded object keys while excluding traversal, encoded separators and derived uploads',()=>{
  expect(seedMediaUploadPath('beings/01900000-0000-7000-8000-000000000001/tree/photo.webp')).toBeTruthy();
  for(const path of ['/users/a/x.jpg','users/a/../x.jpg','users//x.jpg','users/a/%2e%2e/x.jpg','users/a\\x.jpg','users/a/x.svg','thumbs/users/a/x.webp'])expect(seedMediaUploadPath(path)).toBeNull();
  expect(seedMediaPath('originals/users/a/photo.jpg')).toBeTruthy();
});
it('bounds stored image manifests and accepts no arbitrary filesystem location',()=>{
  const asset={hash:'a'.repeat(64),type:'image/webp',size:1024};expect(seedMediaDescriptor(asset)).toBe(true);
  for(const value of [{...asset,path:'/etc/passwd'},{...asset,hash:'../bad'},{...asset,type:'text/html'},{...asset,size:0},{...asset,size:13*1024*1024}])expect(seedMediaDescriptor(value)).toBe(false);
});
