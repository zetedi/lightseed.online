#!/usr/bin/env node
// Actual mint form, real device storage and signatures, synthetic transport only.
import {build} from 'esbuild';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const directory=await mkdtemp(join(tmpdir(),'lightseed-mint-ui-'));
await build({stdin:{contents:`
import React from 'react';
import {createRoot} from 'react-dom/client';
import {BlockMint} from ${JSON.stringify(join(root,'seed/web/BlockMint.tsx'))};
import {independentDeviceKeyStore} from ${JSON.stringify(join(root,'src/services/independent/keyStore.ts'))};
import {keypairFromSeed,verifyPreimage} from ${JSON.stringify(join(root,'src/services/signingCrypto.ts'))};
import {sha256} from ${JSON.stringify(join(root,'src/utils/crypto.ts'))};
import {judgeBlockBirth,blockSignaturePayload,blockSignaturePreimage} from ${JSON.stringify(join(root,'src/domain/chain/birth.ts'))};
(async()=>{
 const uid='fixture-alice',lid='01900000-0000-7000-8000-000000000001';
 const key=await keypairFromSeed(new Uint8Array(32).fill(29));
 await independentDeviceKeyStore().save({...key,uid,lid});
 const identity={uid,lid,publicKeyB64:key.publicKeyB64,fingerprint:await sha256(key.publicKeyB64),epochId:'fixture_epoch',state:'active'};
 const bearer={visibility:'private',latestHash:'fixture-root',blockHeight:0},snapshot={status:'authenticated',uid};
 let count=0;
 const session={snapshot:()=>snapshot,read:async(path)=>path==='/v1/me/profile'?{profile:{uid,lid}}:path.startsWith('/v1/signing-identity')?{identity}:{tree:bearer},
  blockCommand:async(command)=>{
   const judgment=judgeBlockBirth({on:'tree',minterUid:uid,isStaff:false,bearer:{...bearer,exists:true,carer:true},block:command.block});
   if(judgment.outcome!=='mint')throw Error('Rejected fixture');
   const preimage=blockSignaturePreimage(blockSignaturePayload({on:'tree',bearerId:'tree',previousHash:judgment.previousHash,content:judgment.content,signerUid:uid,keyFingerprint:identity.fingerprint,epochId:identity.epochId}));
   if(!await verifyPreimage(key.publicKeyB64,command.signature.sig,preimage))throw Error('Bad signature');
   count++;document.querySelector('#proof').textContent='Verified synthetic submissions: '+count;
   if(count===2)throw Error('Synthetic lost response');
   return {pulseId:'fixture-'+count};
  }};
 createRoot(document.querySelector('#app')).render(<BlockMint session={session} on="tree" id="tree" onChanged={()=>{}}/>);
})().catch(()=>{document.querySelector('#app').textContent='Fixture failed to start';});
`,resolveDir:root,loader:'tsx'},bundle:true,jsx:'automatic',format:'esm',platform:'browser',outfile:join(directory,'test.js'),logLevel:'silent'});
const js=await readFile(join(directory,'test.js'));
const html='<!doctype html><meta charset="utf-8"><title>Disposable signed mint UI test</title><style>body{max-width:900px;margin:24px auto;font:16px system-ui;color:#18352b;background:#f8faf6}article{border-top:1px solid #adbfb4;padding:12px 0}button{font:inherit;padding:8px}code{overflow-wrap:anywhere}</style><h1>Signed mint UI test</h1><p>Synthetic transport and disposable key. This checks the actual form and browser signature, not OIDC or server authorization. The second submission simulates a lost response.</p><p id="proof">Verified synthetic submissions: 0</p><div id="app"></div><script type="module" src="/test.js"></script>';
const server=createServer((req,res)=>{res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',req.url==='/test.js'?'text/javascript':'text/html');res.end(req.url==='/test.js'?js:html);});
server.on('error',async(error)=>{console.error(error.message);await rm(directory,{recursive:true,force:true});process.exitCode=1;});
server.listen(0,'127.0.0.1',()=>console.log('Disposable signed mint check: http://127.0.0.1:'+server.address().port));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close(async()=>{await rm(directory,{recursive:true,force:true});process.exit(0);}));
