#!/usr/bin/env node
// Disposable, loopback-only browser fixture. Synthetic accounts and fresh volumes;
// never uses seed/data, installation credentials, or the user's production issuer.
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, delimiter, extname } from 'node:path';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:https';
import { request as httpRequest } from 'node:http';
import { seedIdentityRealm } from '../src/domain/seedIdentity.mjs';

const root=resolve('.'), directory=await mkdtemp(join(tmpdir(),'lightseed-browser-'));
const project='lightseed-browser-'+randomBytes(6).toString('hex');
const credentials=join(directory,'runtime.env'), authFile=join(directory,'auth.json'), realmFile=join(directory,'realm.json');
const override=join(directory,'compose.yml'), dist=join(directory,'web');
const env={...process.env,COMPOSE_PROJECT_NAME:project,COMPOSE_PROFILES:'',
  COMPOSE_FILE:[join(root,'seed/docker-compose.yml'),join(root,'seed/identity/compose.yml'),override].join(delimiter),
  SEED_DB_PASSWORD:randomBytes(32).toString('base64url'),SEED_IDENTITY_DB_PASSWORD:randomBytes(32).toString('base64url'),
  SEED_IDENTITY_ADMIN:'browser-test-admin',SEED_IDENTITY_ADMIN_PASSWORD:randomBytes(32).toString('base64url'),SEED_IDENTITY_REALM_FILE:realmFile};
const run=(command,args,input,extra={})=>new Promise((accept,reject)=>{
  const child=spawn(command,args,{cwd:root,env:{...env,...extra},stdio:['pipe','pipe','pipe']});let out='',err='';
  child.stdout.on('data',b=>{out+=b;});child.stderr.on('data',b=>{err+=b;});child.on('error',reject);
  child.stdin.on('error',()=>{});child.stdin.end(input);
  child.on('close',code=>code===0?accept(out):reject(new Error(`${command} failed: ${err.slice(-1500)}`)));
});
const compose=(args,input)=>run('docker',['compose',...args],input);
let server,started=false, apiOrigin,identityOrigin;
try {
  await run('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',join(directory,'key.pem'),'-out',join(directory,'cert.pem'),
    '-days','1','-subj','/CN=127.0.0.1','-addext','subjectAltName=IP:127.0.0.1']);
  server=createServer({key:await readFile(join(directory,'key.pem')),cert:await readFile(join(directory,'cert.pem'))},async(req,res)=>{
    const url=new URL(req.url,'https://fixture.invalid');
    const upstream=url.pathname.startsWith('/identity/')?identityOrigin:url.pathname.startsWith('/v1/')||['/healthz','/readyz'].includes(url.pathname)?apiOrigin:null;
    if(upstream){
      const publicUrl=new URL(env.SEED_NODE_ORIGIN);
      const proxy=httpRequest(new URL(req.url,upstream),{method:req.method,headers:{...req.headers,
        'x-forwarded-proto':'https','x-forwarded-host':publicUrl.hostname,'x-forwarded-port':publicUrl.port}},response=>{
        res.writeHead(response.statusCode,response.headers);response.pipe(res);
      });proxy.on('error',()=>{res.writeHead(502);res.end();});req.pipe(proxy);return;
    }
    try {
      const requested=resolve(dist,'.'+decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
      if(!requested.startsWith(dist+'/')){res.writeHead(404);res.end();return;}
      let data,path=requested;
      try { data=await readFile(path); } catch {path=join(dist,'index.html');data=await readFile(path);}
      const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};
      res.writeHead(200,{'content-type':mime[extname(path)]??'application/octet-stream','cache-control':'no-store','referrer-policy':'no-referrer'});res.end(data);
    }catch{res.writeHead(503);res.end('Fixture is starting.');}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='https://127.0.0.1:'+server.address().port;
  env.SEED_NODE_ORIGIN=origin;env.SEED_IDENTITY_ORIGIN=origin+'/identity';
  const realm=seedIdentityRealm(origin);
  realm.users=[{username:'alice',enabled:true,email:'alice@example.test',emailVerified:true,firstName:'Alice',lastName:'Fixture',
    credentials:[{type:'password',value:'SeedBrowserTest9!',temporary:false}]}];
  await writeFile(realmFile,JSON.stringify(realm),{mode:0o644});
  await writeFile(authFile,'{}',{mode:0o644});
  await writeFile(override,`services:
  db:
    volumes: !override
      - browser_data:/var/lib/postgresql/data
    ports: !reset []
  identity:
    environment:
      KC_HTTP_RELATIVE_PATH: /identity
    ports: !override
      - '127.0.0.1::8080'
  api:
    environment:
      SEED_AUTH_CONFIG: /run/auth.json
    env_file: !override
      - ${JSON.stringify(credentials)}
    volumes:
      - type: bind
        source: ${JSON.stringify(authFile)}
        target: /run/auth.json
        read_only: true
    ports: !override
      - '127.0.0.1::8081'
volumes:
  browser_data:
`,{mode:0o600});
  console.log('Preparing disposable database, identity and browser build.');started=true;
  await compose(['build','api']);await compose(['up','-d','--wait','db','identity-db']);await compose(['up','-d','identity']);
  await run(process.execPath,['scripts/migrate-seed.mjs']);await run(process.execPath,['scripts/provision-seed.mjs',credentials]);
  identityOrigin='http://'+(await compose(['port','identity','8080'])).trim();
  const forwarded={'x-forwarded-proto':'https','x-forwarded-host':'127.0.0.1','x-forwarded-port':String(server.address().port)};
  let keys;
  for(let i=0;i<120;i++){
    try {const response=await fetch(identityOrigin+'/identity/realms/lightseed/protocol/openid-connect/certs',{headers:forwarded,signal:AbortSignal.timeout(3000)});
      if(response.ok){keys=(await response.json()).keys.filter(k=>k.use==='sig'&&k.alg==='RS256').map(({kty,kid,n,e})=>({kty,kid,n,e}));break;}
    }catch{/* startup */}
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  if(!keys?.length)throw new Error('Identity fixture did not start.');
  await writeFile(authFile,JSON.stringify({version:1,issuer:env.SEED_IDENTITY_ORIGIN+'/realms/lightseed',audience:'lightseed-api',
    tokenProfile:'keycloak',clientId:'lightseed-web',enrollment:'open',bindings:[],jwks:{keys}}));
  await compose(['--profile','api','up','-d','--wait','api']);
  apiOrigin='http://'+(await compose(['port','api','8081'])).trim();
  await run('npm',['run','seed:web:build','--','--outDir',dist],undefined,{SEED_WEB_ORIGIN:origin,SEED_IDENTITY_ISSUER:env.SEED_IDENTITY_ORIGIN+'/realms/lightseed'});
  console.log(JSON.stringify({url:origin,username:'alice',password:'SeedBrowserTest9!',synthetic:true}));
  console.log('Fixture ready. Stop with Ctrl-C; only this fixture project and temporary files are removed.');
  await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});
} catch(error){console.error(error.message);process.exitCode=1;}
finally{
  server?.closeAllConnections();server?.close();
  if(started){
    try{await compose(['--profile','api','down','--volumes','--remove-orphans','--rmi','local']);}
    catch{console.error(`Cleanup failed for ${project}; fixture files retained at ${directory}.`);process.exit(1);}
  }
  await rm(directory,{recursive:true,force:true});
}
