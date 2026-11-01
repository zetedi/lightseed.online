#!/usr/bin/env node
// Actual offering component with synthetic transport; database authority is tested separately.
import {build} from 'esbuild';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const directory=await mkdtemp(join(tmpdir(),'lightseed-offering-ui-'));
await build({stdin:{contents:`
import React from 'react';
import {createRoot} from 'react-dom/client';
import {Offerings} from ${JSON.stringify(join(root,'seed/web/Offerings.tsx'))};
const first={id:'first',type:'offering',title:'Care for Willow',body:'Synthetic agreement',authorId:'alice',offeredToKind:'tree',offeredToId:'willow',offeringFromTreeId:'oak',offeringStatus:'open'};
const second={...first,id:'second',title:'Care with a lost response'};
const own={...first,id:'own',title:'My offering',authorId:'bob'};
const paused={...first,id:'paused',title:'Paused incoming offering',offeringActive:false};
const items=[first,second,own,paused];
const snapshot={status:'authenticated',uid:'bob'};let count=0;
const session={snapshot:()=>snapshot,read:async(path)=>{
 if(path.startsWith('/v1/trees'))return {trees:[{id:'oak',name:'My private oak',visibility:'private',treeType:'LIFETREE'},{id:'willow',name:'Willow',visibility:'public',treeType:'LIFETREE'}],next:null};
 if(path.startsWith('/v1/visions'))return {visions:[{id:'dream',title:'A shared dream',visibility:'public'}],next:null};
 if(path.includes('?id='))return {pulse:structuredClone(items.find(item=>path.endsWith(item.id)))};
 return {pulses:structuredClone(items),next:null};
},uploadMedia:async()=>({}),offeringCommand:async(command)=>{
 count++;
 let offer=items.find(item=>item.id===command.id);
 if(command.action==='create') {
  offer={id:'created-'+count,type:'offering',title:command.title,body:command.body,authorId:'bob',offeringKind:command.kind,
   offeringAppreciationLight:command.appreciation,offeringUrl:command.url,visibility:command.visibility,offeringActive:true,
   ...(command.toKind?{offeredToKind:command.toKind,offeredToId:command.toId,offeringFromTreeId:command.fromTreeId,offeringStatus:'open'}:{})};
  items.push(offer);
 } else if(command.action==='edit') Object.assign(offer,{title:command.title,body:command.body,offeringAppreciationLight:command.appreciation,offeringUrl:command.url,visibility:command.visibility});
 else if(command.action==='set_active')offer.offeringActive=command.active;
 else offer.offeringStatus=command.action==='withdraw'?'withdrawn':command.action==='decline'?'declined':'accepted';
 document.querySelector('#proof').textContent='Synthetic changes: '+count;
 if(command.id==='second' && command.action==='accept')throw Error('Lost response');return {offering:offer,fromPulseId:'from',toPulseId:'to'};
}};
createRoot(document.querySelector('#app')).render(<Offerings session={session} uid="bob"/>);
`,resolveDir:root,loader:'tsx'},bundle:true,jsx:'automatic',format:'esm',platform:'browser',outfile:join(directory,'test.js'),logLevel:'silent'});
const js=await readFile(join(directory,'test.js'));
const html='<!doctype html><meta charset="utf-8"><title>Disposable offering UI test</title><style>body{max-width:900px;margin:24px auto;font:16px system-ui;color:#18352b;background:#f8faf6}article{border-top:1px solid #adbfb4;padding:12px 0}button{font:inherit;padding:8px}code{overflow-wrap:anywhere}</style><h1>Offering acceptance UI test</h1><p>Synthetic transport fixture. No real offering is changed. The second acceptance simulates a lost response.</p><p id="proof">Synthetic changes: 0</p><div id="app"></div><script type="module" src="/test.js"></script>';
const server=createServer((req,res)=>{res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',req.url==='/test.js'?'text/javascript':'text/html');res.end(req.url==='/test.js'?js:html);});
server.on('error',async(error)=>{console.error(error.message);await rm(directory,{recursive:true,force:true});process.exitCode=1;});
server.listen(0,'127.0.0.1',()=>console.log('Disposable offering check: http://127.0.0.1:'+server.address().port));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close(async()=>{await rm(directory,{recursive:true,force:true});process.exit(0);}));
