#!/usr/bin/env node
// Disposable UI/device-storage exercise with a simulated API. This is not an
// OIDC or server-quorum test; those boundaries have separate PostgreSQL/Docker tests.
import {build} from 'esbuild';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const directory=await mkdtemp(join(tmpdir(),'lightseed-recovery-ui-'));
await build({stdin:{contents:`
import React from 'react';
import {createRoot} from 'react-dom/client';
import {SigningIdentity} from ${JSON.stringify(join(root,'seed/web/SigningIdentity.tsx'))};
import {keypairFromSeed,verifyPreimage} from ${JSON.stringify(join(root,'src/services/signingCrypto.ts'))};
import {seedRecoveryPreimage} from ${JSON.stringify(join(root,'src/domain/seedSigning.mjs'))};
import {sha256} from ${JSON.stringify(join(root,'src/utils/crypto.ts'))};
(async()=>{
 const uid='alice',lid='01900000-0000-7000-8000-000000000001',snapshot={status:'authenticated',uid};
 const old=await keypairFromSeed(new Uint8Array(32).fill(31));
 const original={uid,lid,publicKeyB64:old.publicKeyB64,fingerprint:await sha256(old.publicKeyB64),epochId:'original',state:'frozen'};
 const context={uid,lid,fromFingerprint:original.fingerprint,suspectedSinceMs:100};
 const state=JSON.parse(sessionStorage.getItem('fixture')||'null')||{identity:original,proposal:null,interrupted:false};
 const save=()=>sessionStorage.setItem('fixture',JSON.stringify(state));
 const session={snapshot:()=>snapshot,read:async(path)=>{
   const url=new URL(path,location.origin);
   if(url.pathname==='/v1/me/profile')return {profile:{uid,lid}};
   if(url.pathname==='/v1/signing-identity')return {identity:state.identity};
   if(url.pathname==='/v1/me/signing-recovery')return {context};
   if(url.pathname==='/v1/signing-recovery') {if(!state.proposal)throw new Error('missing');return {proposal:state.proposal};}
   if(url.pathname==='/v1/signing-recovery-witnesses')return {items:['bob','carol','dave'].map(uid=>({id:uid,witnessUid:uid,epochId:'synthetic-display-only'})),next:null};
   throw new Error('unexpected_request');
 },signingCommand:async(command)=>{
   if(command.action==='begin_recovery') {
     if(!state.interrupted){state.interrupted=true;save();throw new Error('simulated_disconnect');}
     if(!await verifyPreimage(command.toPubkey,command.newSig,seedRecoveryPreimage({...context,...command})))throw new Error('invalid_proof');
     state.proposal={...context,...command,id:command.eventId,status:'open'};
   } else if(command.action==='activate_recovery') {
     if(!state.proposal || state.proposal.id!==command.eventId)throw new Error('missing');
     state.proposal.status='activated';state.identity={...original,publicKeyB64:state.proposal.toPubkey,fingerprint:state.proposal.toFingerprint,epochId:command.eventId,state:'active'};
   } else throw new Error('unsupported_fixture_command');
   save();return {identity:state.identity};
 }};
 createRoot(document.querySelector('#app')).render(<SigningIdentity session={session} uid={uid}/>);
})().catch(()=>{document.querySelector('#app').textContent='Fixture failed to start';});
`,resolveDir:root,loader:'tsx'},bundle:true,jsx:'automatic',format:'esm',platform:'browser',outfile:join(directory,'test.js'),logLevel:'silent'});
const js=await readFile(join(directory,'test.js'));
const html='<!doctype html><meta charset="utf-8"><title>Disposable recovery UI fixture</title><style>body{max-width:920px;margin:24px auto;font:16px system-ui;color:#18352b;background:#f8faf6}section{border-top:1px solid #adbfb4;padding:12px 0}button,input,textarea{font:inherit;margin:6px;padding:8px}label{display:block}code{overflow-wrap:anywhere}.plain-story{padding:18px;background:#e8f0e9}</style><h1>Recovery UI test</h1><p>Disposable synthetic account; simulated API and quorum. This checks browser controls and device storage, not server authorization.</p><div id="app"></div><script type="module" src="/test.js"></script>';
const server=createServer((req,res)=>{res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',req.url==='/test.js'?'text/javascript':'text/html');res.end(req.url==='/test.js'?js:html);});
server.on('error',async(error)=>{console.error(error.message);await rm(directory,{recursive:true,force:true});process.exitCode=1;});
server.listen(0,'127.0.0.1',()=>console.log('Disposable UI check: http://127.0.0.1:'+server.address().port));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close(async()=>{await rm(directory,{recursive:true,force:true});process.exit(0);}));
