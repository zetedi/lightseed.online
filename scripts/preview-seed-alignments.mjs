#!/usr/bin/env node
// Actual alignment component with synthetic transport; database authority is tested separately.
import {build} from 'esbuild';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const directory=await mkdtemp(join(tmpdir(),'lightseed-alignment-ui-'));
await build({stdin:{contents:`
import React from 'react';
import {createRoot} from 'react-dom/client';
import {Alignments} from ${JSON.stringify(join(root,'seed/web/Alignments.tsx'))};
const first={id:'first',status:'PENDING',initiatorUid:'alice',targetUid:'bob',initiatorTreeId:'oak',targetTreeId:'willow',messages:[{by:'alice',text:'Let us tend these trees together.',at:'2026-10-29T00:00:00Z'}]};
const items=[first,{...first,id:'uncertain',messages:[]},{...first,id:'reject',messages:[]}];
const snapshot={status:'authenticated',uid:'bob'};let count=0;
const session={snapshot:()=>snapshot,read:async(path)=>{
 const url=new URL(path,'https://fixture.invalid');
 if(url.pathname==='/v1/trees'&&url.searchParams.has('id'))return {tree:{id:url.searchParams.get('id'),name:url.searchParams.get('id')==='oak'?'Oak':'Willow'}};
 if(url.pathname==='/v1/trees')return {trees:[{id:'willow',name:'Willow',visibility:'public'},{id:'oak',name:'Oak',visibility:'public'}],next:null};
 if(url.pathname==='/v1/pulses')return {pulses:[{id:'pulse',title:'Care for Oak',authorId:'alice',lifetreeId:'oak'}],next:null};
 if(url.searchParams.has('id'))return {alignment:structuredClone(items.find(item=>item.id===url.searchParams.get('id')))};
 return {alignments:structuredClone(items),next:null};
},alignmentCommand:async(command)=>{
 count++;
 let item=items.find(item=>item.id===command.id);
 if(command.action==='propose')items.push({...first,id:'new-'+count,initiatorUid:'bob',targetUid:'alice',initiatorTreeId:command.fromTreeId,targetTreeId:'oak',messages:[]});
 else if(command.action==='note')item.messages.push({by:'bob',text:command.text,at:new Date().toISOString()});
 else item.status=command.action==='accept'?'ACCEPTED':'REJECTED';
 document.querySelector('#proof').textContent='Synthetic changes: '+count;
 if(command.id==='uncertain'&&command.action==='accept')throw Error('Lost response');
 return {alignment:item,fromPulseId:'from',toPulseId:'to'};
}};
createRoot(document.querySelector('#app')).render(<Alignments session={session} uid="bob"/>);
`,resolveDir:root,loader:'tsx'},bundle:true,jsx:'automatic',format:'esm',platform:'browser',outfile:join(directory,'test.js'),logLevel:'silent'});
const js=await readFile(join(directory,'test.js'));
const html='<!doctype html><meta charset="utf-8"><title>Disposable alignment UI test</title><style>body{max-width:900px;margin:24px auto;font:16px system-ui;color:#18352b;background:#f8faf6}article{border-top:1px solid #adbfb4;padding:12px 0}button{font:inherit;padding:8px}code{overflow-wrap:anywhere}</style><h1>Alignment acceptance UI test</h1><p>Synthetic transport fixture. No real alignment is changed. The second acceptance simulates a lost response.</p><p id="proof">Synthetic changes: 0</p><div id="app"></div><script type="module" src="/test.js"></script>';
const server=createServer((req,res)=>{res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',req.url==='/test.js'?'text/javascript':'text/html');res.end(req.url==='/test.js'?js:html);});
server.on('error',async(error)=>{console.error(error.message);await rm(directory,{recursive:true,force:true});process.exitCode=1;});
server.listen(0,'127.0.0.1',()=>console.log('Disposable alignment check: http://127.0.0.1:'+server.address().port));
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>server.close(async()=>{await rm(directory,{recursive:true,force:true});process.exit(0);}));
