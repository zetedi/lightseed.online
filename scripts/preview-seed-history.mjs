#!/usr/bin/env node
// Actual history component with synthetic transport responses, not a server privacy test.
import {build} from 'esbuild';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const directory=await mkdtemp(join(tmpdir(),'lightseed-history-ui-'));
await build({stdin:{contents:`
import React from 'react';
import {createRoot} from 'react-dom/client';
import {PulseHistory} from ${JSON.stringify(join(root,'seed/web/PulseHistory.tsx'))};
import {computeCanonicalHash,BLOCK_HASH_VERSION} from ${JSON.stringify(join(root,'src/domain/chain/verify.ts'))};
(async()=>{
 const first={id:'first',lid:'01900000-0000-7000-8000-000000000001',lifetreeId:'tree',type:'tree_growth',title:'First growth',body:'A synthetic record whose hash matches.',authorId:'alice',createdAt:'2026-10-28T00:00:00Z',mintedAt:1,previousHash:'root',hashVersion:BLOCK_HASH_VERSION};
 first.hash=await computeCanonicalHash('root',1,first);
 const older={...first,id:'older',title:'Changed record',body:'Original body',mintedAt:0};
 older.hash=await computeCanonicalHash('root',0,older);older.body='This synthetic record was changed after hashing.';
 const snapshot={status:'authenticated',uid:'alice'};
 const session={snapshot:()=>snapshot,read:async(path)=>path.includes('after=')?{pulses:[older],next:null}:{pulses:[first,{id:'message',type:'reach',title:'PRIVATE MESSAGE SHOULD NOT APPEAR',body:'Authorized message omitted from timeline'}],next:'next'}};
 createRoot(document.querySelector('#app')).render(<PulseHistory session={session} uid="alice" on="tree" id="tree"/>);
})().catch(()=>{document.querySelector('#app').textContent='Fixture failed to start';});
`,resolveDir:root,loader:'tsx'},bundle:true,jsx:'automatic',format:'esm',platform:'browser',outfile:join(directory,'test.js'),logLevel:'silent'});
const js=await readFile(join(directory,'test.js'));
const html='<!doctype html><meta charset="utf-8"><title>Disposable history UI test</title><style>body{max-width:900px;margin:24px auto;font:16px system-ui;color:#18352b;background:#f8faf6}article{border-top:1px solid #adbfb4;padding:12px 0}button{font:inherit;padding:8px}code{overflow-wrap:anywhere}</style><h1>History UI test</h1><p>Synthetic transport fixture. Server access rules are tested separately against PostgreSQL and Docker.</p><div id="app"></div><script type="module" src="/test.js"></script>';
const server=createServer((req,res)=>{res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',req.url==='/test.js'?'text/javascript':'text/html');res.end(req.url==='/test.js'?js:html);});
server.on('error',async(error)=>{console.error(error.message);await rm(directory,{recursive:true,force:true});process.exitCode=1;});
server.listen(0,'127.0.0.1',()=>console.log('Disposable history check: http://127.0.0.1:'+server.address().port));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close(async()=>{await rm(directory,{recursive:true,force:true});process.exit(0);}));
