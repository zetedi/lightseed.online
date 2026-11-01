import {expect,it} from 'vitest';
import {seedMediaPath,seedMediaUploadPath,seedMediaDescriptor,seedMediaReferencePath} from '../src/domain/seedMedia.mjs';
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
