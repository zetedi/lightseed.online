#!/usr/bin/env node
// Disposable real-browser storage check. Uses a fresh loopback port/origin and
// synthetic keys only. No node credentials, API, Firebase or existing browser data.
import {build} from 'esbuild';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const directory=await mkdtemp(join(tmpdir(),'lightseed-custody-browser-'));
await build({stdin:{contents:`
import {independentDeviceKeyStore} from ${JSON.stringify(join(root,'src/services/independent/keyStore.ts'))};
import {createSeedKeyCustody} from ${JSON.stringify(join(root,'src/services/independent/keyCustody.ts'))};
import {seedRotationPreimage} from ${JSON.stringify(join(root,'src/domain/seedSigning.mjs'))};
import {keypairFromSeed,signPreimage,verifyPreimage} from ${JSON.stringify(join(root,'src/services/signingCrypto.ts'))};
const result=document.querySelector('#result'),button=document.querySelector('button');
const uid='disposable-custody-test',lid='01900000-0000-7000-8000-000000000001';
(async()=>{
 const store=independentDeviceKeyStore();
 const authenticated={status:'authenticated',uid};
 let failRotation=true;
 const session={snapshot:()=>authenticated,read:async(path)=>path==='/v1/me/profile'?{profile:{uid,lid}}:{identity:{uid,lid,publicKeyB64:sessionStorage.getItem('custody-phase'),state:'active'}},
   signingCommand:async(command)=>{
     if(command.action!=='rotate')throw new Error('unexpected_command');
     if(failRotation)throw new Error('simulated_disconnect');
     const preimage=seedRotationPreimage(uid,command);
     if(!await verifyPreimage(command.fromPubkey,command.oldSig,preimage) || !await verifyPreimage(command.toPubkey,command.newSig,preimage))throw new Error('invalid_rotation');
     sessionStorage.setItem('custody-phase',command.toPubkey);
     return {};
   }};
 if(!sessionStorage.getItem('custody-phase')) {
   const key=await keypairFromSeed(new Uint8Array(32).fill(17));
   await Promise.all([store.save({...key,uid,lid}),store.save({...key,uid,lid})]);
   const saved=await store.list(uid,lid);
   if(saved.length!==1 || saved[0].privateKey.extractable)throw new Error('storage_contract_failed');
   if((await store.list('other',lid)).length || (await store.list(uid,'other')).length)throw new Error('scope_isolation_failed');
   sessionStorage.setItem('custody-phase',saved[0].publicKeyB64);
   const custody=createSeedKeyCustody(session,store);await custody.prepareRotation();
   try{await custody.confirmBackup();throw new Error('expected_disconnect');}catch(error){if(error.message!=='simulated_disconnect')throw error;}
   if((await store.list(uid,lid)).length!==2 || !(await custody.inspect()).rotationPending)throw new Error('rotation_not_saved');
   result.textContent='Saved non-extractable keys and interrupted rotation. Account and person isolation passed. Ready to reload.';
   button.disabled=false;button.onclick=()=>location.reload();
 } else {
   const saved=await store.list(uid,lid);
   if(saved.length!==2 || !saved.some(key=>key.publicKeyB64===sessionStorage.getItem('custody-phase')) || saved.some(key=>key.privateKey.extractable))throw new Error('reload_contract_failed');
   const proof=await signPreimage(saved[0].privateKey,'disposable browser persistence check');
   if(!await verifyPreimage(saved[0].publicKeyB64,proof,'disposable browser persistence check'))throw new Error('persisted_key_failed');
   let refused=false;try{await crypto.subtle.exportKey('pkcs8',saved[0].privateKey);}catch{refused=true;}
   if(!refused)throw new Error('key_became_extractable');
   const custody=createSeedKeyCustody(session,store);
   if(!(await custody.inspect()).rotationPending)throw new Error('lost_pending_rotation');
   failRotation=false;await custody.retryRotation();
   const current=await custody.inspect();
   if(current.status!=='ready' || current.rotationPending || (await store.list(uid,lid)).length!==2)throw new Error('rotation_retry_failed');
   await new Promise((resolve,reject)=>{const request=indexedDB.deleteDatabase('lightseed-independent-signing');request.onsuccess=resolve;request.onerror=reject;});
   sessionStorage.clear();result.textContent='PASS: real IndexedDB survives reload; signing verifies; private-key export is refused; account/person isolation, duplicate saves and interrupted rotation retry passed. Disposable database removed.';
 }
})().catch(()=>{result.textContent='FAIL: browser custody verification did not complete.';});
`,resolveDir:root,loader:'ts'},bundle:true,format:'esm',platform:'browser',outfile:join(directory,'test.js'),logLevel:'silent'});
const js=await readFile(join(directory,'test.js'));
const html='<!doctype html><meta charset="utf-8"><title>Disposable signing custody check</title><h1>Browser signing custody</h1><p id="result">Checking…</p><button disabled>Reload and verify saved key</button><script type="module" src="/test.js"></script>';
const server=createServer((req,res)=>{res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',req.url==='/test.js'?'text/javascript':'text/html');res.end(req.url==='/test.js'?js:html);});
server.listen(0,'127.0.0.1',()=>console.log('Disposable check: http://127.0.0.1:'+server.address().port));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close(async()=>{await rm(directory,{recursive:true,force:true});process.exit(0);}));
