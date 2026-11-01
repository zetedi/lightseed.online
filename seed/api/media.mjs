import {mkdir,link,unlink,open,realpath} from 'node:fs/promises';
import {constants} from 'node:fs';
import {isAbsolute,join} from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import sharp from 'sharp';
import {seedMediaDescriptor,SEED_MEDIA_MAX_BYTES,SEED_IMAGE_ENCODING} from '../../src/domain/seedMedia.mjs';
// This service accepts raster images only; reject SVG before native decoding.
sharp.block({operation:['VipsForeignLoadSvg']});
const hashOf=bytes=>createHash('sha256').update(bytes).digest('hex');
const formats={'image/jpeg':'jpeg','image/png':'png','image/webp':'webp'};
export async function createMediaStore(directory) {
  if(!isAbsolute(directory))throw new Error('media_directory_must_be_absolute');
  await mkdir(directory,{recursive:true,mode:0o700});const root=await realpath(directory);
  let active=0;
  async function read(descriptor) {
    if(!seedMediaDescriptor(descriptor))throw new Error('invalid_media_manifest');
    const file=await open(join(root,descriptor.hash),constants.O_RDONLY|constants.O_NOFOLLOW);
    try {
      const stat=await file.stat();
      if(!stat.isFile() || stat.size!==descriptor.size || stat.size>SEED_MEDIA_MAX_BYTES)throw new Error('media_integrity_failure');
      const bytes=await file.readFile();if(hashOf(bytes)!==descriptor.hash)throw new Error('media_integrity_failure');return bytes;
    } finally {await file.close();}
  }
  async function store(bytes,type) {
    const descriptor={hash:hashOf(bytes),type,size:bytes.length};
    if(!seedMediaDescriptor(descriptor))throw new Error('invalid_encoded_image');
    const temp=join(root,'.upload-'+randomBytes(16).toString('hex'));
    const staging=await open(temp,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
    try {
      try {await staging.writeFile(bytes);await staging.sync();} finally {await staging.close();}
      try {await link(temp,join(root,descriptor.hash));const folder=await open(root,constants.O_RDONLY);try {await folder.sync();} finally {await folder.close();}}
      catch(error){if(error.code!=='EEXIST')throw error;await read(descriptor);}
    } finally {await unlink(temp);}
    return descriptor;
  }
  return {
    read,
    async encode(bytes,type) {
      if(!formats[type] || !Buffer.isBuffer(bytes) || !bytes.length || bytes.length>SEED_MEDIA_MAX_BYTES)throw Object.assign(new Error('invalid_image'),{code:'INVALID_IMAGE'});
      if(active>=2)throw Object.assign(new Error('image_processor_busy'),{code:'MEDIA_BUSY'});
      active++;
      try {
        let primary;
        try {
          const source=sharp(bytes,{limitInputPixels:80_000_000,failOn:'error',animated:false});
          const metadata=await source.metadata();
          if(metadata.format!==formats[type] || !metadata.width || !metadata.height)throw new Error('format_mismatch');
          primary=await source.rotate().resize({width:SEED_IMAGE_ENCODING.maxEdge,height:SEED_IMAGE_ENCODING.maxEdge,fit:'inside',withoutEnlargement:true})
            .toFormat(formats[type],{quality:SEED_IMAGE_ENCODING.quality}).toBuffer();
        }catch{throw Object.assign(new Error('invalid_image'),{code:'INVALID_IMAGE'});}
        async function variant(size) {
          const variant=await sharp(primary,{limitInputPixels:80_000_000}).resize({width:size,height:size,fit:'inside',withoutEnlargement:true})
            .webp({quality:SEED_IMAGE_ENCODING.variantQuality}).toBuffer();
          return store(variant,'image/webp');
        }
        return {primary:await store(primary,type),small:await variant(SEED_IMAGE_ENCODING.small),large:await variant(SEED_IMAGE_ENCODING.large)};
      } finally {active--;}
    },
  };
}
