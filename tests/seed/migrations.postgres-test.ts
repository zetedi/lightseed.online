import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { seedMigrationSql, type SeedMigration } from '../../src/domain/seedMigrations';
import { seedRuntimeSql } from '../../src/domain/seedRuntime';
import { createDatabase } from '../../seed/api/database.mjs';
import { createAuthenticator } from '../../seed/api/auth.mjs';
import { authFixture } from './auth-fixture.mjs';
import { createApi } from '../../seed/api/server.mjs';
import {seedVisionQuery} from '../../src/domain/seedVision.mjs';
import { createMediaStore } from '../../seed/api/media.mjs';
import { createRequire } from 'node:module';

// An isolated real cluster, never the developer's database. PostgreSQL's bin directory
// must be on PATH or explicitly supplied in SEED_PG_BIN. No network listener is opened.
const bin = (name: string) => process.env.SEED_PG_BIN ? join(process.env.SEED_PG_BIN, name) : name;
let directory: string;
let started = false;
let database = 0;
let environment: NodeJS.ProcessEnv;
const sources = readdirSync(resolve('seed/schema')).filter(n => n.endsWith('.sql'))
  .map(name => ({ name, sql: readFileSync(resolve('seed/schema', name), 'utf8') }));
const command = (name: string, args: string[], input?: string) => execFileSync(bin(name), args, {
  env: environment, encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'pipe'], timeout: 25_000,
});
const sql = (query: string) => command('psql', ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], query).trim();
const migrate = async (files: SeedMigration[] = sources) => {
  // A rejected history stops psql before consuming the large script. Use a file
  // so the actual SQL diagnostic is not masked by a parent-side EPIPE.
  const path=join(directory,'migration-test.sql');
  writeFileSync(path,await seedMigrationSql(files));
  try {return command('psql',['-X','-qAt','-v','ON_ERROR_STOP=1','-f',path]).trim();}
  finally {rmSync(path,{force:true});}
};

it('reads visions through author privacy and paginates newest-first without losing microsecond ties',async()=>{
  const db=await apiDatabase();const query=(params:Record<string,string>={})=>seedVisionQuery(new URLSearchParams(params));
  try {
    sql(`INSERT INTO visions VALUES
      ('public-a','{"visibility":"public","authorId":"alice","createdAt":"2026-10-25T12:00:00.123456Z","domain":"garden.example"}'),
      ('public-b','{"visibility":"public","authorId":"alice","createdAt":"2026-10-25T12:00:00.123455Z"}'),
      ('node','{"visibility":"node","authorId":"alice","createdAt":"2026-10-25T13:00:00Z"}'),
      ('private','{"visibility":"private","authorId":"alice","lifetreeId":"tree","createdAt":"2026-10-25T14:00:00Z"}'),
      ('legacy','{"authorId":"alice"}'),('malformed','{"visibility":"public","createdAt":"bad"}');
      INSERT INTO links(from_id,rel,to_id,lid) VALUES ('bob','keeper','tree','keeper'),('bob','joined','private','joined');
      INSERT INTO admins VALUES ('staff','{}');`);
    const first=await db.visions(query({limit:'1'}));expect(first.visions.map((v:any)=>v.id)).toEqual(['public-a']);
    expect(first.next).toContain('.123456Z');
    const second=await db.visions(query({limit:'1',after:first.next}));expect(second.visions.map((v:any)=>v.id)).toEqual(['public-b']);
    expect((await db.visions(query({limit:'1',after:second.next}))).visions[0].id).toBe('malformed');
    expect((await db.visions(query({id:'legacy'}))).vision.id).toBe('legacy');
    expect((await db.visions(query())).visions.map((v:any)=>v.id)).not.toContain('legacy');
    expect((await db.visions(query({id:'private'}),'bob')).vision).toBeNull();
    expect((await db.visions(query({joined:'bob'}),'bob')).visions).toEqual([]);
    expect((await db.visions(query({tree:'tree'}),'alice')).visions[0].id).toBe('private');
    expect((await db.visions(query(),'staff')).visions.map((v:any)=>v.id)).toContain('private');
    expect((await db.visions(query(),'bob')).visions.map((v:any)=>v.id)).toContain('node');
    expect((await db.visions(query({domain:'garden.example'}))).visions.map((v:any)=>v.id)).toEqual(['public-a']);
    sql(`INSERT INTO visions VALUES ('bad-author','{"visibility":"private","authorId":123}');`);
    expect((await db.visions(query({id:'bad-author'}),'123')).vision).toBeNull();
  } finally {await db.close();}
});

it('binds participation to tree keepers and filters participant lists through tree privacy',async()=>{
  const db=await apiDatabase();
  try {
    sql(`INSERT INTO lifetrees VALUES ('private','{"anchorUid":"alice","visibility":"private"}'),('public','{"anchorUid":"alice","visibility":"public"}'),('bed','{"anchorUid":"alice","treeType":"BED","visibility":"public"}'),('secret','{"anchorUid":"alice","treeType":"SECRET"}');
      INSERT INTO links(from_id,rel,to_id,lid) VALUES ('bob','keeper','public','keeper'),('carol','steward','public','steward');
      INSERT INTO admins VALUES ('staff','{}');`);
    const command={action:'link',from:'public',rel:'participant',to:'vision'};
    await expect(db.linkCommand('carol',command)).rejects.toMatchObject({code:'42501'});
    await expect(db.linkCommand('outsider',command)).rejects.toMatchObject({code:'42501'});
    await db.linkCommand('bob',command);
    const stamp=sql("SELECT lid || ':' || created_at::text FROM links WHERE rel='participant'");
    await db.linkCommand('alice',command);
    expect(sql("SELECT lid || ':' || created_at::text FROM links WHERE rel='participant'")).toBe(stamp);
    await db.linkCommand('alice',{...command,from:'private'});
    await db.linkCommand('alice',{...command,from:'bed'});
    for(const actor of ['alice','staff'])await expect(db.linkCommand(actor,{...command,from:'secret'})).rejects.toMatchObject({code:'42501'});
    const filter={id:null,domain:null,anchor:null,treeType:null,after:null,limit:100,participating:'vision'};
    expect((await db.trees(filter,null)).trees.map((item:any)=>item.id)).toEqual(['public']);
    expect((await db.trees(filter,'alice')).trees.map((item:any)=>item.id)).toEqual(['private','public']);
    expect((await db.trees(filter,'outsider')).trees.map((item:any)=>item.id)).toEqual(['public']);
    await expect(db.linkCommand('carol',{...command,action:'unlink'})).rejects.toMatchObject({code:'42501'});
    await db.linkCommand('bob',{...command,action:'unlink'});
    expect((await db.trees(filter,null)).trees).toEqual([]);
    sql(`INSERT INTO config VALUES ('staffHands','{"link_mint":false}');`);
    await expect(db.linkCommand('staff',command)).rejects.toMatchObject({code:'42501'});
    sql(`UPDATE config SET doc='{"link_mint":true}' WHERE id='staffHands';`);
    await db.linkCommand('staff',command);
    expect(sql("SELECT count(*) FROM links WHERE rel='member'")).toBe('0');
  } finally {await db.close();}
});

it('answers tree keepership requests atomically with invitations and keeps secret requests private',async()=>{
  const db=await apiDatabase(3);
  try {
    sql(`INSERT INTO lifetrees VALUES ('tree','{"anchorUid":"alice","visibility":"private"}'),('secret','{"anchorUid":"alice","treeType":"SECRET","visibility":"private"}');
      INSERT INTO links(from_id,rel,to_id,lid) VALUES ('steward','steward','tree','steward-seat');`);
    const request={action:'request_keeper',id:'tree'};
    await db.treeCommand('bob',request,null);
    const stamp=sql("SELECT lid || ':' || created_at::text FROM links WHERE rel='keeper_request'");
    await db.treeCommand('bob',request,null);
    expect(sql("SELECT lid || ':' || created_at::text FROM links WHERE rel='keeper_request'")).toBe(stamp);
    expect((await db.withSession('bob',(c:any)=>c.query("SELECT id FROM lifetrees WHERE id='tree'"))).rows).toEqual([]);
    const answer={action:'answer_keeper_request',id:'tree',member:'bob',role:'keeper'};
    await expect(db.treeCommand('outsider',answer,null)).rejects.toMatchObject({code:'42501'});
    await expect(db.treeCommand('steward',answer,null)).rejects.toMatchObject({code:'42501'});
    expect(sql("SELECT count(*) FROM links WHERE rel='keeper_request'")).toBe('1');
    const offered=await db.treeCommand('alice',answer,null);
    expect(offered.invite.status).toBe('pending');expect(offered.invite.invitedUserId).toBe('bob');
    expect(sql("SELECT count(*) FROM links WHERE rel IN ('keeper_request','keeper')")).toBe('0');
    await db.treeInviteCommand('bob',{action:'accept',id:offered.invite.id});
    expect(sql("SELECT count(*) FROM links WHERE from_id='bob' AND rel='keeper' AND to_id='tree'")).toBe('1');
    await db.treeCommand('carol',{action:'request_keeper',id:'secret'},null);
    expect(sql("SELECT count(*) FROM links WHERE to_id='secret'")).toBe('0');
    expect((await db.links({kind:'secretLinks',direction:'from',id:'carol',rel:null,after:null,limit:100},'carol')).links[0].rel).toBe('keeper_request');
    expect((await db.links({kind:'secretLinks',direction:'from',id:'outsider',rel:null,after:null,limit:100},'outsider')).links).toEqual([]);
    await expect(db.treeCommand('alice',{action:'answer_keeper_request',id:'secret',member:'carol',role:'guardian'},null)).rejects.toMatchObject({code:'LS019'});
    expect(sql("SELECT count(*) FROM secret_links WHERE rel='keeper_request'")).toBe('1');
    await db.treeCommand('carol',{action:'cancel_keeper_request',id:'secret'},null);
    expect(sql("SELECT count(*) FROM secret_links WHERE rel='keeper_request'")).toBe('0');
    await db.treeCommand('dave',request,null);
    await expect(db.treeCommand('steward',{action:'decline_keeper_request',id:'tree',member:'dave'},null)).rejects.toMatchObject({code:'42501'});
    await db.treeCommand('alice',{action:'decline_keeper_request',id:'tree',member:'dave'},null);
    expect(sql("SELECT count(*) FROM links WHERE rel='keeper_request'")).toBe('0');
  } finally {await db.close();}
});

it('places trees through community doors without changing their home or granting private-tree access',async()=>{
  const db=await apiDatabase(3);
  try {
    sql(`INSERT INTO lifetrees VALUES ('tree','{"anchorUid":"alice","treeType":"LIFETREE","visibility":"private","domain":"home.example","latestHash":"signed"}'),('secret','{"anchorUid":"alice","treeType":"SECRET","visibility":"private"}');
      INSERT INTO communities VALUES ('open','{"anchorUid":"bob","door":"open"}'),('closed','{"anchorUid":"bob","door":"closed"}');
      INSERT INTO links(from_id,rel,to_id,lid) VALUES ('carol','steward','tree','tree-carer'),('door','steward','closed','door-steward');
      INSERT INTO admins VALUES ('staff','{}');`);
    const original=sql("SELECT doc::text FROM lifetrees WHERE id='tree'");
    const command={action:'link',from:'tree',rel:'grows_in',to:'open'};
    await expect(db.linkCommand('outsider',command)).rejects.toMatchObject({code:'42501'});
    await db.linkCommand('carol',command);
    const birth=sql("SELECT lid || ':' || created_at::text FROM links WHERE rel='grows_in' AND to_id='open'");
    await db.linkCommand('alice',command);
    expect(sql("SELECT lid || ':' || created_at::text FROM links WHERE rel='grows_in' AND to_id='open'")).toBe(birth);
    await expect(db.linkCommand('alice',{...command,to:'closed'})).rejects.toMatchObject({code:'42501'});
    await db.linkCommand('door',{...command,to:'closed'});
    sql(`INSERT INTO lifetrees VALUES ('legacy','{"anchorUid":"bob"}'),('bed','{"treeType":"BED","visibility":"public"}');
      INSERT INTO links(from_id,rel,to_id,lid) VALUES ('legacy','grows_in','closed','legacy-garden'),('bed','grows_in','closed','bed-garden'),('secret','grows_in','closed','bad-secret-garden');`);
    const filter={id:null,domain:null,anchor:null,treeType:null,after:null,limit:100,garden:'closed'};
    expect((await db.trees(filter,null)).trees.map((item:any)=>item.id)).toEqual(['legacy']);
    expect((await db.trees(filter,'alice')).trees.map((item:any)=>item.id)).toEqual(['legacy','tree']);
    sql("DELETE FROM links WHERE rel='grows_in' AND from_id IN ('legacy','bed','secret')");
    expect((await db.withSession('door',(c:any)=>c.query("SELECT id FROM lifetrees WHERE id='tree'"))).rows).toEqual([]);
    for(const actor of ['alice','bob','staff'])await expect(db.linkCommand(actor,{...command,from:'secret'})).rejects.toMatchObject({code:'42501'});
    expect(sql("SELECT doc::text FROM lifetrees WHERE id='tree'")).toBe(original);
    await expect(db.linkCommand('outsider',{...command,action:'unlink'})).rejects.toMatchObject({code:'42501'});
    await db.linkCommand('bob',{...command,action:'unlink'});
    await db.linkCommand('alice',{...command,to:'closed',action:'unlink'});
    expect(sql("SELECT count(*) FROM links WHERE rel='grows_in'")).toBe('0');
    sql(`INSERT INTO config VALUES ('staffHands','{"garden_stand":false}');`);
    await expect(db.linkCommand('staff',command)).rejects.toMatchObject({code:'42501'});
    sql(`UPDATE config SET doc='{"garden_stand":true}' WHERE id='staffHands';`);
    await db.linkCommand('staff',{...command,to:'closed'});
    await expect(db.linkCommand('alice',{...command,to:'missing'})).rejects.toMatchObject({code:'22023'});
    expect(sql("SELECT count(*) FROM links WHERE rel='member'")).toBe('0');
  } finally {await db.close();}
});

it('keeps community attestations directional, keeper-owned and independent of membership authority',async()=>{
  const db=await apiDatabase(3);
  try {
    sql(`INSERT INTO communities VALUES ('garden','{"anchorUid":"alice","keeperUids":["forged"]}'),('orchard','{"anchorUid":"bob"}');
      INSERT INTO links(from_id,rel,to_id,lid) VALUES ('carol','keeper','garden','carol-seat'),('steward','steward','garden','steward-seat');
      INSERT INTO admins VALUES ('staff','{}');`);
    const command={action:'link',from:'garden',rel:'recognises',to:'orchard'};
    for(const actor of ['bob','steward','forged'])await expect(db.linkCommand(actor,command)).rejects.toMatchObject({code:'42501'});
    for(const rel of ['collaborates_with','recognises','shares_resources_with','accepts_coin_of']) {
      await db.linkCommand('carol',{...command,rel});
      expect(sql(`SELECT count(*) FROM links WHERE from_id='orchard' AND rel='${rel}' AND to_id='garden'`)).toBe('0');
    }
    const stamp=sql("SELECT lid || ':' || created_at::text FROM links WHERE from_id='garden' AND rel='recognises' AND to_id='orchard'");
    await Promise.all([db.linkCommand('alice',command),db.linkCommand('bob',{...command,from:'orchard',to:'garden'})]);
    expect(sql("SELECT lid || ':' || created_at::text FROM links WHERE from_id='garden' AND rel='recognises' AND to_id='orchard'")).toBe(stamp);
    await expect(db.linkCommand('alice',{...command,from:'orchard',to:'garden',action:'unlink'})).rejects.toMatchObject({code:'42501'});
    await db.linkCommand('alice',{...command,action:'unlink'});
    expect(sql("SELECT count(*) FROM links WHERE from_id='orchard' AND rel='recognises' AND to_id='garden'")).toBe('1');
    expect(sql("SELECT count(*) FROM links WHERE rel='member'")).toBe('0');
    await expect(db.linkCommand('alice',{...command,to:'missing'})).rejects.toMatchObject({code:'22023'});
    sql(`INSERT INTO config VALUES ('staffHands','{"link_mint":false}');`);
    await expect(db.linkCommand('staff',command)).rejects.toMatchObject({code:'42501'});
    sql(`UPDATE config SET doc='{"link_mint":true}' WHERE id='staffHands';`);
    await db.linkCommand('staff',command);
    await db.linkCommand('staff',{...command,action:'unlink'});
  } finally {await db.close();}
});

it('keeps graph care self-owned, private guarding invitation-only, and tenure stable on retries',async()=>{
  const db=await apiDatabase();const fixture=authFixture();const server=createApi(db,await createAuthenticator(fixture.config));
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();
  if(!address || typeof address==='string')throw new Error('missing_address');
  const post=(command:object)=>fetch(`http://127.0.0.1:${address.port}/v1/links/command`,{method:'POST',headers:{authorization:'Bearer '+fixture.token(),'content-type':'application/json'},body:JSON.stringify(command)});
  const command={action:'link',from:'alice',rel:'guardian',to:'open'};
  try {
    sql(`INSERT INTO lifetrees VALUES ('open','{"anchorUid":"bob","visibility":"public"}'),('private','{"anchorUid":"bob","visibility":"private"}'),('secret','{"anchorUid":"bob","visibility":"public","treeType":"SECRET"}');
      INSERT INTO communities VALUES ('community','{"anchorUid":"bob"}');
      INSERT INTO links(from_id,rel,to_id,lid) VALUES ('alice','steward','community','community-seat'),('alice','observer','open','observer-seat');`);
    expect((await post({...command,from:'bob'})).status).toBe(403);
    for(const to of ['private','secret','missing'])expect((await post({...command,to})).status).toBe(403);
    expect((await post({...command,rel:'keeper'})).status).toBe(400);
    expect((await post(command)).status).toBe(200);
    const original=sql("SELECT lid || ':' || created_at::text FROM links WHERE from_id='alice' AND rel='guardian' AND to_id='open'");
    await Promise.all([db.linkCommand('alice',command),db.linkCommand('alice',command)]);
    expect(sql("SELECT lid || ':' || created_at::text FROM links WHERE from_id='alice' AND rel='guardian' AND to_id='open'")).toBe(original);
    await expect(db.linkCommand('carol',{...command,action:'unlink'})).rejects.toMatchObject({code:'42501'});
    await db.linkCommand('bob',{...command,action:'unlink'});
    expect(sql("SELECT count(*) FROM links WHERE rel='guardian'")).toBe('0');
    await db.linkCommand('alice',{...command,rel:'observer',action:'unlink'});
    await expect(db.linkCommand('alice',{...command,rel:'steward',to:'community',action:'unlink'})).rejects.toMatchObject({code:'22023'});
    await db.linkCommand('alice',{...command,rel:'joined',to:'vision'});
    await db.linkCommand('alice',{...command,rel:'joined',to:'vision',action:'unlink'});
    await db.linkCommand('alice',{...command,to:'missing',action:'unlink'});
    expect(sql("SELECT count(*) FROM links WHERE rel='steward' AND to_id='community'")).toBe('1');
  } finally {server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await db.close();}
});

it('serves relation-wide public graphs and admits secret-circle reads only to authorized readers',async()=>{
  const db=await apiDatabase();const fixture=authFixture();const server=createApi(db,await createAuthenticator(fixture.config));
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();if(!address || typeof address==='string')throw new Error('missing_address');
  const origin=`http://127.0.0.1:${address.port}`;
  const get=(path:string,token?:string)=>fetch(origin+path,{headers:token?{authorization:'Bearer '+token}:{}});
  try {
    sql(`INSERT INTO lifetrees VALUES ('secret','{"treeType":"SECRET","anchorUid":"alice","visibility":"private"}'),('other','{"treeType":"SECRET","anchorUid":"bob"}');
      INSERT INTO secret_links(from_id,rel,to_id,lid) VALUES ('carol','keeper','secret','private-carol'),('dave','keeper','other','private-dave');
      INSERT INTO links(from_id,rel,to_id,lid) VALUES ('alice','guardian','one','public-one'),('bob','guardian','two','public-two'),('alice','joined','three','public-three');`);
    const first=await get('/v1/links?rel=guardian&limit=1');expect(first.status).toBe(200);
    const page=await first.json();expect(page.links).toHaveLength(1);expect(page.links[0].rel).toBe('guardian');
    const second=await (await get('/v1/links?rel=guardian&limit=1&after='+encodeURIComponent(page.next))).json();
    expect(second.links).toHaveLength(1);expect(second.links[0].from).toBe('bob');expect(second.next).toBeNull();
    expect((await get('/v1/secret-circle-links?to=secret')).status).toBe(401);
    const circle=await get('/v1/secret-circle-links?to=secret',fixture.token());expect(circle.status).toBe(200);
    expect((await circle.json()).links.map((link:any)=>link.from)).toEqual(['carol']);
    expect((await get('/v1/secret-circle-links?to=other',fixture.token())).status).toBe(403);
    expect((await get('/v1/secret-circle-links?to=missing',fixture.token())).status).toBe(403);
    const publicKeepers=await (await get('/v1/links?rel=keeper')).json();expect(publicKeepers.links).toEqual([]);
  } finally {server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await db.close();}
});

it('uploads authorized images and serves persistent public variants without allowing path replacement', async () => {
  const db = await apiDatabase();
  const mediaDirectory = mkdtempSync('/tmp/lightseed-media-http-');
  const media = await createMediaStore(mediaDirectory);
  const fixture = authFixture();
  const server = createApi(db, await createAuthenticator(fixture.config), { nodeDomain: null, media });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('missing_address');
  const origin = `http://127.0.0.1:${address.port}`;
  const sharp = createRequire(resolve('seed/package.json'))('sharp');
  const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#448855' } }).png().toBuffer();
  const upload = (path: string, body = bytes, token: string | null = fixture.token()) => fetch(origin + '/v1/media/upload', {
    method: 'POST', headers: { 'content-type': 'image/png', 'x-lightseed-media-path': path, ...(token ? { authorization: 'Bearer ' + token } : {}) }, body,
  });
  try {
    expect((await upload('users/alice/photo.png', bytes, null)).status).toBe(401);
    expect((await upload('users/bob/photo.png')).status).toBe(403);
    expect((await upload('users/alice/bad.png', Buffer.from('<svg/>'))).status).toBe(400);
    const result = await upload('users/alice/photo.png'); expect(result.status).toBe(201);
    const output = await result.json();
    const manifest = await db.mediaGet('users/alice/photo.png');
    await expect(db.profile('alice',{action:'set_picture',slot:'siteLogoUrl',path:'users/alice/photo.png'})).rejects.toMatchObject({code:'LS001'});
    const person = (await db.profile('alice',{displayName:'Alice'})).profile;
    sql("UPDATE users SET doc=doc || '{\"privateNote\":\"preserved\"}' WHERE id='alice';");
    const logo = await fetch(origin+'/v1/me/profile',{method:'POST',headers:{authorization:'Bearer '+fixture.token(),'content-type':'application/json'},
      body:JSON.stringify({action:'set_picture',slot:'siteLogoUrl',path:'users/alice/photo.png'})});
    expect(logo.status).toBe(200);
    expect((await logo.json()).profile).toMatchObject({lid:person.lid,siteLogoUrl:'/v1/media?path=users/alice/photo.png'});
    await expect(db.profile('alice',{action:'set_picture',slot:'siteHeroUrl',path:'users/alice/missing.png'})).rejects.toMatchObject({code:'22023'});
    expect((await db.profile('alice')).profile.siteLogoUrl).toBe('/v1/media?path=users/alice/photo.png');
    expect((await db.people({id:'alice',query:null,after:null,limit:50})).person).not.toHaveProperty('siteLogoUrl');
    sql("UPDATE users SET doc=doc || '{\"uid\":\"bob\"}' WHERE id='alice';");
    await expect(db.profile('alice',{action:'set_picture',slot:'siteLogoUrl',path:null})).rejects.toMatchObject({code:'23514'});
    sql("UPDATE users SET doc=doc || '{\"uid\":\"alice\"}' WHERE id='alice';");
    expect((await db.profile('alice',{action:'set_picture',slot:'siteLogoUrl',path:null})).profile.siteLogoUrl).toBe('');
    expect(sql("SELECT doc->>'privateNote' FROM users WHERE id='alice'")).toBe('preserved');
    sql(`INSERT INTO lifetrees VALUES ('pictured','{"anchorUid":"alice","visibility":"public","latestHash":"signed-head","latestGrowthUrl":"signed-picture"}');`);
    const attached = await db.treeCommand('alice', { action: 'set_pictures', id: 'pictured', paths: ['users/alice/photo.png'] }, null);
    expect(attached.tree.imageUrl).toBe('/v1/media?path=users/alice/photo.png');
    expect(attached.tree.imageUrls).toEqual([attached.tree.imageUrl]);
    expect(attached.tree.latestHash).toBe('signed-head'); expect(attached.tree.latestGrowthUrl).toBe('signed-picture');
    expect((await upload('users/alice/second.png')).status).toBe(201);
    const reordered = await fetch(origin + '/v1/trees/command', {method:'POST',headers:{authorization:'Bearer '+fixture.token(),'content-type':'application/json'},
      body:JSON.stringify({action:'set_pictures',id:'pictured',paths:['users/alice/second.png','users/alice/photo.png']})});
    expect(reordered.status).toBe(200);
    const arranged = (await reordered.json()).tree;
    expect(arranged.imageUrls).toEqual(['/v1/media?path=users/alice/second.png','/v1/media?path=users/alice/photo.png']);
    expect(arranged.imageUrl).toBe(arranged.imageUrls[0]);
    await expect(db.treeCommand('bob', { action: 'set_pictures', id: 'pictured', paths: [] }, null)).rejects.toMatchObject({code:'42501'});
    await expect(db.treeCommand('alice', { action: 'set_pictures', id: 'pictured', paths: ['users/alice/missing.png'] }, null)).rejects.toMatchObject({code:'22023'});
    expect(JSON.parse(sql("SELECT doc FROM lifetrees WHERE id='pictured'")).imageUrls).toEqual(arranged.imageUrls);
    const cleared = await db.treeCommand('alice', { action: 'set_pictures', id: 'pictured', paths: [] }, null);
    expect(cleared.tree.imageUrls).toEqual([]); expect(cleared.tree.imageUrl).toBe('');
    expect(cleared.tree.latestHash).toBe('signed-head'); expect(cleared.tree.latestGrowthUrl).toBe('signed-picture');
    const restarted = await createMediaStore(mediaDirectory);
    for (const [key, url] of [['primary', output.url], ['small', output.variants.small], ['large', output.variants.large]]) {
      const image = await fetch(origin + url); expect(image.status).toBe(200);
      expect(image.headers.get('cache-control')).toContain('immutable');
      expect(image.headers.get('content-type')).toBe(manifest[key].type);
      expect(Buffer.from(await image.arrayBuffer())).toEqual(await restarted.read(manifest[key]));
    }
    expect((await upload('users/alice/photo.png')).status).toBe(409);
    expect((await fetch(origin + '/v1/media?path=users/alice/missing.png')).status).toBe(404);
    expect((await fetch(origin + '/v1/media/upload')).headers.get('allow')).toBe('POST');
  } finally {
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
    await db.close(); rmSync(mediaDirectory, { recursive: true, force: true });
  }
});

beforeAll(() => {
  directory = mkdtempSync('/tmp/lightseed-postgres-');
  environment = { ...process.env };
  for (const key of Object.keys(environment)) if (key.startsWith('PG')) delete environment[key];
  Object.assign(environment, { PGHOST: directory, PGPORT: '55439', PGUSER: 'seedtest', PGDATABASE: 'postgres' });
  command('initdb', ['-D', join(directory, 'data'), '--auth=trust', '--username=seedtest', '--no-locale', '-E', 'UTF8']);
  // Admin remains local-only trust. Every provisioned runtime login must actually
  // authenticate with SCRAM, so these tests cannot pass with a broken password hash.
  writeFileSync(join(directory, 'data/pg_hba.conf'), 'local all seedtest trust\nlocal all all scram-sha-256\n');
  command('pg_ctl', ['-D', join(directory, 'data'), '-l', join(directory, 'server.log'), '-o', `-F -k ${directory} -h '' -p 55439`, '-w', 'start']);
  started = true;
  sql('CREATE ROLE seed_runtime_test NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;');
});
beforeEach(() => {
  environment.PGDATABASE = 'postgres';
  sql(`CREATE DATABASE migration_test_${++database};`);
  environment.PGDATABASE = `migration_test_${database}`;
});
afterAll(() => {
  if (started) command('pg_ctl', ['-D', join(directory, 'data'), '-m', 'immediate', '-w', 'stop']);
  if (directory) rmSync(directory, { recursive: true, force: true });
});

describe('real PostgreSQL migrations', () => {
  it('runs the actual local CLI against the isolated database', () => {
    execFileSync(process.execPath, [resolve('scripts/migrate-seed.mjs'), '--local'], {
      env: { ...environment, SEED_PSQL: bin('psql') }, encoding: 'utf8', timeout: 25_000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    expect(sql('SELECT count(*) FROM seed.schema_migrations;')).toBe(String(sources.length));
  });
  it('initializes the actual schema, then reruns without changing data or ledger timestamps', async () => {
    await migrate();
    const ledger = sql('SELECT name, checksum, applied_at FROM seed.schema_migrations ORDER BY name;');
    sql(`INSERT INTO lifetrees(id, doc) VALUES ('preserve-me', '{"name":"Oak"}');`);
    await migrate();
    expect(sql('SELECT name, checksum, applied_at FROM seed.schema_migrations ORDER BY name;')).toBe(ledger);
    expect(sql("SELECT doc->>'name' FROM lifetrees WHERE id = 'preserve-me';")).toBe('Oak');
    expect(sql('SELECT count(*) FROM seed.schema_migrations;')).toBe(String(sources.length));
  });
  it('adds later schema without replaying earlier migrations', async () => {
    await migrate();
    await migrate([...sources, { name: '900_example.sql', sql: 'CREATE TABLE example(id integer);' }]);
    expect(sql("SELECT to_regclass('public.example');")).toBe('example');
    expect(sql('SELECT count(*) FROM seed.schema_migrations;')).toBe(String(sources.length + 1));
  });
  it('rolls back earlier pending DDL and the ledger when a later migration fails', async () => {
    await migrate();
    await expect(migrate([...sources,
      { name: '900_example.sql', sql: 'CREATE TABLE example(id integer);' },
      { name: '901_failure.sql', sql: 'SELECT nonexistent_function();' },
    ])).rejects.toThrow();
    expect(sql("SELECT to_regclass('public.example');")).toBe('');
    expect(sql('SELECT count(*) FROM seed.schema_migrations;')).toBe(String(sources.length));
  });
  it('refuses changed or missing applied files', async () => {
    await migrate();
    await expect(migrate(sources.map((f, i) => i === 0 ? { ...f, sql: f.sql + '\n-- changed' } : f))).rejects.toThrow('history differs');
    await expect(migrate(sources.slice(1))).rejects.toThrow('history differs');
  });
  it('refuses holes in migration history', async () => {
    await migrate();
    sql("DELETE FROM seed.schema_migrations WHERE name = '001_collections.sql';");
    await expect(migrate()).rejects.toThrow('not a prefix');
  });
  it('refuses an untracked existing database without touching its data', async () => {
    sql("CREATE TABLE existing(value text); INSERT INTO existing VALUES ('keep');");
    await expect(migrate()).rejects.toThrow('no migration ledger');
    expect(sql('SELECT value FROM existing;')).toBe('keep');
    expect(sql("SELECT to_regclass('seed.schema_migrations');")).toBe('');
  });
  it('serializes simultaneous invocations so each migration runs exactly once', async () => {
    const batch = await seedMigrationSql([...sources, { name: '900_once.sql', sql: 'SELECT pg_sleep(0.2); CREATE TABLE once_only(id integer);' }]);
    const invoke = () => new Promise<void>((accept, reject) => {
      const child = spawn(bin('psql'), ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], { env: environment });
      let errors = '';
      child.stdout.resume();
      child.stderr.on('data', chunk => { errors += chunk; });
      child.on('error', reject);
      child.on('close', code => code === 0 ? accept() : reject(new Error(errors)));
      child.stdin.end(batch);
    });
    await Promise.all([invoke(), invoke()]);
    expect(sql('SELECT count(*) FROM seed.schema_migrations;')).toBe(String(sources.length + 1));
  });
});

// Deliberately grant DML in tests: absence of GRANT alone must not disguise missing RLS.
const asRuntime = (query: string, uid = '') => sql(`BEGIN;
  SET LOCAL ROLE seed_runtime_test;
  SELECT set_config('seed.uid', '${uid}', true);
  ${query}
  COMMIT;`);
const prepareAccess = async () => {
  await migrate();
  sql(`GRANT USAGE ON SCHEMA public, seed TO seed_runtime_test;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO seed_runtime_test;
    GRANT EXECUTE ON FUNCTION seed.can_read_tree(text,jsonb), seed.keeps_secret_tree(text) TO seed_runtime_test;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA seed TO seed_runtime_test;
    INSERT INTO users VALUES ('alice', '{"private":"profile"}');
    INSERT INTO lifetrees VALUES ('private-tree', '{"visibility":"private"}');
    INSERT INTO secret_links(from_id, rel, to_id, lid) VALUES
      ('alice', 'keeper', 'secret-tree', 'seat-a'), ('bob', 'keeper', 'secret-tree', 'seat-b');`);
};

describe('non-owner database access', () => {
  it('has RLS on every collection and denies unported private reads and writes', async () => {
    await prepareAccess();
    expect(sql("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity;")).toBe('0');
    // The document law (050–052): a private profile is read by its own hand alone; a stranger sees none.
    expect(asRuntime('SELECT count(*) FROM users;', 'alice')).toBe('alice\n1');
    expect(asRuntime('SELECT count(*) FROM users;', 'bob')).toBe('bob\n0');
    expect(asRuntime('SELECT count(*) FROM lifetrees;', 'alice')).toBe('alice\n0');
    expect(() => asRuntime("INSERT INTO users VALUES ('mallory', '{}');", 'alice')).toThrow(/row-level security/);
    expect(() => asRuntime('TRUNCATE users;', 'alice')).toThrow(/permission denied/);
    expect(() => asRuntime('SELECT * FROM seed.schema_migrations;', 'alice')).toThrow(/permission denied/);
    expect(() => asRuntime('CREATE TABLE public.forbidden(id text);', 'alice')).toThrow(/permission denied/);
  });
  it('keeps secret seats scoped to the asking hand and rejects client seat writes', async () => {
    await prepareAccess();
    expect(asRuntime('SELECT from_id FROM secret_links;', 'alice')).toBe('alice\nalice');
    expect(asRuntime('SELECT count(*) FROM secret_links;')).toBe('0');
    expect(() => asRuntime("INSERT INTO secret_links(from_id,rel,to_id,lid) VALUES ('alice','keeper','other','x');", 'alice')).toThrow(/row-level security/);
    asRuntime("DELETE FROM secret_links; UPDATE secret_links SET lid='changed';", 'alice');
    expect(sql("SELECT count(*) FROM secret_links WHERE lid IN ('seat-a','seat-b');")).toBe('2');
  });
  it('allows only own joined inserts, denies forged or anonymous hands and guardian keys', async () => {
    await prepareAccess();
    const insert = (from: string, rel: string) => `INSERT INTO links(from_id,rel,to_id,lid) VALUES ('${from}','${rel}','private-tree','test');`;
    asRuntime(insert('alice', 'joined'), 'alice');
    expect(asRuntime('SELECT id FROM links;')).toBe('alice__joined__private-tree');
    for (const [from, rel, uid] of [['bob','joined','alice'], ['alice','joined',''], ['alice','guardian','alice'], ['alice','keeper','alice']]) {
      expect(() => asRuntime(insert(from, rel), uid)).toThrow(/row-level security/);
    }
    asRuntime("UPDATE links SET lid='changed'; DELETE FROM links;", 'bob');
    expect(sql('SELECT lid FROM links;')).toBe('test');
    asRuntime('DELETE FROM links;', 'alice');
    expect(sql('SELECT count(*) FROM links;')).toBe('0');
  });
  it('preserves every permanent link even against its own subject', async () => {
    await prepareAccess();
    const rels = ['invited_by', 'welcomed_by', 'party', 'collaborates_with', 'recognises', 'shares_resources_with', 'accepts_coin_of', 'descends_from'];
    for (const rel of rels) sql(`INSERT INTO links(from_id,rel,to_id,lid) VALUES ('alice','${rel}','target','test');`);
    asRuntime('DELETE FROM links;', 'alice');
    expect(sql('SELECT count(*) FROM links;')).toBe(String(rels.length));
  });
  it('clears transaction-local identity before reusing a connection', async () => {
    await prepareAccess();
    expect(sql(`SET ROLE seed_runtime_test;
      BEGIN; SELECT set_config('seed.uid','alice',true); SELECT count(*) FROM secret_links; COMMIT;
      BEGIN; SELECT coalesce(seed.uid(),'anonymous'); SELECT count(*) FROM secret_links; COMMIT;`)).toBe('alice\n1\nanonymous\n0');
  });
});

const provision = (output: string) => execFileSync(process.execPath,
  [resolve('scripts/provision-seed.mjs'), '--local', output], {
    env: { ...environment, SEED_PSQL: bin('psql') }, encoding: 'utf8', timeout: 25_000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
const runtimeCredentials = (file: string) => Object.fromEntries(readFileSync(file, 'utf8').split('\n')
  .filter(line => /^PG(USER|PASSWORD)=/.test(line)).map(line => line.split('=')));
const runtimeQuery = (credentials: Record<string, string>, query: string) => execFileSync(bin('psql'),
  ['-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], { env: { ...environment, ...credentials },
    encoding: 'utf8', input: query, stdio: ['pipe', 'pipe', 'pipe'], timeout: 25_000 }).trim();

describe('provisioned runtime account', () => {
  it('authenticates via SCRAM with only the implemented graph privileges', async () => {
    await migrate();
    const output = join(directory, `runtime-${database}.env`);
    const message = provision(output);
    const credentials = runtimeCredentials(output);
    expect((statSync(output).mode & 0o777)).toBe(0o600);
    expect(message).not.toContain(credentials.PGPASSWORD);
    expect(runtimeQuery(credentials, 'SELECT current_user;')).toBe(credentials.PGUSER);
    expect(() => runtimeQuery({ ...credentials, PGPASSWORD: 'wrong-password' }, 'SELECT 1;')).toThrow(/password authentication failed/);
    expect(sql(`SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls OR rolinherit FROM pg_roles WHERE rolname='${credentials.PGUSER}';`)).toBe('f');
    expect(sql(`SELECT count(*) FROM pg_auth_members WHERE member=(SELECT oid FROM pg_roles WHERE rolname='${credentials.PGUSER}');`)).toBe('0');
    sql("INSERT INTO secret_links(from_id,rel,to_id,lid) VALUES ('alice','keeper','tree','seat');");
    expect(runtimeQuery(credentials, 'SELECT count(*) FROM secret_links;')).toBe('0');
    expect(runtimeQuery(credentials, "BEGIN; SELECT set_config('seed.uid','alice',true); SELECT from_id FROM secret_links; COMMIT;")).toBe('alice\nalice');
    runtimeQuery(credentials, "BEGIN; SET LOCAL seed.uid='alice'; INSERT INTO links(from_id,rel,to_id,lid) VALUES ('alice','joined','vision','link'); COMMIT;");
    expect(runtimeQuery(credentials, 'SELECT id FROM links;')).toBe('alice__joined__vision');
    for (const forbidden of [
      'SELECT * FROM seed.identity_bindings;', 'SELECT * FROM seed.schema_migrations;',
      'TRUNCATE links;', "UPDATE links SET lid='changed';",
      'CREATE TABLE public.forbidden(id text);', 'SET ROLE seedtest;',
      'CREATE ROLE forbidden;', 'ALTER TABLE links DISABLE ROW LEVEL SECURITY;',
      "INSERT INTO secret_links(from_id,rel,to_id,lid) VALUES ('alice','keeper','other','seat');",
      "BEGIN; SET LOCAL seed.uid='alice'; INSERT INTO links(from_id,rel,to_id,lid) VALUES ('alice','guardian','private','link');",
    ]) expect(() => runtimeQuery(credentials, forbidden)).toThrow();
    runtimeQuery(credentials, "BEGIN; SET LOCAL seed.uid='alice'; DELETE FROM links; COMMIT;");
    expect(sql('SELECT count(*) FROM links;')).toBe('0');
  });
  it('refuses overwrite or existing roles without rotating or broadening credentials', async () => {
    await migrate();
    const output = join(directory, `runtime-${database}.env`);
    provision(output);
    const before = readFileSync(output, 'utf8');
    const credentials = runtimeCredentials(output);
    const count = sql("SELECT count(*) FROM pg_roles WHERE rolname LIKE 'lightseed_api_%';");
    expect(() => provision(output)).toThrow(/already exists/);
    expect(readFileSync(output, 'utf8')).toBe(before);
    expect(sql("SELECT count(*) FROM pg_roles WHERE rolname LIKE 'lightseed_api_%';")).toBe(count);
    const verifier = sql(`SELECT rolpassword FROM pg_authid WHERE rolname='${credentials.PGUSER}';`);
    expect(() => sql(seedRuntimeSql(credentials.PGUSER, verifier)!)).toThrow(/already exists/);
    expect(runtimeQuery(credentials, 'SELECT current_user;')).toBe(credentials.PGUSER);
  });
  it('retains credentials for recovery on database failure without leaving a role behind', () => {
    const output = join(directory, `runtime-${database}.env`);
    expect(() => provision(output)).toThrow(/Credentials retained/);
    const credentials = runtimeCredentials(output);
    expect(sql(`SELECT count(*) FROM pg_roles WHERE rolname='${credentials.PGUSER}';`)).toBe('0');
    expect((statSync(output).mode & 0o777)).toBe(0o600);
  });
  it('refuses provisioning if a later migration leaves a table without RLS', async () => {
    await migrate();
    sql('CREATE TABLE unprotected(id text);');
    const output = join(directory, `runtime-${database}.env`);
    expect(() => provision(output)).toThrow();
    const credentials = runtimeCredentials(output);
    expect(sql(`SELECT count(*) FROM pg_roles WHERE rolname='${credentials.PGUSER}';`)).toBe('0');
  });
});

const apiDatabase = async (max = 1) => {
  await migrate();
  const output = join(directory, `runtime-${database}.env`);
  provision(output);
  const credentials = runtimeCredentials(output);
  return createDatabase({ host: directory, port: 55439, database: environment.PGDATABASE,
    user: credentials.PGUSER, password: credentials.PGPASSWORD, max });
};

describe('independent API database sessions', () => {
  it('clears identities and session-wide contamination on a reused connection, and rolls back failures', async () => {
    const db = await apiDatabase();
    sql("INSERT INTO secret_links(from_id,rel,to_id,lid) VALUES ('alice','keeper','tree','seat');");
    try {
      const first = await db.withSession('alice', async (c: any) => {
        const result = await c.query('SELECT seed.uid() AS uid, pg_backend_pid() AS pid, (SELECT count(*) FROM public.secret_links)::int AS seats');
        await c.query("SELECT set_config('seed.uid','bob',false)");
        return result.rows[0];
      });
      expect(first).toMatchObject({ uid: 'alice', seats: 1 });
      const next = await db.withSession(null, async (c: any) => (await c.query('SELECT seed.uid() AS uid, pg_backend_pid() AS pid, (SELECT count(*) FROM public.secret_links)::int AS seats')).rows[0]);
      expect(next).toEqual({ uid: null, pid: first.pid, seats: 0 });
      await expect(db.withSession('alice', async (c: any) => {
        await c.query("INSERT INTO public.links(from_id,rel,to_id,lid) VALUES ('alice','joined','vision','link')");
        throw new Error('simulated_failure');
      })).rejects.toThrow('simulated_failure');
      expect(sql('SELECT count(*) FROM links;')).toBe('0');
      expect(await db.withSession(null, async (c: any) => (await c.query('SELECT seed.uid() AS uid')).rows[0].uid)).toBeNull();
    } finally { await db.close(); }
  });
  it('keeps simultaneous callers isolated across pooled connections', async () => {
    const db = await apiDatabase(2);
    try {
      const identities = ['alice', 'bob', null, 'carol', null, 'dave'];
      const actual = await Promise.all(identities.map(uid => db.withSession(uid, async (c: any) => {
        await c.query('SELECT pg_sleep(0.01)');
        return (await c.query('SELECT seed.uid() AS uid')).rows[0].uid;
      })));
      expect(actual).toEqual(identities);
    } finally { await db.close(); }
  });
  it('refuses a database-owner connection and fails closed if RLS is later disabled', async () => {
    const db = await apiDatabase();
    const owner = createDatabase({ host: directory, port: 55439, database: environment.PGDATABASE, user: 'seedtest' });
    try {
      await expect(owner.ready()).rejects.toThrow('unsafe_database_role');
      await db.ready();
      sql('ALTER TABLE public.links DISABLE ROW LEVEL SECURITY;');
      await expect(db.ready()).rejects.toThrow('unsafe_database_role');
    } finally { await Promise.all([db.close(), owner.close()]); }
  });
  it('serves bounded public links over HTTP without accepting client identity or leaking database failures', async () => {
    const db = await apiDatabase();
    sql(`INSERT INTO links(from_id,rel,to_id,lid,doc) VALUES
      ('alice','joined','vision','a','{"from":"forged","rel":"keeper"}'),
      ('bob','joined','vision','b','{}');
      INSERT INTO secret_links(from_id,rel,to_id,lid) VALUES ('alice','keeper','vision','secret');`);
    const server = createApi(db);
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing_address');
    const base = `http://127.0.0.1:${address.port}`;
    try {
      expect((await fetch(base + '/readyz')).status).toBe(200);
      const first = await fetch(base + '/v1/links?to=vision&limit=1', { headers: { 'X-User-Id': 'alice' } });
      expect(first.headers.get('Cache-Control')).toBe('no-store');
      const page = await first.json();
      expect(page.links).toHaveLength(1);
      expect(page.links[0]).toMatchObject({ from: 'alice', rel: 'joined' });
      const second = await (await fetch(base + '/v1/links?to=vision&limit=1&after=' + encodeURIComponent(page.next))).json();
      expect(second.links).toHaveLength(1);
      expect(second.links[0].from).toBe('bob');
      expect(second.next).toBeNull();
      expect((await fetch(base + '/v1/links?to=vision&uid=alice')).status).toBe(400);
      expect((await fetch(base + '/v1/links?to=vision', { headers: { authorization: 'Bearer forged' } })).status).toBe(401);
      expect((await fetch(base + '/v1/secret-links?to=vision')).status).toBe(404);
      expect((await fetch(base + '/v1/links', { method: 'POST' })).status).toBe(405);
      expect((await (await fetch(base + '/v1/links?to=' + encodeURIComponent("'; DROP TABLE links; --"))).json()).links).toEqual([]);
      await db.close();
      const failed = await fetch(base + '/readyz');
      expect(failed.status).toBe(503);
      expect(await failed.json()).toEqual({ error: 'database_unavailable' });
      expect((await fetch(base + '/healthz')).status).toBe(200);
    } finally {
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
      // Pool.end() may only be called once.
      try { await db.close(); } catch { /* already closed above */ }
    }
  });
});


describe('authenticated independent HTTP features', () => {
  it('binds verified subjects to RLS and never leaks another holder’s private seats', async () => {
    const db = await apiDatabase(1);
    const fixture = authFixture();
    const authenticate = await createAuthenticator(fixture.config);
    sql(`INSERT INTO secret_links(from_id,rel,to_id,lid,doc) VALUES
      ('alice','keeper','a','seat-a','{"from":"bob"}'),
      ('alice','keeper','b','seat-b','{}'),
      ('bob','keeper','c','seat-c','{}');`);
    const server = createApi(db, authenticate);
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing_address');
    const base = `http://127.0.0.1:${address.port}`;
    const get = (path: string, token?: string) => fetch(base + path, { headers: token ? { authorization: 'Bearer ' + token, 'X-User-Id': 'bob' } : {} });
    try {
      const alice = fixture.token({ uid: 'bob' });
      expect(await (await get('/v1/me', alice)).json()).toEqual({ uid: 'alice' });
      const first = await (await get('/v1/me/secret-links?limit=1', alice)).json();
      expect(first.links).toHaveLength(1);
      expect(first.links[0]).toMatchObject({ from: 'alice', to: 'a' });
      const last = await (await get('/v1/me/secret-links?limit=1&after=' + encodeURIComponent(first.next), alice)).json();
      expect(last.links[0]).toMatchObject({ from: 'alice', to: 'b' });
      expect(last.next).toBeNull();
      const bob = await (await get('/v1/me/secret-links', fixture.token({ sub: 'issuer-bob' }))).json();
      expect(bob.links).toHaveLength(1);
      expect(bob.links[0].from).toBe('bob');
      expect((await get('/v1/me/secret-links')).status).toBe(401);
      expect((await get('/v1/me', fixture.token({ sub: 'alice' }))).status).toBe(401);
      expect((await get('/v1/me', fixture.token({ exp: 1 }))).status).toBe(401);
      expect((await get('/v1/me/secret-links?from=bob', alice)).status).toBe(400);
      expect((await get('/v1/me?uid=bob', alice)).status).toBe(400);
      expect(await db.withSession(null, async (c: any) => (await c.query('SELECT count(*)::int AS n FROM public.secret_links')).rows[0].n)).toBe(0);
    } finally {
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
      await db.close();
    }
  });
});

describe('independent local profiles', () => {
  it('creates once under concurrency, preserves identity/signing fields, and keeps private tables closed', async () => {
    const db = await apiDatabase(3);
    try {
      expect(await db.profile('alice')).toEqual({ profile: null, email: null });
      const results = await Promise.all(['Alice', 'Willow', 'Alice Willow'].map(displayName => db.profile('alice', { displayName })));
      const lids = new Set(results.map(r => r.profile.lid));
      expect(lids.size).toBe(1);
      expect(results[0].profile.lid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(sql('SELECT count(*) FROM persons;')).toBe('1');
      expect(sql('SELECT count(*) FROM users;')).toBe('1');
      sql(`UPDATE persons SET doc=doc || '{"publicKeyPem":"preserved-key","signingEpochId":"epoch","history":"keep"}'::jsonb WHERE id='alice';
        UPDATE users SET doc=doc || '{"private":"keep","invitesRemaining":0}'::jsonb WHERE id='alice';`);
      const updated = await db.profile('alice', { displayName: 'New Name' });
      expect(updated.profile.lid).toBe(results[0].profile.lid);
      expect(sql("SELECT doc->>'publicKeyPem' || ':' || (doc->>'signingEpochId') || ':' || (doc->>'history') FROM persons WHERE id='alice';")).toBe('preserved-key:epoch:keep');
      expect(sql("SELECT doc->>'private' || ':' || (doc->>'invitesRemaining') FROM users WHERE id='alice';")).toBe('keep:0');
      expect(updated.profile).not.toHaveProperty('publicKeyPem');
      expect(await db.profile('bob')).toEqual({ profile: null, email: null });
      expect(sql('SELECT count(*) FROM admins;')).toBe('0');
      // The document law: a profile is read by its own hand (RLS), never written through the table.
      expect((await db.withSession('alice', (c: any) => c.query('SELECT id FROM public.users'))).rows.map((r: any) => r.id)).toEqual(['alice']);
      expect((await db.withSession('bob', (c: any) => c.query('SELECT id FROM public.users'))).rows).toHaveLength(0);
      await expect(db.withSession('alice', (c: any) => c.query("UPDATE public.persons SET doc='{}'"))).rejects.toThrow(/permission denied/);
      await expect(db.withSession(null, (c: any) => c.query("SELECT seed.save_profile('Bad', '01900000-0000-7000-8000-000000000001')"))).rejects.toThrow(/Authentication required/);
    } finally { await db.close(); }
  });
  it('rolls back conflicts and refuses to rewrite imported identities', async () => {
    const db = await apiDatabase();
    try {
      sql(`INSERT INTO persons VALUES ('alice','{"uid":"other","lid":"01900000-0000-7000-8000-000000000001","displayName":"Keep"}');`);
      await expect(db.profile('alice', { displayName: 'Changed' })).rejects.toThrow(/Identity needs review/);
      expect(sql("SELECT doc->>'displayName' FROM persons WHERE id='alice';")).toBe('Keep');
      expect(sql('SELECT count(*) FROM users;')).toBe('0');
      sql(`INSERT INTO users VALUES ('bob','[]');`);
      await expect(db.profile('bob', { displayName: 'Bob' })).rejects.toThrow(/Profile needs review/);
      expect(sql("SELECT count(*) FROM persons WHERE id='bob';")).toBe('0');
    } finally { await db.close(); }
  });
  it('rolls back late write failures and refuses missing function grants', async () => {
    const db = await apiDatabase();
    try {
      sql(`CREATE FUNCTION seed.reject_profile_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test write failure'; END $$;
        CREATE TRIGGER reject_profile_test BEFORE INSERT ON users FOR EACH ROW EXECUTE FUNCTION seed.reject_profile_test();`);
      await expect(db.profile('carol', { displayName: 'Carol' })).rejects.toThrow(/test write failure/);
      expect(sql("SELECT count(*) FROM persons WHERE id='carol';")).toBe('0');
      sql('GRANT USAGE ON SCHEMA seed TO seed_runtime_test;');
      expect(() => asRuntime('SELECT seed.my_profile();', 'alice')).toThrow(/permission denied/);
      const role = await db.withSession(null, async (c: any) => (await c.query('SELECT current_user AS name')).rows[0].name);
      expect(role).toMatch(/^lightseed_api_[a-f0-9]{16}$/);
      sql(`REVOKE EXECUTE ON FUNCTION seed.save_profile(text,text) FROM ${role};`);
      await expect(db.ready()).rejects.toThrow('missing_profile_permissions');
    } finally { await db.close(); }
  });
  it('accepts only bounded authenticated profile JSON over HTTP', async () => {
    const db = await apiDatabase(); const fixture = authFixture();
    const server = createApi(db, await createAuthenticator(fixture.config));
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address(); if (!address || typeof address === 'string') throw new Error('missing_address');
    const base = `http://127.0.0.1:${address.port}`;
    const token = fixture.token();
    const save = (body: string, contentType = 'application/json', authorization = 'Bearer ' + token) => fetch(base + '/v1/me/profile', {
      method: 'POST', body, headers: { 'content-type': contentType, authorization },
    });
    try {
      expect((await save('{"displayName":"Alice"}', 'application/json', '')).status).toBe(401);
      expect((await save('{"displayName":"Alice","uid":"bob"}')).status).toBe(400);
      expect((await save('{')).status).toBe(400);
      expect((await save('{}', 'text/plain')).status).toBe(415);
      expect((await save(' '.repeat(2049))).status).toBe(413);
      const saved = await save('{"displayName":"  Alice   Willow  "}'); expect(saved.status).toBe(200);
      const body = await saved.json(); expect(body.profile).toMatchObject({ uid: 'alice', displayName: 'Alice Willow' }); expect(body.email).toBeNull(); // no verified address rode the token
      const own = await fetch(base + '/v1/me/profile', { headers: { authorization: 'Bearer ' + token } });
      expect(await own.json()).toEqual(body);
      const other = await fetch(base + '/v1/me/profile', { headers: { authorization: 'Bearer ' + fixture.token({ sub: 'issuer-bob' }) } });
      expect(await other.json()).toEqual({ profile: null, email: null });
    } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await db.close(); }
  });
});

describe('independent community browsing', () => {
  it('reads public community documents with bounded pages and canonical IDs over HTTP', async () => {
    const db = await apiDatabase();
    sql(`INSERT INTO communities VALUES ('a', '{"id":"forged","name":"Garden","door":"invite"}'),
      ('b', '{"name":"Forest","door":"closed"}'), ('c', '{"name":"River","door":"open"}');
      INSERT INTO users VALUES ('private', '{"secret":"never public"}');`);
    const server = createApi(db);
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing_address');
    const base = `http://127.0.0.1:${address.port}`;
    try {
      await db.ready();
      const first = await (await fetch(base + '/v1/communities?limit=2')).json();
      expect(first).toEqual({ communities: [
        { id: 'a', name: 'Garden', door: 'invite' }, { id: 'b', name: 'Forest', door: 'closed' },
      ], next: 'b' });
      expect(await (await fetch(base + '/v1/communities?limit=2&after=' + first.next)).json())
        .toEqual({ communities: [{ id: 'c', name: 'River', door: 'open' }], next: null });
      expect(await (await fetch(base + '/v1/communities?id=a')).json())
        .toEqual({ community: { id: 'a', name: 'Garden', door: 'invite' } });
      const missing = await fetch(base + '/v1/communities?id=' + encodeURIComponent("'; DROP TABLE communities; --"));
      expect(missing.status).toBe(404);
      expect(await missing.json()).toEqual({ community: null });
      expect((await fetch(base + '/v1/communities?collection=users')).status).toBe(400);
      expect((await fetch(base + '/v1/communities', { method: 'POST' })).status).toBe(405);
      expect((await fetch(base + '/v1/communities', { headers: { authorization: 'Bearer forged' } })).status).toBe(401);
      expect((await db.withSession(null, (c: any) => c.query('SELECT * FROM users'))).rows).toHaveLength(0);
      await expect(db.withSession('alice', (c: any) => c.query("INSERT INTO communities VALUES ('forged','{}')"))).rejects.toThrow(/permission denied/);
      const role = await db.withSession(null, async (c: any) => (await c.query('SELECT current_user AS role')).rows[0].role);
      sql(`REVOKE SELECT ON communities FROM ${role};`);
      await expect(db.ready()).rejects.toThrow(/permission denied/);
    } finally {
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
      await db.close();
    }
  });
  it('keeps community writes denied even if a role accidentally receives DML grants', async () => {
    await prepareAccess();
    sql(`INSERT INTO communities VALUES ('garden', '{"name":"Garden"}');`);
    expect(asRuntime('SELECT id FROM communities;')).toBe('garden');
    expect(() => asRuntime("INSERT INTO communities VALUES ('bad', '{}');", 'alice')).toThrow(/row-level security/);
    asRuntime("UPDATE communities SET doc='{}'; DELETE FROM communities;", 'alice');
    expect(sql("SELECT doc->>'name' FROM communities WHERE id='garden';")).toBe('Garden');
  });
});

describe('independent community commands', () => {
  it('founds atomically with a stable identity, enforces capacity, and preserves protected fields on edit', async () => {
    const db = await apiDatabase(3);
    const command = (uid: string, input: object) => db.communityCommand(uid, input, 'node.example');
    try {
      await expect(command('alice', { action: 'create', name: 'Garden', domain: 'garden.example', door: 'open' })).rejects.toThrow('Profile required');
      await db.profile('alice', { displayName: 'Alice' });
      await db.profile('bob', { displayName: 'Bob' });
      sql(`INSERT INTO config VALUES ('limits', '{"maxNodeCommunities":1}');`);
      const attempts = await Promise.allSettled(['Garden', 'Forest'].map(name => command('alice', { action: 'create', name, domain: 'garden.example', door: 'open' })));
      expect(attempts.filter(r => r.status === 'fulfilled')).toHaveLength(1);
      expect(attempts.filter(r => r.status === 'rejected')).toHaveLength(1);
      const result = attempts.find(r => r.status === 'fulfilled');
      if (!result || result.status !== 'fulfilled') throw new Error('missing_community');
      const { community } = result.value;
      expect(community).toMatchObject({ anchorUid: 'alice', bornOn: 'node.example', formation: 'manual' });
      expect(community.lid).toBe(community.id);
      expect(sql("SELECT doc->>'invitesRemaining' FROM users WHERE id='alice';")).toBe('144');
      expect(sql('SELECT count(*) FROM admins;')).toBe('0');
      const edit = { action: 'edit', id: community.id, name: 'Renamed', domain: 'garden.example', door: 'invite' };
      await expect(command('bob', edit)).rejects.toThrow('Forbidden');
      sql(`INSERT INTO links(from_id,rel,to_id,lid) VALUES ('bob','keeper','${community.id}','keeper');`);
      const updated = (await command('bob', edit)).community;
      expect(updated).toMatchObject({ name: 'Renamed', door: 'invite', lid: community.lid,
        anchorUid: 'alice', bornOn: 'node.example', createdAt: community.createdAt });
      await expect(command('bob', { ...edit, anchorUid: 'bob' })).rejects.toThrow('Invalid command');
      await expect(db.withSession(null, (c: any) => c.query("SELECT seed.community_command('{}',null,null)"))).rejects.toThrow('Authentication required');
    } finally { await db.close(); }
  });
  it('serializes doors and membership, permits delegated answers, and removes steward power on departure', async () => {
    const db = await apiDatabase(3);
    const command = (uid: string, action: string, extra = {}) => db.communityCommand(uid, { action, id: 'garden', ...extra }, null);
    try {
      for (const uid of ['alice', 'bob', 'carol', 'outsider']) await db.profile(uid, { displayName: uid });
      sql(`INSERT INTO communities VALUES ('garden', '{"anchorUid":"alice","door":"invite"}');`);
      await expect(command('bob', 'join')).rejects.toThrow('Door refused');
      await Promise.all([command('bob', 'request'), command('bob', 'request')]);
      expect(sql("SELECT count(*) FROM links WHERE rel='join_request';")).toBe('1');
      await expect(command('outsider', 'accept', { member: 'bob' })).rejects.toThrow('Forbidden');
      sql(`INSERT INTO links(from_id,rel,to_id,lid) VALUES ('carol','steward','garden','steward');`);
      expect(await command('carol', 'accept', { member: 'bob' })).toMatchObject({ joined: true, requested: false });
      expect(await command('carol', 'accept', { member: 'bob' })).toMatchObject({ joined: true });
      await expect(command('carol', 'edit', { name: 'Taken', domain: 'garden.example', door: 'open' })).rejects.toThrow('Forbidden');
      sql(`INSERT INTO links(from_id,rel,to_id,lid) VALUES ('bob','steward','garden','steward-b');`);
      expect(await command('bob', 'leave')).toMatchObject({ joined: false });
      expect(sql("SELECT count(*) FROM links WHERE from_id='bob';")).toBe('0');
      await expect(command('alice', 'leave')).rejects.toThrow('Keeper must resign first');
      sql(`INSERT INTO links(from_id,rel,to_id,lid) VALUES ('bob','keeper','garden','keeper-b');`);
      await expect(command('carol', 'remove', { member: 'bob' })).rejects.toThrow('Keeper must resign first');
      sql(`UPDATE communities SET doc=doc || '{"door":"closed"}'::jsonb;`);
      await expect(command('outsider', 'request')).rejects.toThrow('Door refused');
      sql(`UPDATE communities SET doc=doc || '{"door":"open"}'::jsonb;`);
      expect(await command('outsider', 'join')).toMatchObject({ joined: true, requested: false });
      expect(await command('carol', 'remove', { member: 'outsider' })).toMatchObject({ joined: false });
      expect(sql("SELECT count(*) FROM links WHERE rel='keeper';")).toBe('1');
      await db.withSession('bob', (c: any) => c.query("DELETE FROM links WHERE from_id='bob' AND rel='keeper'"));
      expect(sql("SELECT count(*) FROM links WHERE rel='keeper';")).toBe('1');
    } finally { await db.close(); }
  });
});

describe('community command HTTP boundary', () => {
  it('uses the verified account and server birthplace, with explicit refusals and rollback', async () => {
    const db = await apiDatabase(); const fixture = authFixture();
    const server = createApi(db, await createAuthenticator(fixture.config), { nodeDomain: 'node.example' });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing_address');
    const base = `http://127.0.0.1:${address.port}`;
    const send = (input: object, token = fixture.token()) => fetch(base + '/v1/communities/command', {
      method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify(input),
    });
    try {
      const input = { action: 'create', name: 'Garden', domain: 'garden.example', door: 'invite' };
      expect((await send(input)).status).toBe(409);
      await db.profile('alice', { displayName: 'Alice' });
      await db.profile('bob', { displayName: 'Bob' });
      expect((await send({ ...input, anchorUid: 'bob' })).status).toBe(400);
      const created = await send(input); expect(created.status).toBe(200);
      const { community } = await created.json();
      expect(community).toMatchObject({ anchorUid: 'alice', bornOn: 'node.example' });
      const bob = fixture.token({ sub: 'issuer-bob' });
      expect((await send({ action: 'join', id: community.id }, bob)).status).toBe(403);
      expect((await send({ action: 'request', id: community.id }, bob)).status).toBe(200);
      sql(`CREATE FUNCTION seed.reject_membership_test() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN RAISE EXCEPTION 'private internal error'; END $$;
        CREATE TRIGGER reject_membership_test BEFORE DELETE ON links FOR EACH ROW EXECUTE FUNCTION seed.reject_membership_test();`);
      const failed = await send({ action: 'accept', id: community.id, member: 'bob' });
      expect(failed.status).toBe(503);
      expect(await failed.json()).toEqual({ error: 'database_unavailable' });
      expect(sql("SELECT rel FROM links WHERE from_id='bob';")).toBe('join_request');
      sql('DROP TRIGGER reject_membership_test ON links;');
      expect((await send({ action: 'accept', id: community.id, member: 'bob' })).status).toBe(200);
      expect(sql("SELECT rel FROM links WHERE from_id='bob';")).toBe('member');
      expect((await send({ action: 'leave', id: community.id })).status).toBe(409);
      expect((await send({ action: 'join', id: 'missing' }, bob)).status).toBe(404);
    } finally {
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
      await db.close();
    }
  });
});

describe('independent community invitations', () => {
  it('keeps token lists private, joins atomically with permanent provenance, and never resurrects revoked invitations', async () => {
    const db = await apiDatabase(3);
    const list = (uid: string | null, community = 'garden') => db.invites({ id: null, community, after: null, limit: 1 }, uid);
    try {
      for (const uid of ['alice', 'bob', 'carol']) await db.profile(uid, { displayName: uid });
      sql(`INSERT INTO communities VALUES ('garden', '{"anchorUid":"alice","door":"invite"}');`);
      await expect(db.inviteCommand('bob', { action: 'mint', communityId: 'garden' })).rejects.toThrow('Forbidden');
      const first = (await db.inviteCommand('alice', { action: 'mint', communityId: 'garden', label: 'Friends' })).invite;
      expect(first.id).toMatch(/^[0-9a-f]{48}$/);
      expect(first).toMatchObject({ createdBy: 'alice', communityId: 'garden', label: 'Friends' });
      expect(await db.invites({ id: first.id, community: null, after: null, limit: 50 })).toEqual({ invite: first });
      expect(await db.invites({ id: 'missing', community: null, after: null, limit: 50 })).toEqual({ invite: null });
      await expect(list(null)).rejects.toThrow('Authentication required');
      await expect(list('bob')).rejects.toThrow('Forbidden');
      const second = (await db.inviteCommand('alice', { action: 'mint', communityId: 'garden' })).invite;
      const page = await list('alice'); expect(page.invites).toHaveLength(1); expect(page.next).not.toBeNull();
      const next = await db.invites({ id: null, community: 'garden', after: page.next, limit: 1 }, 'alice');
      expect(next.invites).toHaveLength(1); expect(next.next).toBeNull();
      sql(`INSERT INTO links(from_id,rel,to_id,lid) VALUES ('bob','join_request','garden','request');`);
      const results = await Promise.all([db.inviteCommand('bob', { action: 'accept', id: first.id }), db.inviteCommand('bob', { action: 'accept', id: first.id })]);
      expect(results[0]).toEqual({ id: 'garden', joined: true, remembered: true });
      expect(sql("SELECT string_agg(rel,',' ORDER BY rel) FROM links WHERE from_id='bob';")).toBe('invited_by,member,welcomed_by');
      await db.communityCommand('bob', { action: 'leave', id: 'garden' }, null);
      expect(sql("SELECT string_agg(rel,',' ORDER BY rel) FROM links WHERE from_id='bob';")).toBe('invited_by,welcomed_by');
      await db.inviteCommand('bob', { action: 'accept', id: second.id });
      expect(sql("SELECT doc->>'inviteId' FROM links WHERE from_id='bob' AND rel='invited_by';")).toBe(first.id);
      const revoked = await db.inviteCommand('alice', { action: 'revoke', id: first.id });
      expect(await db.inviteCommand('alice', { action: 'revoke', id: first.id })).toEqual(revoked);
      await expect(db.inviteCommand('carol', { action: 'accept', id: first.id })).rejects.toThrow('Invitation revoked');
      sql(`UPDATE communities SET doc=doc || '{"door":"closed"}'::jsonb;`);
      await expect(db.inviteCommand('carol', { action: 'accept', id: second.id })).rejects.toThrow('Door refused');
      sql(`UPDATE communities SET doc=doc || '{"door":"invite"}'::jsonb;
        UPDATE community_invites SET doc=doc || '{"expiresAt":"2000-01-01T00:00:00.000Z"}'::jsonb WHERE id='${second.id}';`);
      await expect(db.inviteCommand('carol', { action: 'accept', id: second.id })).rejects.toThrow('Invitation expired');
      await expect(db.withSession('alice', (c: any) => c.query('SELECT * FROM community_invites'))).rejects.toThrow(/permission denied/);
      await expect(db.inviteCommand('alice', { action: 'mint', communityId: 'garden', expiresAt: '2000-01-01T00:00:00.000Z' })).rejects.toThrow('Invalid expiry');
    } finally { await db.close(); }
  });
  it('rolls back membership if a provenance write fails', async () => {
    const db = await apiDatabase();
    try {
      for (const uid of ['alice', 'bob']) await db.profile(uid, { displayName: uid });
      sql(`INSERT INTO communities VALUES ('garden', '{"anchorUid":"alice","door":"invite"}');`);
      const { invite } = await db.inviteCommand('alice', { action: 'mint', communityId: 'garden' });
      sql(`CREATE FUNCTION seed.reject_provenance_test() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF NEW.rel='invited_by' THEN RAISE EXCEPTION 'forced provenance failure'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER reject_provenance_test BEFORE INSERT ON links FOR EACH ROW EXECUTE FUNCTION seed.reject_provenance_test();`);
      await expect(db.inviteCommand('bob', { action: 'accept', id: invite.id })).rejects.toThrow('forced provenance failure');
      expect(sql("SELECT count(*) FROM links WHERE from_id='bob';")).toBe('0');
    } finally { await db.close(); }
  });
});

describe('invitation HTTP access', () => {
  it('exposes one held token, refuses unauthorized lists, and returns stable refusal codes', async () => {
    const db = await apiDatabase(); const fixture = authFixture();
    const server = createApi(db, await createAuthenticator(fixture.config));
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address(); if (!address || typeof address === 'string') throw new Error('missing_address');
    const base = `http://127.0.0.1:${address.port}`;
    const alice = fixture.token(), bob = fixture.token({ sub: 'issuer-bob' });
    const post = (value: object, token = alice) => fetch(base + '/v1/community-invites/command', {
      method: 'POST', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify(value),
    });
    try {
      for (const uid of ['alice','bob']) await db.profile(uid, { displayName: uid });
      sql(`INSERT INTO communities VALUES ('garden','{"anchorUid":"alice","door":"invite"}');`);
      const minted = await post({ action: 'mint', communityId: 'garden' }); expect(minted.status).toBe(200);
      const { invite } = await minted.json();
      expect(await (await fetch(base + '/v1/community-invites?id=' + invite.id)).json()).toEqual({ invite });
      expect((await fetch(base + '/v1/community-invites?community=garden')).status).toBe(401);
      expect((await fetch(base + '/v1/community-invites?community=garden', { headers: { authorization: 'Bearer ' + bob } })).status).toBe(403);
      const accepted = await post({ action: 'accept', id: invite.id }, bob);
      expect(await accepted.json()).toEqual({ id: 'garden', joined: true, remembered: true });
      const lookup = await fetch(base + '/v1/communities?id=garden', { headers: { authorization: 'Bearer ' + bob } });
      expect((await lookup.json()).access).toEqual({ keeper: false, steward: false, joined: true, requested: false, keeperRequested: false, canFormCircle:false });
      expect((await post({ action: 'revoke', id: invite.id }, bob)).status).toBe(403);
      expect((await post({ action: 'revoke', id: invite.id })).status).toBe(200);
      const refused = await post({ action: 'accept', id: invite.id }, bob);
      expect(refused.status).toBe(409); expect(await refused.json()).toEqual({ error: 'invite_revoked' });
      expect((await post({ action: 'accept', id: 'missing' }, bob)).status).toBe(404);
    } finally {
      server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await db.close();
    }
  });
});

describe('durable independent identity enrollment', () => {
  it('creates one local account per issuer/subject under concurrency, without adopting claims or existing identities', async () => {
    const db = await apiDatabase(3);
    try {
      expect(await db.resolveIdentity('https://issuer.example', 'new', null, false)).toBeNull();
      const ids = await Promise.all(Array.from({ length: 5 }, () => db.resolveIdentity('https://issuer.example', 'new', null, true)));
      expect(new Set(ids).size).toBe(1); expect(ids[0]).toMatch(/^oidc_/);
      expect(await db.resolveIdentity('https://issuer.example', 'new', null, false)).toBe(ids[0]);
      expect(await db.resolveIdentity('https://other.example', 'new', null, true)).not.toBe(ids[0]);
      expect(sql('SELECT count(*) FROM persons;')).toBe('0'); expect(sql('SELECT count(*) FROM admins;')).toBe('0');
      const { profile } = await db.profile(ids[0], { displayName: 'New Person' });
      expect(profile.uid).toBe(ids[0]); expect(profile.lid).not.toBe(ids[0].slice(5));
      await expect(db.resolveIdentity('https://issuer.example', 'new', 'alice', true)).rejects.toThrow('Identity binding conflict');
      expect(await db.resolveIdentity('https://issuer.example', 'reviewed', 'alice', false)).toBe('alice');
      expect(await db.resolveIdentity('https://issuer.example', 'reviewed', null, true)).toBeNull();
      expect(await db.resolveIdentity('https://issuer.example', 'reviewed', 'alice', false)).toBe('alice');
      await expect(db.withSession(null, (c: any) => c.query('SELECT * FROM seed.identity_bindings'))).rejects.toThrow(/permission denied/);
      const candidate = 'oidc_01900000-0000-7000-8000-000000000001';
      sql(`INSERT INTO users VALUES ('${candidate}', '{"private":"existing"}');`);
      await expect(db.withSession(null, (c: any) => c.query('SELECT seed.resolve_identity($1,$2,NULL,true,$3)',
        ['https://issuer.example','collision',candidate]))).rejects.toThrow('Identity binding conflict');
      expect(sql("SELECT count(*) FROM seed.identity_bindings WHERE subject='collision';")).toBe('0');
    } finally { await db.close(); }
  });
  it('enrolls only after signature verification and permits explicit subject revocation', async () => {
    const db = await apiDatabase(); const fixture = authFixture();
    try {
      const config = { ...fixture.config, enrollment: 'open' };
      const auth = await createAuthenticator(config, db.resolveIdentity);
      const uid = await auth('Bearer ' + fixture.token({ sub: 'new-person', email: 'same@example.test', uid: 'alice' }));
      expect(uid).toMatch(/^oidc_/); expect(uid).not.toBe('alice');
      expect(await auth('Bearer ' + authFixture().token({ sub: 'forged' }))).toBeNull();
      expect(sql("SELECT count(*) FROM seed.identity_bindings WHERE subject='forged';")).toBe('0');
      const closed = await createAuthenticator({ ...config, enrollment: 'closed' }, db.resolveIdentity);
      expect(await closed('Bearer ' + fixture.token({ sub: 'new-person' }))).toBe(uid);
      expect(await closed('Bearer ' + fixture.token({ sub: 'other-person' }))).toBeNull();
      const revoked = await createAuthenticator({ ...config, disabledSubjects: ['new-person'] }, db.resolveIdentity);
      expect(await revoked('Bearer ' + fixture.token({ sub: 'new-person' }))).toBeNull();
      expect(sql('SELECT count(*) FROM seed.identity_bindings;')).toBe('1');
    } finally { await db.close(); }
  });
});

describe('independent community role lifecycle', () => {
  it('delegates only door authority to members and removes it without changing membership', async () => {
    const db = await apiDatabase(3);
    const act = (uid: string, action: string, member?: string) => db.communityCommand(uid, { action, id: 'garden', ...(member ? { member } : {}) }, null);
    try {
      sql(`INSERT INTO communities VALUES ('garden','{"anchorUid":"alice","door":"invite"}');
        INSERT INTO links(from_id,rel,to_id,lid) VALUES ('bob','member','garden','member'),('carol','keeper','garden','keeper');`);
      await expect(act('bob','grant_steward','bob')).rejects.toThrow('Forbidden');
      await expect(act('alice','grant_steward','outsider')).rejects.toThrow('Membership required');
      await Promise.all([act('alice','grant_steward','bob'), act('carol','grant_steward','bob')]);
      expect(sql("SELECT count(*) FROM links WHERE rel='steward';")).toBe('1');
      const lookup = await db.communities({ id: 'garden' }, 'bob');
      expect(lookup.access).toEqual({ keeper: false, steward: true, joined: true, requested: false, keeperRequested: false, canFormCircle:false });
      await expect(act('bob','grant_steward','carol')).rejects.toThrow('Forbidden');
      await expect(act('bob','revoke_steward','carol')).rejects.toThrow('Forbidden');
      expect(await act('bob','revoke_steward','bob')).toMatchObject({ steward: false });
      expect(sql("SELECT rel FROM links WHERE from_id='bob';")).toBe('member');
      await act('carol','grant_steward','bob'); await act('alice','revoke_steward','bob');
      expect(sql("SELECT rel FROM links WHERE from_id='bob';")).toBe('member');
    } finally { await db.close(); }
  });
  it('refuses the last keeper and transfers the anchor deterministically while preserving identity and history', async () => {
    const db = await apiDatabase(3);
    const resign = (uid: string) => db.communityCommand(uid, { action: 'resign_keeper', id: 'garden' }, null);
    try {
      sql(`INSERT INTO communities VALUES ('garden','{"anchorUid":"alice","lid":"stable","history":"preserved","keeperUids":["stale"]}');`);
      await expect(resign('alice')).rejects.toThrow('Last keeper');
      await expect(resign('outsider')).rejects.toThrow('Forbidden');
      sql(`INSERT INTO links(from_id,rel,to_id,lid,created_at) VALUES
        ('alice','keeper','garden','duplicate','2000-01-01'),
        ('carol','keeper','garden','carol','2001-01-01'),
        ('bob','keeper','garden','bob','2001-01-01'),
        ('dave','keeper','garden','dave','2002-01-01');`);
      expect(await resign('alice')).toEqual({ resigned: 'alice', successor: 'bob' });
      expect(sql("SELECT doc->>'anchorUid' FROM communities WHERE id='garden';")).toBe('bob');
      expect(sql("SELECT string_agg(from_id,',' ORDER BY from_id) FROM links WHERE rel='keeper';")).toBe('carol,dave');
      expect(sql("SELECT doc->>'keeperUids' FROM communities WHERE id='garden';")).toBe('["carol", "dave"]');
      expect(sql("SELECT (doc->>'lid') || ':' || (doc->>'history') FROM communities WHERE id='garden';")).toBe('stable:preserved');
      await expect(resign('alice')).rejects.toThrow('Forbidden');
      const exits = await Promise.allSettled([resign('bob'), resign('carol'), resign('dave')]);
      expect(exits.filter(r => r.status === 'fulfilled')).toHaveLength(2);
      expect(exits.filter(r => r.status === 'rejected')).toHaveLength(1);
      expect(sql("SELECT doc->>'anchorUid' FROM communities WHERE id='garden';")).not.toBe('');
      expect(sql("SELECT count(*) FROM links WHERE rel='keeper';")).toBe('0');
      expect(sql("SELECT doc->>'keeperUids' FROM communities WHERE id='garden';")).toBe('[]');
    } finally { await db.close(); }
  });
  it('rolls back seat removal if the anchor transfer cannot be stored', async () => {
    const db = await apiDatabase();
    try {
      sql(`INSERT INTO communities VALUES ('garden','{"anchorUid":"alice"}');
        INSERT INTO links(from_id,rel,to_id,lid) VALUES ('bob','keeper','garden','bob');
        CREATE FUNCTION seed.reject_succession_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced transfer failure'; END $$;
        CREATE TRIGGER reject_succession_test BEFORE UPDATE ON communities FOR EACH ROW EXECUTE FUNCTION seed.reject_succession_test();`);
      await expect(db.communityCommand('alice',{ action:'resign_keeper',id:'garden' },null)).rejects.toThrow('forced transfer failure');
      expect(sql("SELECT doc->>'anchorUid' FROM communities WHERE id='garden';")).toBe('alice');
      expect(sql("SELECT from_id FROM links WHERE rel='keeper';")).toBe('bob');
    } finally { await db.close(); }
  });
});

describe('independent tree privacy', () => {
  it('enforces tree visibility at rest, including malformed public secret trees and circle seats', async () => {
    const db = await apiDatabase(2);
    try {
      sql(`INSERT INTO lifetrees VALUES
        ('public','{"anchorUid":"alice","visibility":"public"}'),
        ('node','{"anchorUid":"alice","visibility":"node"}'),
        ('private','{"anchorUid":"alice","visibility":"private"}'),
        ('secret','{"anchorUid":"alice","treeType":"SECRET","visibility":"private"}'),
        ('malformed-secret','{"anchorUid":"alice","treeType":"SECRET","visibility":"public"}'),
        ('legacy','{"anchorUid":"alice"}');
        INSERT INTO links(from_id,rel,to_id,lid) VALUES ('guardian','guardian','private','g'),
          ('observer','observer','private','o'),('steward','steward','private','s'),
          ('oldkeeper','keeper','secret','k'),('badguardian','guardian','secret','bad');
        INSERT INTO secret_links(from_id,rel,to_id,lid) VALUES ('bob','keeper','secret','bob'),
          ('carol','keeper','secret','carol'),('bob','keeper','private','wrong-ledger');
        INSERT INTO admins VALUES ('staff','{}');`);
      const ids = (uid: string | null) => db.withSession(uid, async (c: any) => (await c.query('SELECT id FROM lifetrees ORDER BY id')).rows.map((row: any) => row.id));
      expect(await ids(null)).toEqual(['legacy','public']);
      expect(await ids('outsider')).toEqual(['legacy','node','public']);
      expect(await ids('alice')).toEqual(['legacy','malformed-secret','node','private','public','secret']);
      expect(await ids('staff')).toEqual(await ids('alice'));
      for (const uid of ['guardian','observer','steward']) expect(await ids(uid)).toEqual(['legacy','node','private','public']);
      for (const uid of ['bob','oldkeeper']) expect(await ids(uid)).toEqual(['legacy','node','public','secret']);
      expect(await ids('badguardian')).toEqual(['legacy','node','public']);
      const seats = (uid: string) => db.withSession(uid, async (c: any) => (await c.query("SELECT from_id FROM secret_links WHERE to_id='secret' ORDER BY from_id")).rows.map((row: any) => row.from_id));
      expect(await seats('bob')).toEqual(['bob','carol']); expect(await seats('alice')).toEqual(['bob','carol']);
      expect(await seats('outsider')).toEqual([]); expect(await seats('badguardian')).toEqual([]);
      await expect(db.withSession('alice', (c: any) => c.query("UPDATE lifetrees SET doc='{}'"))).rejects.toThrow(/permission denied/);
    } finally { await db.close(); }
  });
  it('paginates only readable rows and gives the same missing response for hidden and nonexistent trees', async () => {
    const db = await apiDatabase(); const fixture = authFixture();
    const server = createApi(db,await createAuthenticator(fixture.config));
    await new Promise<void>(resolve => server.listen(0,'127.0.0.1',resolve));
    const address = server.address(); if (!address || typeof address==='string') throw new Error('missing_address');
    const base = `http://127.0.0.1:${address.port}`;
    try {
      sql(`INSERT INTO lifetrees VALUES
        ('a','{"name":"Hidden","anchorUid":"alice","visibility":"private","domain":"garden.example"}'),
        ('b','{"id":"forged","name":"Oak","anchorUid":"alice","visibility":"public","domain":"garden.example"}'),
        ('c','{"name":"Hidden secret","anchorUid":"alice","visibility":"public","treeType":"SECRET","domain":"garden.example"}'),
        ('d','{"name":"Willow","anchorUid":"alice","visibility":"public","domain":"garden.example","isNature":true}'),
        ('e','{"name":"Legacy","anchorUid":"alice","domain":"garden.example"}');`);
      const first = await (await fetch(base+'/v1/trees?limit=1&domain=garden.example')).json();
      expect(first.trees.map((t: any)=>t.id)).toEqual(['b']); expect(first.next).toBe('b');
      const second = await (await fetch(base+'/v1/trees?limit=1&domain=garden.example&after=b')).json();
      expect(second.trees.map((t: any)=>t.id)).toEqual(['d']); expect(second.next).toBeNull();
      for (const id of ['a','c','missing']) {
        const response = await fetch(base+'/v1/trees?id='+id); expect(response.status).toBe(404); expect(await response.json()).toEqual({ tree:null });
      }
      expect((await fetch(base+'/v1/trees?id=e')).status).toBe(200);
      const own = await (await fetch(base+'/v1/trees?anchor=alice',{ headers:{ authorization:'Bearer '+fixture.token() } })).json();
      expect(own.trees).toHaveLength(5);
      const publicKind = await (await fetch(base+'/v1/trees?kind=GUARDED')).json(); expect(publicKind.trees.map((t: any)=>t.id)).toEqual(['d']);
      const claimed = await (await fetch(base+'/v1/trees?anchor=alice',{ headers:{ 'X-User-Id':'alice' } })).json();
      expect(claimed.trees.map((t: any)=>t.id)).toEqual(['b','d']);
    } finally { server.closeAllConnections(); await new Promise<void>(resolve=>server.close(()=>resolve())); await db.close(); }
  });
});

describe('independent atomic planting', () => {
  it('plants a tree and its private idea-twin together, with reproducible distinct genesis hashes and immutable identity', async () => {
    const db = await apiDatabase(3);
    const draft = { action:'plant',name:'Willow',body:'Private beginning',treeType:'LIFETREE',visibility:'private',latitude:50,longitude:4 };
    try {
      await expect(db.treeCommand('alice',draft,'node.example')).rejects.toThrow('Profile required');
      await db.profile('alice',{ displayName:'Alice' });
      const { tree } = await db.treeCommand('alice',draft,'node.example');
      expect(tree).toMatchObject({ anchorUid:'alice',domain:'node.example',visibility:'private',validated:false,blockHeight:0 });
      expect(tree.id).toBe(tree.lid); expect(tree.latestHash).toBe(tree.genesisHash);
      const { createBlock, sha256 } = await import('../../src/domain/chain/hash');
      expect(tree.genesisHash).toBe(await createBlock('0',{ msg:'Birth',lid:tree.lid },tree.genesisAtMs));
      expect(tree.genesisHash).toBe(await sha256(tree.genesisPreimage));
      const vision = JSON.parse(sql(`SELECT doc FROM visions WHERE doc->>'lifetreeId'='${tree.id}';`));
      expect(vision).toMatchObject({ authorId:'alice',body:draft.body,visibility:'private',createdAt:tree.createdAt });
      expect(vision.genesisHash).not.toBe(tree.genesisHash);
      expect(vision.genesisHash).toBe(await sha256(vision.genesisPreimage));
      await expect(db.treeCommand('bob',{ action:'edit',id:tree.id,name:'Taken',body:'' },null)).rejects.toThrow('Tree missing');
      sql(`INSERT INTO links(from_id,rel,to_id,lid) VALUES ('bob','steward','${tree.id}','steward');`);
      const updated = (await db.treeCommand('bob',{ action:'edit',id:tree.id,name:'Tended',body:'New words' },null)).tree;
      expect(updated).toMatchObject({ name:'Tended',lid:tree.lid,anchorUid:'alice',genesisHash:tree.genesisHash,latestHash:tree.latestHash,blockHeight:0,visibility:'private' });
      await expect(db.treeCommand('alice',{ action:'edit',id:tree.id,name:'Taken',body:'',latestHash:'forged' },null)).rejects.toThrow('Invalid tree');
      await db.treeCommand('alice',{ action:'edit',id:tree.id,name:'Placed',body:'',latitude:42,longitude:19,locationName:'Garden' },null);
      const cleared = (await db.treeCommand('alice',{ action:'edit',id:tree.id,name:'Unplaced',body:'',latitude:null,longitude:null },null)).tree;
      expect(cleared).not.toHaveProperty('latitude');
      expect(cleared).not.toHaveProperty('longitude');
      expect(cleared).not.toHaveProperty('locationName');
    } finally { await db.close(); }
  });
  it('enforces concurrent quota at birth and never creates a public reflection of a secret tree', async () => {
    const db = await apiDatabase(3);
    const plant = (kind: string) => db.treeCommand('alice',{ action:'plant',name:'Willow',body:'Beginning',treeType:kind,visibility:'private' },'node.example');
    try {
      await db.profile('alice',{ displayName:'Alice' });
      sql(`INSERT INTO config VALUES ('limits','{"maxLifetrees":1,"maxGuardedTrees":1}');`);
      const attempts = await Promise.allSettled([plant('LIFETREE'),plant('LIFETREE')]);
      expect(attempts.filter(r=>r.status==='fulfilled')).toHaveLength(1);
      expect(attempts.filter(r=>r.status==='rejected')).toHaveLength(1);
      expect(sql('SELECT count(*) FROM lifetrees;')).toBe('1'); expect(sql('SELECT count(*) FROM visions;')).toBe('1');
      const nature = (await plant('GUARDED')).tree;
      expect(sql(`SELECT rel FROM links WHERE to_id='${nature.id}';`)).toBe('guardian');
      const secret = (await plant('SECRET')).tree;
      expect(secret.visibility).toBe('private');
      expect(sql(`SELECT count(*) FROM links WHERE to_id='${secret.id}' OR from_id='${secret.id}';`)).toBe('0');
      expect(sql(`SELECT count(*) FROM visions WHERE doc->>'lifetreeId'='${secret.id}';`)).toBe('0');
      expect(sql('SELECT count(*) FROM communities;')).toBe('0');
      await expect(db.treeCommand('alice',{ action:'plant',name:'Secret',body:'',treeType:'SECRET',visibility:'public' },'node.example')).rejects.toThrow('Invalid tree');
      await expect(db.treeCommand('alice',{ action:'edit',id:secret.id,name:'Secret',body:'',visibility:'public' },null)).rejects.toThrow('Invalid tree');
      for (let i=0;i<11;i++) await plant('SECRET');
      await expect(plant('SECRET')).rejects.toThrow('Tree limit reached');
      expect(sql("SELECT count(*) FROM lifetrees WHERE doc->>'treeType'='SECRET';")).toBe('12');
    } finally { await db.close(); }
  });
  it('rolls back the tree when its twin fails and honors the staff edit switch', async () => {
    const db = await apiDatabase();
    try {
      await db.profile('alice',{ displayName:'Alice' });
      sql(`CREATE FUNCTION seed.reject_vision_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced twin failure'; END $$;
        CREATE TRIGGER reject_vision_test BEFORE INSERT ON visions FOR EACH ROW EXECUTE FUNCTION seed.reject_vision_test();`);
      await expect(db.treeCommand('alice',{ action:'plant',name:'Tree',body:'',treeType:'LIFETREE',visibility:'public' },'node.example')).rejects.toThrow('forced twin failure');
      expect(sql('SELECT count(*) FROM lifetrees;')).toBe('0');
      sql(`DROP TRIGGER reject_vision_test ON visions;
        INSERT INTO admins VALUES ('staff','{}'); INSERT INTO config VALUES ('staffHands','{"tree_edit":false}');`);
      const { tree } = await db.treeCommand('alice',{ action:'plant',name:'Tree',body:'',treeType:'LIFETREE',visibility:'public' },'node.example');
      const edit = { action:'edit',id:tree.id,name:'Changed',body:'' };
      await expect(db.treeCommand('staff',edit,null)).rejects.toThrow('Forbidden');
      sql("UPDATE config SET doc='{}' WHERE id='staffHands';");
      expect((await db.treeCommand('staff',edit,null)).tree.name).toBe('Changed');
    } finally { await db.close(); }
  });
});


describe('consensual independent community keepership', () => {
  it('requires a request, current keeper authority and a qualifying tree, then atomically grants membership', async () => {
    const db = await apiDatabase(3);
    const act = (uid: string, action: string, member?: string) => db.communityCommand(uid, { action, id:'garden', ...(member ? { member } : {}) }, null);
    try {
      sql(`INSERT INTO communities VALUES ('garden','{"anchorUid":"alice","door":"closed","history":"unchanged"}');
        INSERT INTO lifetrees VALUES ('bed','{"anchorUid":"bob","treeType":"BED"}'),('secret','{"anchorUid":"bob","treeType":"SECRET"}');`);
      await expect(act('alice','accept_keeper_request','bob')).rejects.toThrow('Request missing');
      await act('bob','request_keeper'); await act('bob','request_keeper');
      expect((await db.communities({id:'garden'},'bob')).access.keeperRequested).toBe(true);
      await expect(act('bob','accept_keeper_request','bob')).rejects.toThrow('Forbidden');
      await expect(act('alice','accept_keeper_request','bob')).rejects.toThrow('Rooted tree required');
      expect(sql("SELECT count(*) FROM links WHERE rel='keeper_request';")).toBe('1');
      sql(`INSERT INTO lifetrees VALUES ('root','{"anchorUid":"carol","treeType":"LIFETREE","visibility":"private"}');
        INSERT INTO links(from_id,rel,to_id,lid) VALUES ('bob','guardian','root','guardian');`);
      await expect(act('alice','accept_keeper_request','bob')).rejects.toThrow('Rooted tree required');
      sql("INSERT INTO links(from_id,rel,to_id,lid) VALUES ('bob','keeper','root','keeping');");
      await act('alice','accept_keeper_request','bob');
      expect((await db.communities({id:'garden'},'bob')).access).toMatchObject({ keeper:true,joined:true,keeperRequested:false });
      expect(JSON.parse(sql("SELECT doc::text FROM communities WHERE id='garden';"))).toMatchObject({anchorUid:'alice',keeperUids:['bob'],history:'unchanged'});
      await expect(act('bob','request_keeper')).rejects.toThrow('Already keeper');
      await expect(act('alice','accept_keeper_request','bob')).rejects.toThrow('Already keeper');
      expect(sql("SELECT count(*) FROM links WHERE rel='keeper_request';")).toBe('0');
    } finally { await db.close(); }
  });
  it('preserves consent on failed writes and allows only its owner or keepers to withdraw it', async () => {
    const db = await apiDatabase(3);
    const act = (uid: string, action: string, member?: string) => db.communityCommand(uid, { action,id:'garden',...(member ? {member} : {}) },null);
    try {
      sql(`INSERT INTO communities VALUES ('garden','{"anchorUid":"alice"}');
        INSERT INTO lifetrees VALUES ('root','{"anchorUid":"bob"}');`);
      await act('bob','request_keeper');
      await expect(act('eve','decline_keeper_request','bob')).rejects.toThrow('Forbidden');
      await expect(act('eve','cancel_keeper_request','bob')).rejects.toThrow('Invalid command');
      sql(`CREATE FUNCTION public.fail_keeper_mirror() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'mirror failure'; END $$;
        CREATE TRIGGER fail_keeper_mirror BEFORE UPDATE ON communities FOR EACH ROW EXECUTE FUNCTION public.fail_keeper_mirror();`);
      await expect(act('alice','accept_keeper_request','bob')).rejects.toThrow('mirror failure');
      expect(sql("SELECT rel FROM links WHERE to_id='garden';")).toBe('keeper_request');
      sql('DROP TRIGGER fail_keeper_mirror ON communities; DROP FUNCTION public.fail_keeper_mirror();');
      await act('bob','cancel_keeper_request');
      await expect(act('alice','accept_keeper_request','bob')).rejects.toThrow('Request missing');
      await act('bob','request_keeper'); await act('alice','decline_keeper_request','bob');
      expect(sql("SELECT count(*) FROM links WHERE to_id='garden';")).toBe('0');
    } finally { await db.close(); }
  });
});

describe('independent keeper offers', () => {
  it('requires recipient consent and rooted standing, preserves provenance and closes offers once', async () => {
    const db = await apiDatabase(3);
    const act = (uid:string,action:string,fields:object={}) => db.communityCommand(uid,{action,id:'garden',...fields},null);
    try {
      sql(`INSERT INTO communities VALUES ('garden','{"anchorUid":"alice","name":"Garden"}');`);
      await expect(act('bob','offer_keeper',{member:'bob'})).rejects.toThrow('Forbidden');
      const {invite} = await act('alice','offer_keeper',{member:'bob'});
      expect((await act('alice','offer_keeper',{member:'bob'})).invite.id).toBe(invite.id);
      expect(sql("SELECT count(*) FROM links WHERE rel='keeper';")).toBe('0');
      await expect(act('alice','accept_keeper_offer',{inviteId:invite.id})).rejects.toThrow('Forbidden');
      await expect(act('eve','decline_keeper_offer',{inviteId:invite.id})).rejects.toThrow('Forbidden');
      await expect(act('bob','accept_keeper_offer',{inviteId:invite.id})).rejects.toThrow('Rooted tree required');
      sql(`INSERT INTO lifetrees VALUES ('root','{"anchorUid":"bob","treeType":"LIFETREE"}');
        INSERT INTO links(from_id,rel,to_id,lid,doc) VALUES ('bob','welcomed_by','alice','original','{"inviteId":"first"}');`);
      await act('bob','request_keeper');
      const outcomes=await Promise.allSettled([act('bob','accept_keeper_offer',{inviteId:invite.id}),act('bob','accept_keeper_offer',{inviteId:invite.id})]);
      expect(outcomes.filter(r=>r.status==='fulfilled')).toHaveLength(1);
      expect((await db.communities({id:'garden'},'bob')).access).toMatchObject({keeper:true,joined:true,keeperRequested:false});
      expect(sql("SELECT doc->>'inviteId' FROM links WHERE rel='welcomed_by';")).toBe('first');
      expect(sql(`SELECT doc->>'status' FROM community_keeper_invites WHERE id='${invite.id}';`)).toBe('accepted');
      await expect(act('alice','decline_keeper_offer',{inviteId:invite.id})).rejects.toThrow('Invite closed');
    } finally {await db.close();}
  });
  it('paginates signed-in lists, binds inboxes, and denies direct writes and malformed offer authority', async () => {
    const db=await apiDatabase();
    try {
      sql(`INSERT INTO communities VALUES ('garden','{"anchorUid":"alice"}');
        INSERT INTO community_keeper_invites VALUES ('malformed','{"communityId":"garden","invitedUserId":"bob","status":"pending"}');`);
      await expect(db.communityCommand('eve',{action:'decline_keeper_offer',id:'garden',inviteId:'malformed'},null)).rejects.toThrow('Forbidden');
      const mine={community:null,mine:true,after:null,limit:1};
      expect((await db.keeperInvites(mine,'eve')).invites).toHaveLength(0);
      expect((await db.keeperInvites(mine,'bob')).invites[0].id).toBe('malformed');
      await db.communityCommand('alice',{action:'offer_keeper',id:'garden',member:'bob'},null);
      const page=await db.keeperInvites(mine,'bob');expect(page.next).not.toBeNull();
      const next=await db.keeperInvites({...mine,after:page.next},'bob');expect(next.invites).toHaveLength(1);expect(next.next).toBeNull();
      expect((await db.withSession(null,(c:any)=>c.query('SELECT * FROM community_keeper_invites'))).rows).toHaveLength(0);
      await expect(db.withSession('alice',(c:any)=>c.query("UPDATE community_keeper_invites SET doc='{}'"))).rejects.toThrow(/permission denied/);
      const {invite}=await db.communityCommand('alice',{action:'offer_keeper',id:'garden',member:'carol'},null);
      await db.communityCommand('alice',{action:'decline_keeper_offer',id:'garden',inviteId:invite.id},null);
      await expect(db.communityCommand('carol',{action:'accept_keeper_offer',id:'garden',inviteId:invite.id},null)).rejects.toThrow('Invite closed');
    } finally {await db.close();}
  });
  it('rolls back seats, provenance and offer consumption if the community mirror fails', async () => {
    const db=await apiDatabase();
    try {
      sql(`INSERT INTO communities VALUES ('garden','{"anchorUid":"alice"}');
        INSERT INTO lifetrees VALUES ('root','{"anchorUid":"bob"}');`);
      const {invite}=await db.communityCommand('alice',{action:'offer_keeper',id:'garden',member:'bob'},null);
      sql(`CREATE FUNCTION public.fail_offer_mirror() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'offer mirror failure'; END $$;
        CREATE TRIGGER fail_offer_mirror BEFORE UPDATE ON communities FOR EACH ROW EXECUTE FUNCTION public.fail_offer_mirror();`);
      await expect(db.communityCommand('bob',{action:'accept_keeper_offer',id:'garden',inviteId:invite.id},null)).rejects.toThrow('offer mirror failure');
      expect(sql('SELECT count(*) FROM links;')).toBe('0');
      expect(sql(`SELECT doc->>'status' FROM community_keeper_invites WHERE id='${invite.id}';`)).toBe('pending');
      sql('DROP TRIGGER fail_offer_mirror ON communities; DROP FUNCTION public.fail_offer_mirror();');
    } finally {await db.close();}
  });
});

it('serves keeper offers only with verified identity and maps invitation refusals through HTTP', async () => {
  const db=await apiDatabase();const fixture=authFixture();
  const server=createApi(db,await createAuthenticator(fixture.config));
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();if(!address || typeof address==='string')throw new Error('missing_address');
  const base=`http://127.0.0.1:${address.port}`;
  const alice=fixture.token(),bob=fixture.token({sub:'issuer-bob'});
  const post=(value:object,token=alice)=>fetch(base+'/v1/communities/command',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(value)});
  try {
    sql(`INSERT INTO communities VALUES ('garden','{"anchorUid":"alice"}');`);
    expect((await fetch(base+'/v1/keeper-invites?mine=true',{headers:{'x-user-id':'alice'}})).status).toBe(401);
    const sent=await post({action:'offer_keeper',id:'garden',member:'bob'});expect(sent.status).toBe(200);
    const {invite}=await sent.json();
    const inbox=await fetch(base+'/v1/keeper-invites?mine=true',{headers:{authorization:'Bearer '+bob}});
    expect((await inbox.json()).invites).toHaveLength(1);
    expect((await post({action:'accept_keeper_offer',id:'garden',inviteId:invite.id})).status).toBe(403);
    const unrooted=await post({action:'accept_keeper_offer',id:'garden',inviteId:invite.id},bob);
    expect(unrooted.status).toBe(409);expect(await unrooted.json()).toEqual({error:'rooted_tree_required'});
    expect((await post({action:'decline_keeper_offer',id:'garden',inviteId:invite.id},bob)).status).toBe(200);
    const closed=await post({action:'accept_keeper_offer',id:'garden',inviteId:invite.id},bob);
    expect(closed.status).toBe(409);expect(await closed.json()).toEqual({error:'invite_closed'});
  } finally {server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await db.close();}
});

describe('independent tree succession', () => {
  it('refuses the last keeper, ignores staff and wrong-ledger authority, and preserves tree history', async () => {
    const db=await apiDatabase(3);
    const resign=(uid:string)=>db.treeCommand(uid,{action:'resign_keeper',id:'tree'},null);
    try {
      sql(`INSERT INTO lifetrees VALUES ('tree','{"anchorUid":"alice","visibility":"public","lid":"stable","latestHash":"head","blockHeight":7}');
        INSERT INTO admins VALUES ('staff','{}');
        INSERT INTO secret_links(from_id,rel,to_id,lid) VALUES ('eve','keeper','tree','wrong-ledger');`);
      await expect(resign('alice')).rejects.toThrow('Last keeper');
      await expect(resign('staff')).rejects.toThrow('Forbidden');
      await expect(resign('eve')).rejects.toThrow('Forbidden');
      sql(`INSERT INTO links(from_id,rel,to_id,lid,created_at) VALUES
        ('alice','keeper','tree','duplicate','2000-01-01'),('carol','keeper','tree','carol','2001-01-01'),('bob','keeper','tree','bob','2001-01-01');`);
      await db.withSession('bob',(c:any)=>c.query("DELETE FROM links WHERE rel='keeper' AND to_id='tree'"));
      expect(sql("SELECT count(*) FROM links WHERE rel='keeper';")).toBe('3');
      expect(await resign('alice')).toMatchObject({resigned:'alice',successor:'bob'});
      expect(JSON.parse(sql("SELECT doc::text FROM lifetrees WHERE id='tree';"))).toMatchObject({anchorUid:'bob',lid:'stable',latestHash:'head',blockHeight:7});
      expect(sql("SELECT from_id FROM links WHERE rel='keeper';")).toBe('carol');
      expect((await db.trees({id:'tree'},'bob')).access.keeper).toBe(true);
      expect((await db.trees({id:'tree'},'alice')).access.keeper).toBe(false);
    } finally {await db.close();}
  });
  it('deduplicates secret and legacy seats and serializes concurrent resignations without exposing the secret', async () => {
    const db=await apiDatabase(3);
    const resign=(uid:string)=>db.treeCommand(uid,{action:'resign_keeper',id:'secret'},null);
    try {
      sql(`INSERT INTO lifetrees VALUES ('secret','{"anchorUid":"alice","visibility":"private","treeType":"SECRET","genesisHash":"birth"}');
        INSERT INTO links(from_id,rel,to_id,lid,created_at) VALUES ('bob','keeper','secret','old-bob','2002-01-01');
        INSERT INTO secret_links(from_id,rel,to_id,lid,created_at) VALUES
          ('alice','keeper','secret','duplicate','1999-01-01'),('bob','keeper','secret','bob','2000-01-01'),('carol','keeper','secret','carol','2001-01-01');`);
      await expect(resign('outsider')).rejects.toThrow('Tree missing');
      expect(await resign('alice')).toMatchObject({successor:'bob'});
      expect(sql('SELECT count(*) FROM links;')).toBe('0');
      expect(sql('SELECT from_id FROM secret_links;')).toBe('carol');
      expect((await db.trees({id:'secret'},'alice')).tree).toBeNull();
      const results=await Promise.allSettled([resign('bob'),resign('carol')]);
      expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
      expect(results.filter(r=>r.status==='rejected')).toHaveLength(1);
      expect(sql('SELECT count(*) FROM secret_links;')).toBe('0');
      expect(sql("SELECT doc->>'anchorUid' FROM lifetrees;")).toMatch(/^(bob|carol)$/);
      expect((await db.trees({id:'secret'},null)).tree).toBeNull();
    } finally {await db.close();}
  });
  it('rolls back both ledgers when a successor update fails', async () => {
    const db=await apiDatabase();
    try {
      sql(`INSERT INTO lifetrees VALUES ('secret','{"anchorUid":"alice","treeType":"SECRET"}');
        INSERT INTO secret_links(from_id,rel,to_id,lid) VALUES ('bob','keeper','secret','bob');
        CREATE FUNCTION public.reject_tree_succession() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'succession failure'; END $$;
        CREATE TRIGGER reject_tree_succession BEFORE UPDATE ON lifetrees FOR EACH ROW EXECUTE FUNCTION public.reject_tree_succession();`);
      await expect(db.treeCommand('alice',{action:'resign_keeper',id:'secret'},null)).rejects.toThrow('succession failure');
      expect(sql('SELECT from_id FROM secret_links;')).toBe('bob');
      expect(sql("SELECT doc->>'anchorUid' FROM lifetrees;")).toBe('alice');
      sql('DROP TRIGGER reject_tree_succession ON lifetrees; DROP FUNCTION public.reject_tree_succession();');
    } finally {await db.close();}
  });
});

it('maps tree resignation refusals over HTTP without revealing private trees or promoting malformed seats', async () => {
  const db=await apiDatabase();const fixture=authFixture();const server=createApi(db,await createAuthenticator(fixture.config));
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();if(!address || typeof address==='string')throw new Error('missing_address');
  const base=`http://127.0.0.1:${address.port}`;
  const post=(id:string,token=fixture.token())=>fetch(base+'/v1/trees/command',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({action:'resign_keeper',id})});
  try {
    sql(`INSERT INTO lifetrees VALUES ('secret','{"anchorUid":"alice","treeType":"SECRET"}');`);
    const alone=await post('secret');expect(alone.status).toBe(409);expect(await alone.json()).toEqual({error:'last_keeper'});
    const hidden=await post('secret',fixture.token({sub:'issuer-bob'}));expect(hidden.status).toBe(404);expect(await hidden.json()).toEqual({error:'tree_missing'});
    sql("INSERT INTO secret_links(from_id,rel,to_id,lid) VALUES ('','keeper','secret','malformed');");
    const malformed=await post('secret');expect(malformed.status).toBe(409);expect(await malformed.json()).toEqual({error:'identity_needs_review'});
    expect(sql("SELECT doc->>'anchorUid' FROM lifetrees;")).toBe('alice');
    expect(sql('SELECT count(*) FROM secret_links;')).toBe('1');
  } finally {server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await db.close();}
});

describe('independent tree invitations', () => {
  const query=(id:string)=>({id,tree:null,mine:false,after:null,limit:50});
  it('keeps secret roles and invitation lists private while an open capability can be claimed only once', async () => {
    const db=await apiDatabase(3);
    try {
      sql(`INSERT INTO lifetrees VALUES ('secret','{"anchorUid":"alice","treeType":"SECRET","name":"Hidden grove"}');`);
      await expect(db.treeInviteCommand('bob',{action:'mint',treeId:'secret',open:true,role:'keeper'})).rejects.toThrow('Forbidden');
      await expect(db.treeInviteCommand('alice',{action:'mint',treeId:'secret',open:true,role:'observer'})).rejects.toThrow('Secret keepers only');
      const {invite}=await db.treeInviteCommand('alice',{action:'mint',treeId:'secret',open:true,role:'keeper'});
      expect(invite.id).toMatch(/^[a-f0-9]{48}$/);
      expect((await db.treeInvites(query(invite.id),null)).invite.lifetreeName).toBe('Hidden grove');
      expect((await db.treeInvites({id:null,tree:'secret',mine:false,after:null,limit:50},'bob')).invites).toHaveLength(0);
      await expect(db.treeInviteCommand('alice',{action:'claim',id:invite.id})).rejects.toThrow('Forbidden');
      const claims=await Promise.allSettled(['bob','carol'].map(uid=>db.treeInviteCommand(uid,{action:'claim',id:invite.id})));
      expect(claims.filter(x=>x.status==='fulfilled')).toHaveLength(1);
      const winner=claims[0].status==='fulfilled' ? 'bob':'carol';
      expect((await db.treeInvites(query(invite.id),null)).invite).toBeNull();
      const accepted=await db.treeInviteCommand(winner,{action:'accept',id:invite.id});
      expect(accepted.invite.status).toBe('accepted');
      expect(sql("SELECT count(*) FROM links WHERE to_id='secret';")).toBe('0');
      expect(sql('SELECT count(*) FROM communities;')).toBe('0');
      expect(sql("SELECT from_id FROM secret_links WHERE to_id='secret';")).toBe(winner);
      expect((await db.trees({id:'secret'},winner)).access.keeper).toBe(true);
      expect((await db.trees({id:'secret'},'outsider')).tree).toBeNull();
      await expect(db.withSession(winner,(c:any)=>c.query('SELECT * FROM tree_keeping_invites'))).rejects.toThrow(/permission denied/);
    } finally {await db.close();}
  });
  it('limits steward offers to open roles and commits circle membership with acceptance', async () => {
    const db=await apiDatabase(3);
    try {
      sql(`INSERT INTO lifetrees VALUES ('tree','{"anchorUid":"alice","name":"Willow","treeType":"LIFETREE","latestHash":"head"}');
        INSERT INTO links(from_id,rel,to_id,lid) VALUES ('sam','steward','tree','sam');`);
      await expect(db.treeInviteCommand('sam',{action:'mint',treeId:'tree',open:false,member:'bob',role:'keeper'})).rejects.toThrow('Forbidden');
      const {invite}=await db.treeInviteCommand('sam',{action:'mint',treeId:'tree',open:false,member:'bob',role:'observer'});
      expect((await db.treeInvites(query(invite.id),null)).invite).toBeNull();
      await expect(db.treeInviteCommand('carol',{action:'accept',id:invite.id})).rejects.toThrow('Forbidden');
      await db.treeInviteCommand('bob',{action:'accept',id:invite.id});
      const circle=JSON.parse(sql('SELECT doc::text FROM communities;'));
      expect(circle).toMatchObject({anchorUid:'alice',rootLifetreeId:'tree',formation:'tree_keeping',domain:''});
      expect(sql("SELECT count(*) FROM links WHERE rel='member';")).toBe('2');
      expect(sql("SELECT count(*) FROM links WHERE from_id='bob' AND rel='observer' AND to_id='tree';")).toBe('1');
      expect(sql("SELECT doc->>'latestHash' FROM lifetrees WHERE id='tree';")).toBe('head');
      const second=await db.treeInviteCommand('alice',{action:'mint',treeId:'tree',open:false,member:'carol',role:'keeper'});
      await db.treeInviteCommand('carol',{action:'accept',id:second.invite.id});
      expect(sql('SELECT count(*) FROM communities;')).toBe('1');
      expect(sql("SELECT count(*) FROM links WHERE rel='member';")).toBe('3');
    } finally {await db.close();}
  });
  it('requires a living lifetree for guardians, honors the validation dial and creates no circle for a follow', async () => {
    const db=await apiDatabase();
    try {
      sql(`INSERT INTO lifetrees VALUES ('tree','{"anchorUid":"alice","treeType":"LIFETREE","validated":false}'),
        ('bed','{"anchorUid":"bob","treeType":"BED"}'),('dead','{"anchorUid":"bob","treeType":"LIFETREE","diedAt":123}');
        INSERT INTO config VALUES ('limits','{"guardiansToValidate":2}');`);
      const {invite}=await db.treeInviteCommand('alice',{action:'mint',treeId:'tree',open:false,member:'bob',role:'guardian'});
      await expect(db.treeInviteCommand('bob',{action:'accept',id:invite.id})).rejects.toThrow('Living tree required');
      sql(`INSERT INTO lifetrees VALUES ('living','{"anchorUid":"bob","treeType":"LIFETREE"}'),('carol-tree','{"anchorUid":"carol"}');`);
      expect(await db.treeInviteCommand('bob',{action:'accept',id:invite.id})).toMatchObject({validated:false,guardiansNeeded:1});
      const second=await db.treeInviteCommand('alice',{action:'mint',treeId:'tree',open:false,member:'carol',role:'guardian'});
      expect(await db.treeInviteCommand('carol',{action:'accept',id:second.invite.id})).toMatchObject({validated:true,guardiansNeeded:0});
      expect(JSON.parse(sql("SELECT doc::text FROM lifetrees WHERE id='tree';"))).toMatchObject({validated:true,validatorId:'carol',validatedBy:'guardian'});
      expect(sql('SELECT count(*) FROM communities;')).toBe('0');
    } finally {await db.close();}
  });
  it('makes revocation one-way, hides expired capabilities, and rolls back acceptance if a circle write fails', async () => {
    const db=await apiDatabase();
    try {
      sql(`INSERT INTO lifetrees VALUES ('tree','{"anchorUid":"alice","treeType":"LIFETREE"}');`);
      const open=await db.treeInviteCommand('alice',{action:'mint',treeId:'tree',open:true,role:'keeper'});
      await db.treeInviteCommand('alice',{action:'revoke',id:open.invite.id});
      expect((await db.treeInvites(query(open.invite.id),null)).invite).toBeNull();
      await expect(db.treeInviteCommand('bob',{action:'claim',id:open.invite.id})).rejects.toThrow('Invite closed');
      const expired=await db.treeInviteCommand('alice',{action:'mint',treeId:'tree',open:true,role:'keeper'});
      sql(`UPDATE tree_keeping_invites SET doc=doc || '{"expiresAt":"2000-01-01T00:00:00.000Z"}' WHERE id='${expired.invite.id}';`);
      expect((await db.treeInvites(query(expired.invite.id),null)).invite).toBeNull();
      await expect(db.treeInviteCommand('bob',{action:'claim',id:expired.invite.id})).rejects.toThrow('Invite expired');
      const named=await db.treeInviteCommand('alice',{action:'mint',treeId:'tree',open:false,member:'bob',role:'keeper'});
      sql(`CREATE FUNCTION public.fail_tree_circle() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'circle failure'; END $$;
        CREATE TRIGGER fail_tree_circle BEFORE INSERT ON communities FOR EACH ROW EXECUTE FUNCTION public.fail_tree_circle();`);
      await expect(db.treeInviteCommand('bob',{action:'accept',id:named.invite.id})).rejects.toThrow('circle failure');
      expect(sql('SELECT count(*) FROM links;')).toBe('0');
      expect((await db.treeInvites(query(named.invite.id),'bob')).invite.status).toBe('pending');
      sql('DROP TRIGGER fail_tree_circle ON communities; DROP FUNCTION public.fail_tree_circle();');
    } finally {await db.close();}
  });
});

it('carries a public tree invitation through claim and acceptance over HTTP without public ledger access', async () => {
  const db=await apiDatabase();const fixture=authFixture();const server=createApi(db,await createAuthenticator(fixture.config));
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();if(!address || typeof address==='string')throw new Error('missing_address');
  const base=`http://127.0.0.1:${address.port}`;
  const post=(value:object,token=fixture.token())=>fetch(base+'/v1/tree-invites/command',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(value)});
  const bob=fixture.token({sub:'issuer-bob'});
  try {
    sql(`INSERT INTO lifetrees VALUES ('secret','{"anchorUid":"alice","treeType":"SECRET","name":"Hidden grove"}');`);
    const minted=await post({action:'mint',treeId:'secret',open:true,role:'keeper'});expect(minted.status).toBe(200);
    const {invite}=await minted.json();
    expect((await fetch(base+'/v1/tree-invites?tree=secret')).status).toBe(401);
    expect((await fetch(base+'/v1/tree-invites?id='+invite.id)).status).toBe(200);
    expect((await post({action:'claim',id:invite.id},bob)).status).toBe(200);
    expect((await fetch(base+'/v1/tree-invites?id='+invite.id)).status).toBe(404);
    expect((await post({action:'accept',id:invite.id},bob)).status).toBe(200);
    const tree=await fetch(base+'/v1/trees?id=secret',{headers:{authorization:'Bearer '+bob}});
    expect((await tree.json()).access).toMatchObject({keeper:true,inviteMode:'all'});
    expect((await fetch(base+'/v1/trees?id=secret')).status).toBe(404);
    const replay=await post({action:'accept',id:invite.id},bob);expect(replay.status).toBe(409);expect(await replay.json()).toEqual({error:'invite_closed'});
  } finally {server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await db.close();}
});

it('searches public names with bounded pages without exposing private users or extra imported fields', async()=>{
  const db=await apiDatabase();
  try {
    await db.profile('alice',{displayName:'Willow Alice'});await db.profile('bob',{displayName:'Willow Bob'});
    sql(`UPDATE users SET doc=doc || '{"email":"private@example.test","secret":"private"}';
      UPDATE persons SET doc=doc || '{"extra":"not part of the name projection","uid":"forged"}' WHERE id='alice';`);
    const query={id:null,query:'willow',after:null,limit:1};
    const page=await db.people(query);expect(page.people).toHaveLength(1);expect(page.next).toBe('alice');
    expect(page.people[0]).toEqual({uid:'alice',lid:expect.any(String),displayName:'Willow Alice'});
    expect((await db.people({...query,after:page.next})).people[0].uid).toBe('bob');
    expect((await db.people({...query,query:"' OR 1=1 --"})).people).toHaveLength(0);
    expect((await db.people({...query,query:'%'})).people).toHaveLength(0);
    expect(await db.people({id:'missing',query:null,after:null,limit:50})).toEqual({person:null});
    // Private accounts stay out of an anonymous hand's sight (RLS); persons are the public record by law.
    expect((await db.withSession(null,(c:any)=>c.query('SELECT * FROM users'))).rows).toHaveLength(0);
    await expect(db.withSession(null,(c:any)=>c.query('SELECT * FROM seed.identity_bindings'))).rejects.toThrow(/permission denied/);
    const server=createApi(db);await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
    const address=server.address();if(!address || typeof address==='string')throw new Error('missing_address');
    try {
      const response=await fetch(`http://127.0.0.1:${address.port}/v1/people?id=alice`);
      expect(response.status).toBe(200);expect((await response.json()).person).toEqual(page.people[0]);
      expect((await fetch(`http://127.0.0.1:${address.port}/v1/people?email=private`)).status).toBe(400);
    } finally {server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
  } finally {await db.close();}
});

describe('independent circle formation',()=>{
  it('lets circle or root-tree keepers form once, binding birthplace without granting seats or claiming a domain',async()=>{
    const db=await apiDatabase(3);
    const form=(uid:string)=>db.communityCommand(uid,{action:'form_circle',id:'circle',name:'Standing Garden'},null);
    try {
      sql(`INSERT INTO lifetrees VALUES ('tree','{"anchorUid":"bob","domain":" HTTPS://WWW.Garden.Example:443/path?q=a "}');
        INSERT INTO communities VALUES ('circle','{"anchorUid":"alice","rootLifetreeId":"tree","formation":"tree_keeping","domain":"","name":"Old Circle","lid":"stable","latestHash":"head","visibility":"invited"}');
        INSERT INTO links(from_id,rel,to_id,lid) VALUES ('sam','steward','tree','steward');`);
      await expect(form('sam')).rejects.toThrow('Forbidden');
      await expect(form('outsider')).rejects.toThrow('Forbidden');
      expect((await db.communities({id:'circle'},'bob')).access.canFormCircle).toBe(true);
      const results=await Promise.allSettled([form('alice'),form('bob')]);
      expect(results.filter(x=>x.status==='fulfilled')).toHaveLength(1);
      expect(results.filter(x=>x.status==='rejected')).toHaveLength(1);
      const circle=JSON.parse(sql("SELECT doc::text FROM communities WHERE id='circle';"));
      expect(circle).toMatchObject({name:'Standing Garden',bornOn:'garden.example',domain:'',anchorUid:'alice',lid:'stable',latestHash:'head',visibility:'public'});
      expect(['alice','bob']).toContain(circle.formedBy);expect(circle.formedAt).toBeTruthy();
      expect(sql("SELECT count(*) FROM links WHERE to_id='circle';")).toBe('0');
      expect((await db.communities({id:'circle'},'bob')).access.canFormCircle).toBe(false);
    } finally {await db.close();}
  });
  it('refuses missing/secret roots and non-circles, and preserves the circle on a failed update',async()=>{
    const db=await apiDatabase();
    const form=(id:string)=>db.communityCommand('alice',{action:'form_circle',id},null);
    try {
      sql(`INSERT INTO lifetrees VALUES ('tree','{"anchorUid":"alice"}'),('secret','{"anchorUid":"alice","treeType":"SECRET"}');
        INSERT INTO communities VALUES ('ordinary','{"anchorUid":"alice"}'),
          ('broken','{"anchorUid":"alice","formation":"tree_keeping","rootLifetreeId":"missing"}'),
          ('leak','{"anchorUid":"alice","formation":"tree_keeping","rootLifetreeId":"secret"}'),
          ('circle','{"anchorUid":"alice","formation":"tree_keeping","rootLifetreeId":"tree","name":"Original"}');`);
      await expect(form('ordinary')).rejects.toThrow('Not a tree circle');
      await expect(form('broken')).rejects.toThrow('Circle identity needs review');
      await expect(form('leak')).rejects.toThrow('Circle identity needs review');
      sql(`CREATE FUNCTION public.reject_circle_form() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'formation failure'; END $$;
        CREATE TRIGGER reject_circle_form BEFORE UPDATE ON communities FOR EACH ROW EXECUTE FUNCTION public.reject_circle_form();`);
      await expect(form('circle')).rejects.toThrow('formation failure');
      expect(sql("SELECT doc ? 'formedAt' FROM communities WHERE id='circle';")).toBe('f');
      sql('DROP TRIGGER reject_circle_form ON communities; DROP FUNCTION public.reject_circle_form();');
      expect(await form('circle')).toMatchObject({name:'Original',bornOn:null});
    } finally {await db.close();}
  });
});

it('retries confirmed transaction aborts with the same identity and no partial writes, with a strict attempt bound',async()=>{
  const db=await apiDatabase();
  try {
    sql(`CREATE SEQUENCE public.retry_test_attempt;
      CREATE FUNCTION public.retry_test() RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
      DECLARE n bigint:=nextval('public.retry_test_attempt');
      BEGIN
        INSERT INTO public.links(from_id,rel,to_id,lid) VALUES(seed.uid(),'joined','retry-'||n,'retry-'||n);
        IF n=1 THEN RAISE EXCEPTION 'retry once' USING ERRCODE='40001'; END IF;
        RETURN seed.uid();
      END $$;`);
    expect(await db.withSession('alice',async(c:any)=>(await c.query('SELECT public.retry_test() AS uid')).rows[0].uid)).toBe('alice');
    expect(sql("SELECT from_id || ':' || to_id FROM links;")).toBe('alice:retry-2');
    sql(`CREATE OR REPLACE FUNCTION public.retry_test() RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
      BEGIN PERFORM nextval('public.retry_test_attempt'); RAISE EXCEPTION 'always deadlocked' USING ERRCODE='40P01'; END $$;`);
    await expect(db.withSession('bob',(c:any)=>c.query('SELECT public.retry_test()'))).rejects.toThrow('always deadlocked');
    expect(sql('SELECT last_value FROM public.retry_test_attempt;')).toBe('5');
    sql('DROP FUNCTION public.retry_test(); DROP SEQUENCE public.retry_test_attempt;');
    expect(await db.withSession(null,async(c:any)=>(await c.query('SELECT seed.uid() AS uid')).rows[0].uid)).toBeNull();
  } finally {await db.close();}
});

it('forms circles over authenticated HTTP and refuses forged formation stamps',async()=>{
  const db=await apiDatabase();const fixture=authFixture();const server=createApi(db,await createAuthenticator(fixture.config));
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();
  if(!address || typeof address==='string')throw new Error('missing_address');
  const post=(body:object)=>fetch(`http://127.0.0.1:${address.port}/v1/communities/command`,{method:'POST',headers:{authorization:'Bearer '+fixture.token(),'content-type':'application/json'},body:JSON.stringify(body)});
  try {
    sql(`INSERT INTO lifetrees VALUES ('tree','{"anchorUid":"alice","domain":"garden.example"}');
      INSERT INTO communities VALUES ('circle','{"anchorUid":"alice","formation":"tree_keeping","rootLifetreeId":"tree","name":"Circle","domain":""}');`);
    expect((await post({action:'form_circle',id:'circle',formedBy:'other'})).status).toBe(400);
    const result=await post({action:'form_circle',id:'circle',name:'Garden'});expect(result.status).toBe(200);
    expect(await result.json()).toEqual({communityId:'circle',name:'Garden',bornOn:'garden.example'});
    const repeat=await post({action:'form_circle',id:'circle'});expect(repeat.status).toBe(409);expect(await repeat.json()).toEqual({error:'already_formed'});
  } finally {server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await db.close();}
});

it('recovers a real PostgreSQL deadlock without duplicating committed changes',async()=>{
  const db=await apiDatabase(3);
  try {
    sql(`INSERT INTO lifetrees VALUES ('lock-a','{"count":0}'),('lock-b','{"count":0}');
      CREATE FUNCTION public.increment_retry_tree(target text) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $$
        UPDATE public.lifetrees SET doc=jsonb_set(doc,'{count}',to_jsonb((doc->>'count')::integer+1)) WHERE id=target;
      $$;`);
    let arrived=0,release=()=>{};
    const barrier=new Promise<void>(resolve=>{release=resolve;});
    const run=(uid:string,first:string,second:string)=>db.withSession(uid,async(c:any)=>{
      await c.query('SELECT public.increment_retry_tree($1)',[first]);
      if(++arrived===2)release();await barrier;
      await c.query('SELECT public.increment_retry_tree($1)',[second]);
      return (await c.query('SELECT seed.uid() AS uid')).rows[0].uid;
    });
    expect(await Promise.all([run('alice','lock-a','lock-b'),run('bob','lock-b','lock-a')])).toEqual(['alice','bob']);
    expect(arrived).toBe(3);
    expect(sql("SELECT doc->>'count' FROM lifetrees ORDER BY id;")).toBe('2\n2');
    sql('DROP FUNCTION public.increment_retry_tree(text);');
  } finally {await db.close();}
});

it('keeps private and public person identity aligned and refuses incomplete or conflicting imports',async()=>{
  const db=await apiDatabase(3);
  try {
    const {profile}=await db.profile('alice',{displayName:'Alice'});
    expect(JSON.parse(sql("SELECT doc::text FROM users WHERE id='alice';"))).toMatchObject({uid:'alice',lid:profile.lid});
    sql("UPDATE users SET doc=(doc-'lid') || '{\"private\":\"preserved\"}' WHERE id='alice';");
    await db.profile('alice',{displayName:'Renamed'});
    expect(JSON.parse(sql("SELECT doc::text FROM users WHERE id='alice';"))).toMatchObject({lid:profile.lid,private:'preserved'});
    sql(`UPDATE users SET doc=doc || '{"lid":"01900000-0000-7000-8000-000000000001"}' WHERE id='alice';`);
    await expect(db.profile('alice',{displayName:'Must not change'})).rejects.toThrow('Identity needs review');
    expect((await db.profile('alice')).profile.displayName).toBe('Renamed');
    sql(`INSERT INTO users VALUES ('bob','{"lid":"01900000-0000-7000-8000-000000000002","displayName":"Imported"}');`);
    await expect(db.profile('bob',{displayName:'Bob'})).rejects.toThrow('Identity needs review');
    expect(sql("SELECT count(*) FROM persons WHERE id='bob';")).toBe('0');
    sql(`INSERT INTO users VALUES ('carol','{"uid":"other"}');`);
    await expect(db.profile('carol',{displayName:'Carol'})).rejects.toThrow('Identity needs review');
  } finally {await db.close();}
});

it('authorizes media by canonical identities and keeper links, publishing immutable manifests atomically',async()=>{
  const db=await apiDatabase();
  const descriptor={hash:'a'.repeat(64),type:'image/webp',size:100};
  const manifest={primary:descriptor,small:descriptor,large:descriptor};
  try {
    const {profile}=await db.profile('alice',{displayName:'Alice'});
    sql(`INSERT INTO communities VALUES ('garden','{"anchorUid":"bob","keeperUids":["forged"]}');
      INSERT INTO links(from_id,rel,to_id,lid) VALUES ('alice','keeper','garden','keeper'),('sam','steward','garden','steward');
      INSERT INTO admins VALUES ('staff','{}');`);
    expect(await db.mediaAllowed(null,'users/alice/x.webp')).toBe(false);
    expect(await db.mediaAllowed('alice','users/alice/x.webp')).toBe(true);
    expect(await db.mediaAllowed('bob','users/alice/x.webp')).toBe(false);
    expect(await db.mediaAllowed('alice',`beings/${profile.lid}/x.webp`)).toBe(true);
    expect(await db.mediaAllowed('bob',`beings/${profile.lid}/x.webp`)).toBe(false);
    expect(await db.mediaAllowed('alice','communities/garden/x.webp')).toBe(true);
    expect(await db.mediaAllowed('sam','communities/garden/x.webp')).toBe(false);
    expect(await db.mediaAllowed('forged','communities/garden/x.webp')).toBe(false);
    expect(await db.mediaAllowed('alice','collabs/org.webp')).toBe(true);
    expect(await db.mediaAllowed('staff','custom/photo.webp')).toBe(true);
    expect(await db.mediaAllowed('staff','thumbs/users/alice/x.webp')).toBe(false);
    expect(await db.mediaAllowed('staff','users/alice/../x.webp')).toBe(false);
    await db.mediaPublish('alice','users/alice/x.webp',manifest);
    expect(await db.mediaGet('users/alice/x.webp')).toMatchObject(manifest);
    await expect(db.mediaPublish('alice','users/alice/x.webp',manifest)).rejects.toThrow('Media path already exists');
    await expect(db.mediaPublish('bob','users/alice/other.webp',manifest)).rejects.toThrow('Forbidden');
    await expect(db.mediaPublish('alice','users/alice/bad.webp',{...manifest,small:{...descriptor,hash:'../secret'}})).rejects.toThrow('Invalid media manifest');
    expect(await db.mediaGet('users/alice/bad.webp')).toBeNull();
    await expect(db.withSession('staff',(c:any)=>c.query('SELECT * FROM seed.media_objects'))).rejects.toThrow(/permission denied/);
    sql("UPDATE users SET doc=doc-'lid' WHERE id='alice';");
    expect(await db.mediaAllowed('alice',`beings/${profile.lid}/x.webp`)).toBe(false);
  } finally {await db.close();}
});

it('creates and edits visions without surrendering attribution or chain history',async()=>{
  const db=await apiDatabase();
  const birth={action:'create',title:'Garden',body:'Together',visibility:'private'};
  try {
    const {vision}=await db.visionCommand('alice',birth,'garden.example');
    expect(vision).toMatchObject({authorId:'alice',domain:'garden.example',blockHeight:0,latestHash:vision.genesisHash});
    const {createBlock}=await import('../../src/domain/chain/hash');
    expect(vision.genesisHash).toBe(await createBlock('0',{msg:'Birth'},vision.genesisAtMs));
    const edit={action:'edit',id:vision.id,title:'Growing',body:'New words',visibility:'public'};
    await expect(db.visionCommand('bob',edit,'other.example')).rejects.toMatchObject({code:'LS025'});
    for(const extra of [{authorId:'bob'},{latestHash:'forged'},{lid:'forged'},{domain:'other'}])await expect(db.visionCommand('alice',{...edit,...extra},'garden.example')).rejects.toMatchObject({code:'22023'});
    const changed=(await db.visionCommand('alice',edit,'other.example')).vision;
    expect(changed).toMatchObject({...vision,title:'Growing',body:'New words',visibility:'public'});
    sql(`UPDATE visions SET doc=doc || '{"latestHash":"signed-head","blockHeight":7,"imageUrl":"preserved-picture","communityId":"original-community"}' WHERE id='${vision.id}';`);
    expect((await db.visionCommand('alice',edit,'other.example')).vision).toMatchObject({latestHash:'signed-head',blockHeight:7,imageUrl:'preserved-picture',communityId:'original-community',genesisHash:vision.genesisHash});
    await expect(db.visionCommand('bob',edit,'other.example')).rejects.toMatchObject({code:'42501'});
    sql(`INSERT INTO admins VALUES ('staff','{}'); INSERT INTO visions VALUES ('missing-author','{"visibility":"public"}'),('numeric-author','{"visibility":"public","authorId":123}');`);
    for(const id of ['missing-author','numeric-author'])await expect(db.visionCommand('123',{...edit,id},'garden.example')).rejects.toMatchObject({code:'42501'});
    expect((await db.visionCommand('staff',{...edit,visibility:'private'},'other.example')).vision.authorId).toBe('alice');
    await expect(db.withSession('alice',(c:any)=>c.query("UPDATE public.visions SET doc='{}'"))).rejects.toThrow(/permission denied/);
  } finally {await db.close();}
});

it('orders vision pictures atomically without changing authority or signed history',async()=>{
  const db=await apiDatabase();
  try {
    const {vision}=await db.visionCommand('alice',{action:'create',title:'Garden',body:'Together',visibility:'private'},'garden.example');
    const descriptor={hash:'b'.repeat(64),size:100,type:'image/webp'};
    for(const name of ['a','b'])await db.mediaPublish('alice',`users/alice/${name}.webp`,{primary:descriptor,small:descriptor,large:descriptor});
    const command={action:'set_pictures',id:vision.id,paths:['users/alice/b.webp','users/alice/a.webp']};
    await expect(db.visionCommand('bob',command,null)).rejects.toMatchObject({code:'LS025'});
    const updated=(await db.visionCommand('alice',command,null)).vision;
    expect(updated).toMatchObject({...vision,imageUrls:['/v1/media?path=users/alice/b.webp','/v1/media?path=users/alice/a.webp'],imageUrl:'/v1/media?path=users/alice/b.webp'});
    await expect(db.visionCommand('alice',{...command,paths:['users/alice/missing.webp']},null)).rejects.toMatchObject({code:'22023'});
    await expect(db.visionCommand('alice',{...command,paths:['users/alice/a.webp','users/alice/a.webp']},null)).rejects.toMatchObject({code:'22023'});
    expect((await db.visions(seedVisionQuery(new URLSearchParams({id:vision.id})),'alice')).vision.imageUrls).toEqual(updated.imageUrls);
    await db.visionCommand('alice',{action:'edit',id:vision.id,title:'Garden',body:'Together',visibility:'public'},null);
    await expect(db.visionCommand('bob',command,null)).rejects.toMatchObject({code:'42501'});
    sql(`INSERT INTO admins VALUES ('staff','{}'); INSERT INTO visions VALUES ('bad-author','{"visibility":"public","authorId":123}');`);
    await expect(db.visionCommand('123',{...command,id:'bad-author'},null)).rejects.toMatchObject({code:'42501'});
    expect((await db.visionCommand('staff',{...command,paths:[]},null)).vision).toMatchObject({imageUrls:[],imageUrl:'',genesisHash:vision.genesisHash,authorId:'alice'});
  } finally {await db.close();}
});

it('releases only authorized vision records and incoming links while signed history stands',async()=>{
  const db=await apiDatabase();
  try {
    const {vision}=await db.visionCommand('alice',{action:'create',title:'Garden',body:'Together',visibility:'public'},'garden.example');
    sql(`INSERT INTO lifetrees VALUES ('kept','{"anchorUid":"alice"}'),('other','{"anchorUid":"bob"}');
      INSERT INTO pulses VALUES ('signed','{"visionId":"${vision.id}","hash":"signed-block","signature":"preserved"}');
      INSERT INTO links(from_id,rel,to_id,lid) VALUES
        ('alice','joined','${vision.id}','own'),('bob','joined','${vision.id}','other'),
        ('kept','participant','${vision.id}','kept'),('other','participant','${vision.id}','unkept'),
        ('alice','invited_by','${vision.id}','arrival'),('alice','party','${vision.id}','party'),
        ('${vision.id}','recognises','other','outgoing');`);
    const before=sql('SELECT doc::text FROM pulses;');
    await expect(db.visionCommand('bob',{action:'release',id:vision.id},null)).rejects.toMatchObject({code:'42501'});
    expect((await db.visionCommand('alice',{action:'release',id:vision.id},null))).toEqual({released:vision.id,removedLinks:2});
    expect(sql('SELECT doc::text FROM pulses;')).toBe(before);
    expect(sql('SELECT lid FROM links ORDER BY lid;')).toBe('arrival\nother\noutgoing\nparty\nunkept');
    expect((await db.visions(seedVisionQuery(new URLSearchParams({id:vision.id})),'alice')).vision).toBeNull();
    await expect(db.visionCommand('alice',{action:'release',id:vision.id},null)).rejects.toMatchObject({code:'LS025'});
    const privateVision=(await db.visionCommand('alice',{action:'create',title:'Private',body:'',visibility:'private'},'garden.example')).vision;
    await expect(db.visionCommand('bob',{action:'release',id:privateVision.id},null)).rejects.toMatchObject({code:'LS025'});
    sql("INSERT INTO admins VALUES ('staff','{}');");
    expect((await db.visionCommand('staff',{action:'release',id:privateVision.id},null)).released).toBe(privateVision.id);
    expect(sql('SELECT doc::text FROM pulses;')).toBe(before);
  } finally {await db.close();}
});

it('rolls back vision link cleanup when releasing the record fails',async()=>{
  const db=await apiDatabase();
  try {
    const {vision}=await db.visionCommand('alice',{action:'create',title:'Garden',body:'',visibility:'public'},'garden.example');
    await db.linkCommand('alice',{action:'link',from:'alice',rel:'joined',to:vision.id});
    sql(`CREATE FUNCTION public.refuse_vision_release() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'blocked release' USING ERRCODE='23514'; END $$;
      CREATE TRIGGER refuse_release BEFORE DELETE ON visions FOR EACH ROW EXECUTE FUNCTION public.refuse_vision_release();`);
    await expect(db.visionCommand('alice',{action:'release',id:vision.id},null)).rejects.toMatchObject({code:'23514'});
    expect(sql('SELECT count(*) FROM visions;')).toBe('1');
    expect(sql("SELECT count(*) FROM links WHERE rel='joined';")).toBe('1');
    await expect(db.withSession('alice',(c:any)=>c.query("SELECT seed.release_link_allowed('alice','joined','vision')"))).rejects.toThrow(/permission denied/);
    await expect(db.withSession('alice',(c:any)=>c.query('DELETE FROM visions'))).rejects.toThrow(/permission denied/);
  } finally {await db.close();}
});

it('anchors public signing keys atomically and preserves lineage across retries and frozen states',async()=>{
  const db=await apiDatabase(3);
  const {generateKeyPairSync,createHash}=await import('node:crypto');
  const key=()=>generateKeyPairSync('ed25519').publicKey.export({format:'der',type:'spki'}).toString('base64');
  const publicKeyB64=key(),other=key(),command={action:'anchor',publicKeyB64};
  try {
    await expect(db.signingCommand('alice',command)).rejects.toMatchObject({code:'LS001'});
    const {profile}=await db.profile('alice',{displayName:'Alice'});
    sql("UPDATE persons SET doc=doc || '{\"otherField\":\"preserved\"}' WHERE id='alice';");
    const results=await Promise.all([db.signingCommand('alice',command),db.signingCommand('alice',command)]);
    const fingerprint=createHash('sha256').update(publicKeyB64).digest('hex');
    expect(results[0]).toEqual(results[1]);
    expect(results[0].identity).toEqual({uid:'alice',lid:profile.lid,publicKeyB64,fingerprint,epochId:'anchor_'+fingerprint,state:'active'});
    const lineage=sql('SELECT doc::text FROM person_keys;'),event=sql('SELECT doc::text FROM person_key_events;');
    expect(sql('SELECT count(*) FROM person_key_events;')).toBe('1');
    expect(JSON.parse(event)).toMatchObject({type:'anchor',uid:'alice',lid:profile.lid,keyFingerprint:fingerprint});
    await expect(db.signingCommand('alice',{...command,publicKeyB64:other})).rejects.toMatchObject({code:'LS026'});
    await expect(db.signingCommand('alice',{...command,uid:'bob'})).rejects.toMatchObject({code:'22023'});
    sql("UPDATE persons SET doc=doc || '{\"signingState\":\"frozen\"}' WHERE id='alice';");
    expect((await db.signingCommand('alice',command)).identity.state).toBe('frozen');
    expect(sql('SELECT doc::text FROM person_keys;')).toBe(lineage);
    expect(sql('SELECT doc::text FROM person_key_events;')).toBe(event);
    expect(sql("SELECT doc->>'otherField' FROM persons WHERE id='alice';")).toBe('preserved');
    expect((await db.signingIdentity('alice')).identity).not.toHaveProperty('otherField');
    expect(await db.signingIdentity('missing')).toEqual({identity:null});
    await expect(db.withSession('alice',(c:any)=>c.query('DELETE FROM person_key_events'))).rejects.toThrow(/permission denied/);
    await expect(db.withSession('alice',(c:any)=>c.query('UPDATE person_keys SET doc=\'{}\''))).rejects.toThrow(/permission denied/);
    sql("DELETE FROM person_keys;");
    expect((await db.signingCommand('alice',command)).identity.state).toBe('frozen');
    expect(sql('SELECT doc::text FROM person_key_events;')).toBe(event);
    sql("UPDATE users SET doc=doc || '{\"uid\":\"other\"}' WHERE id='alice';");
    await expect(db.signingCommand('alice',command)).rejects.toMatchObject({code:'LS026'});
  } finally {await db.close();}
});

it('anchors only a matching legacy key and refuses inconsistent imported key histories',async()=>{
  const db=await apiDatabase();const {generateKeyPairSync}=await import('node:crypto');
  const publicKeyB64=generateKeyPairSync('ed25519').publicKey.export({format:'der',type:'spki'}).toString('base64');
  try {
    await db.profile('alice',{displayName:'Alice'});
    sql(`UPDATE persons SET doc=doc || jsonb_build_object('publicKeyPem','${publicKeyB64}') WHERE id='alice';`);
    expect((await db.signingCommand('alice',{action:'anchor',publicKeyB64})).identity.state).toBe('active');
    sql("DELETE FROM person_key_events;");
    await expect(db.signingCommand('alice',{action:'anchor',publicKeyB64})).rejects.toMatchObject({code:'LS026'});
    expect(sql('SELECT count(*) FROM person_key_events;')).toBe('0');
  } finally {await db.close();}
});

it('freezes only the observed signing epoch and exposes immutable public history in bounded pages',async()=>{
  const db=await apiDatabase(3);const {generateKeyPairSync}=await import('node:crypto');
  const publicKeyB64=generateKeyPairSync('ed25519').publicKey.export({format:'der',type:'spki'}).toString('base64');
  try {
    await db.profile('alice',{displayName:'Alice'});await db.profile('bob',{displayName:'Bob'});
    const {identity}=await db.signingCommand('alice',{action:'anchor',publicKeyB64});
    const command={action:'freeze',epochId:identity.epochId,fingerprint:identity.fingerprint};
    await expect(db.signingCommand('bob',command)).rejects.toMatchObject({code:'LS026'});
    await expect(db.signingCommand('alice',{...command,epochId:'stale'})).rejects.toMatchObject({code:'LS026'});
    await expect(db.signingCommand('alice',{...command,suspectedSinceMs:0})).rejects.toMatchObject({code:'22023'});
    await expect(db.signingCommand('alice',{...command,suspectedSinceMs:Date.now()+3600000})).rejects.toMatchObject({code:'22023'});
    expect((await db.signingIdentity('alice')).identity.state).toBe('active');
    const claimed=Date.now();
    const results=await Promise.all([db.signingCommand('alice',{...command,suspectedSinceMs:claimed}),db.signingCommand('alice',command)]);
    expect(results[0].identity.state).toBe('frozen');expect(results[0]).toEqual(results[1]);
    const first=await db.signingHistory({id:'alice',collection:'events',after:null,limit:1});
    expect(first.items[0].type).toBe('anchor');expect(first.next).toBe(identity.epochId);
    const second=await db.signingHistory({id:'alice',collection:'events',after:first.next,limit:1});
    expect(second.items[0]).toMatchObject({type:'freeze',epochId:identity.epochId,keyFingerprint:identity.fingerprint});
    expect(second.items[0]).not.toHaveProperty('suspectedSince');expect(second.next).toBeNull();
    const receipt=sql('SELECT doc::text FROM person_key_events ORDER BY id;');
    await db.signingCommand('alice',command);
    expect(sql('SELECT doc::text FROM person_key_events ORDER BY id;')).toBe(receipt);
    expect((await db.signingCommand('alice',{action:'anchor',publicKeyB64})).identity.state).toBe('frozen');
    const keys=await db.signingHistory({id:'alice',collection:'keys',after:null,limit:50});
    expect(keys.items).toHaveLength(1);expect(keys.items[0].pubkey).toBe(publicKeyB64);
    expect(await db.signingHistory({id:'bob',collection:'events',after:null,limit:50})).toEqual({items:[],next:null});
    await expect(db.signingHistory({id:'alice',collection:'recoveries',after:null,limit:50})).rejects.toMatchObject({code:'22023'});
    await expect(db.signingHistory({id:'alice',collection:'events',after:null,limit:101})).rejects.toMatchObject({code:'22023'});
    sql("UPDATE person_key_events SET doc=doc-'recordedAt' WHERE doc->>'type'='freeze'; UPDATE persons SET doc=doc-'signingFrozenAt' WHERE id='alice';");
    await expect(db.signingCommand('alice',command)).rejects.toMatchObject({code:'LS026'});
    sql("UPDATE persons SET doc=doc || '{\"signingEpochId\":\"different\"}' WHERE id='alice';");
    await expect(db.signingCommand('alice',command)).rejects.toMatchObject({code:'LS026'});
  } finally {await db.close();}
});

it('rotates signing keys only with both proofs, preserving history and refusing races, reuse and frozen epochs',async()=>{
  const db=await apiDatabase(3);const {generateKeyPairSync,createHash,sign}=await import('node:crypto');
  const {seedRotationPreimage}=await import('../../src/domain/seedSigning.mjs');
  const old=generateKeyPairSync('ed25519'),next=generateKeyPairSync('ed25519'),rival=generateKeyPairSync('ed25519');
  const pub=(key:typeof old)=>key.publicKey.export({format:'der',type:'spki'}).toString('base64');
  const fp=(key:typeof old)=>createHash('sha256').update(pub(key)).digest('hex');
  try {
    const {profile}=await db.profile('alice',{displayName:'Alice'});
    await db.signingCommand('alice',{action:'anchor',publicKeyB64:pub(old)});
    const proof=(from:typeof old,to:typeof old,eventId:string)=>{
      const command={action:'rotate',eventId,lid:profile.lid,fromPubkey:pub(from),toPubkey:pub(to),fromFingerprint:fp(from),toFingerprint:fp(to)};
      const bytes=Buffer.from(seedRotationPreimage('alice',command));
      return {...command,oldSig:sign(null,bytes,from.privateKey).toString('base64'),newSig:sign(null,bytes,to.privateKey).toString('base64')};
    };
    const command=proof(old,next,'rotation-a');
    const original=sql('SELECT doc::text FROM person_keys;'),anchor=sql('SELECT doc::text FROM person_key_events;');
    await expect(db.signingCommand('bob',command)).rejects.toMatchObject({code:'42501'});
    await expect(db.signingCommand('alice',{...command,oldSig:command.newSig})).rejects.toMatchObject({code:'42501'});
    expect(sql('SELECT count(*) FROM person_keys;')).toBe('1');
    const attempts=await Promise.allSettled([db.signingCommand('alice',command),db.signingCommand('alice',proof(old,rival,'rotation-b'))]);
    expect(attempts.filter(result=>result.status==='fulfilled')).toHaveLength(1);
    expect(attempts.filter(result=>result.status==='rejected')).toHaveLength(1);
    const current=(await db.signingIdentity('alice')).identity;
    const winner=current.fingerprint===fp(next)?next:rival;
    expect(current.state).toBe('active');expect(current.publicKeyB64).toBe(pub(winner));
    expect(sql(`SELECT doc::text FROM person_keys WHERE id='${fp(old)}';`)).toBe(original);
    expect(sql("SELECT doc::text FROM person_key_events WHERE doc->>'type'='anchor';")).toBe(anchor);
    const history=await db.signingHistory({id:'alice',collection:'events',after:null,limit:100});
    const rotation=history.items.find((item:any)=>item.type==='rotate');
    expect(rotation).toMatchObject({previousFingerprint:fp(old),keyFingerprint:fp(winner),epochId:current.epochId});
    expect(sql('SELECT count(*) FROM person_keys;')).toBe('2');
    await expect(db.signingCommand('alice',proof(winner,old,'reuse'))).rejects.toMatchObject({code:'LS027'});
    await expect(db.signingCommand('alice',command)).rejects.toMatchObject({code:'LS026'});
    await db.signingCommand('alice',{action:'freeze',epochId:current.epochId,fingerprint:current.fingerprint});
    const fresh=generateKeyPairSync('ed25519');
    await expect(db.signingCommand('alice',proof(winner,fresh,'frozen-rotation'))).rejects.toMatchObject({code:'LS026'});
    expect((await db.signingIdentity('alice')).identity.state).toBe('frozen');
    expect(sql('SELECT count(*) FROM person_keys;')).toBe('2');
  } finally {await db.close();}
});

it('opens recovery proposals only with frozen server facts and a matching fresh-key proof',async()=>{
  const db=await apiDatabase(3);const {generateKeyPairSync,createHash,sign}=await import('node:crypto');
  const {seedRecoveryPreimage}=await import('../../src/domain/seedSigning.mjs');
  const old=generateKeyPairSync('ed25519'),candidate=generateKeyPairSync('ed25519');
  const pub=(key:typeof old)=>key.publicKey.export({format:'der',type:'spki'}).toString('base64');
  try {
    await db.profile('alice',{displayName:'Alice'});await db.profile('bob',{displayName:'Bob'});
    const {identity}=await db.signingCommand('alice',{action:'anchor',publicKeyB64:pub(old)});
    await expect(db.recoveryContext('alice')).rejects.toMatchObject({code:'LS026'});
    await db.signingCommand('alice',{action:'freeze',epochId:identity.epochId,fingerprint:identity.fingerprint});
    const {context}=await db.recoveryContext('alice');
    expect(context).toMatchObject({uid:'alice',lid:identity.lid,fromFingerprint:identity.fingerprint});
    expect(Number.isSafeInteger(context.suspectedSinceMs)).toBe(true);
    const command={action:'begin_recovery',eventId:'recovery-one',toPubkey:pub(candidate),toFingerprint:createHash('sha256').update(pub(candidate)).digest('hex')};
    const proof={...command,newSig:sign(null,Buffer.from(seedRecoveryPreimage({...context,...command})),candidate.privateKey).toString('base64')};
    await expect(db.signingCommand('alice',{...proof,eventId:'changed'})).rejects.toMatchObject({code:'42501'});
    await expect(db.signingCommand('bob',proof)).rejects.toMatchObject({code:'LS026'});
    const results=await Promise.allSettled([db.signingCommand('alice',proof),db.signingCommand('alice',proof)]);
    expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);
    expect(results.filter(result=>result.status==='rejected')).toHaveLength(1);
    expect((await db.signingIdentity('alice')).identity).toEqual({...identity,state:'frozen'});
    expect(sql('SELECT count(*) FROM person_keys;')).toBe('1');
    expect(sql('SELECT count(*) FROM person_key_events;')).toBe('2');
    const proposal=(await db.recoveryProposal('bob','alice','recovery-one')).proposal;
    expect(proposal).toMatchObject({...context,status:'open',toPubkey:pub(candidate),toFingerprint:command.toFingerprint,newSig:proof.newSig});
    await expect(db.recoveryProposal(null,'alice','recovery-one')).rejects.toMatchObject({code:'28000'});
    await expect(db.withSession('alice',(c:any)=>c.query('UPDATE person_key_recoveries SET doc=\'{}\''))).rejects.toThrow(/permission denied/);
    expect(await db.recoveryProposal('bob','alice','missing')).toEqual({proposal:null});
    sql("UPDATE person_key_events SET doc=jsonb_set(doc,'{recordedAt}','\"infinity\"') WHERE doc->>'type'='freeze'; UPDATE persons SET doc=doc || '{\"signingFrozenAt\":\"infinity\"}' WHERE id='alice';");
    await expect(db.recoveryContext('alice')).rejects.toMatchObject({code:'LS026'});
  } finally {await db.close();}
});

it('collects only current, eligible, UID-bound recovery witnesses without activating the candidate',async()=>{
  const db=await apiDatabase(3);const {generateKeyPairSync,createHash,sign}=await import('node:crypto');
  const {seedRecoveryPreimage,seedRecoveryWitnessPreimage}=await import('../../src/domain/seedSigning.mjs');
  const old=generateKeyPairSync('ed25519'),candidate=generateKeyPairSync('ed25519'),witness=generateKeyPairSync('ed25519');
  const pub=(key:typeof old)=>key.publicKey.export({format:'der',type:'spki'}).toString('base64');
  try {
    await db.profile('alice',{displayName:'Alice'});await db.profile('bob',{displayName:'Bob'});
    const {identity}=await db.signingCommand('alice',{action:'anchor',publicKeyB64:pub(old)});
    const bob=(await db.signingCommand('bob',{action:'anchor',publicKeyB64:pub(witness)})).identity;
    await db.signingCommand('alice',{action:'freeze',epochId:identity.epochId,fingerprint:identity.fingerprint});
    const {context}=await db.recoveryContext('alice');
    const begin={action:'begin_recovery',eventId:'recover',toPubkey:pub(candidate),toFingerprint:createHash('sha256').update(pub(candidate)).digest('hex')};
    await db.signingCommand('alice',{...begin,newSig:sign(null,Buffer.from(seedRecoveryPreimage({...context,...begin})),candidate.privateKey).toString('base64')});
    const proposal=(await db.recoveryProposal('bob','alice','recover')).proposal;
    const command={action:'witness_recovery',targetUid:'alice',eventId:'recover',pubkey:pub(witness),keyFingerprint:bob.fingerprint,epochId:bob.epochId,
      sig:sign(null,Buffer.from(seedRecoveryWitnessPreimage({...proposal,eventId:'recover'},'bob')),witness.privateKey).toString('base64')};
    await expect(db.signingCommand('bob',command)).rejects.toMatchObject({code:'42501'});
    for(const kind of ['BED','SECRET']) {
      sql(`INSERT INTO lifetrees VALUES ('excluded','{"anchorUid":"bob","validated":true,"treeType":"${kind}"}');`);
      await expect(db.signingCommand('bob',command)).rejects.toMatchObject({code:'42501'});
      sql("DELETE FROM lifetrees WHERE id='excluded';");
    }
    sql(`INSERT INTO lifetrees VALUES ('root','{"anchorUid":"other","validated":true,"treeType":"LIFETREE"}');
      INSERT INTO links(from_id,rel,to_id,lid) VALUES ('bob','steward','root','steward');`);
    await expect(db.signingCommand('bob',command)).rejects.toMatchObject({code:'42501'});
    sql("INSERT INTO links(from_id,rel,to_id,lid) VALUES ('bob','keeper','root','keeper');");
    await expect(db.signingCommand('bob',{...command,sig:sign(null,Buffer.from('different'),witness.privateKey).toString('base64')})).rejects.toMatchObject({code:'42501'});
    await expect(db.signingCommand('alice',{...command,targetUid:'alice'})).rejects.toMatchObject({code:'22023'});
    expect(await Promise.all([db.signingCommand('bob',command),db.signingCommand('bob',command)])).toEqual([{witnessed:true},{witnessed:true}]);
    expect(sql('SELECT count(*) FROM person_key_recovery_witnesses;')).toBe('1');
    const recorded=sql('SELECT doc::text FROM person_key_recovery_witnesses;');
    expect(JSON.parse(recorded)).toMatchObject({witnessUid:'bob',version:3,keyFingerprint:bob.fingerprint,epochId:bob.epochId,sig:command.sig});
    expect((await db.signingIdentity('alice')).identity.state).toBe('frozen');
    expect((await db.recoveryProposal('bob','alice','recover')).proposal.status).toBe('open');
    await db.signingCommand('bob',{action:'freeze',epochId:bob.epochId,fingerprint:bob.fingerprint});
    await expect(db.signingCommand('bob',command)).rejects.toMatchObject({code:'LS026'});
    expect(sql('SELECT doc::text FROM person_key_recovery_witnesses;')).toBe(recorded);
    await expect(db.withSession('bob',(c:any)=>c.query('DELETE FROM person_key_recovery_witnesses'))).rejects.toThrow(/permission denied/);
  } finally {await db.close();}
});

it('activates recovery only with three still-eligible current witnesses and preserved cryptographic proofs',async()=>{
  const db=await apiDatabase(4);const {generateKeyPairSync,createHash,sign}=await import('node:crypto');
  const {seedRecoveryPreimage,seedRecoveryWitnessPreimage}=await import('../../src/domain/seedSigning.mjs');
  const old=generateKeyPairSync('ed25519'),candidate=generateKeyPairSync('ed25519');
  const pub=(key:typeof old)=>key.publicKey.export({format:'der',type:'spki'}).toString('base64');
  try {
    await db.profile('alice',{displayName:'Alice'});
    const {identity}=await db.signingCommand('alice',{action:'anchor',publicKeyB64:pub(old)});
    await db.signingCommand('alice',{action:'freeze',epochId:identity.epochId,fingerprint:identity.fingerprint});
    const {context}=await db.recoveryContext('alice');
    const begin={action:'begin_recovery',eventId:'recovery',toPubkey:pub(candidate),toFingerprint:createHash('sha256').update(pub(candidate)).digest('hex')};
    const newSig=sign(null,Buffer.from(seedRecoveryPreimage({...context,...begin})),candidate.privateKey).toString('base64');
    await db.signingCommand('alice',{...begin,newSig});
    const proposal=(await db.recoveryProposal('alice','alice','recovery')).proposal;
    const witnesses=[];
    for(const uid of ['w1','w2','w3','w4']) {
      const key=generateKeyPairSync('ed25519');await db.profile(uid,{displayName:uid});
      const current=(await db.signingCommand(uid,{action:'anchor',publicKeyB64:pub(key)})).identity;
      sql(`INSERT INTO initiates VALUES ('${uid}','{}');`);
      const command={action:'witness_recovery',targetUid:'alice',eventId:'recovery',pubkey:pub(key),keyFingerprint:current.fingerprint,epochId:current.epochId,
        sig:sign(null,Buffer.from(seedRecoveryWitnessPreimage({...proposal,eventId:'recovery'},uid)),key.privateKey).toString('base64')};
      witnesses.push({uid,key,current,command});
    }
    const activate={action:'activate_recovery',eventId:'recovery'};
    for(const witness of witnesses.slice(0,2))await db.signingCommand(witness.uid,witness.command);
    await expect(db.signingCommand('alice',activate)).rejects.toMatchObject({code:'LS030'});
    await db.signingCommand('w3',witnesses[2].command);
    sql("DELETE FROM initiates WHERE id='w3';");
    await expect(db.signingCommand('alice',activate)).rejects.toMatchObject({code:'LS030'});
    sql("INSERT INTO initiates VALUES ('w3','{}');");
    const badSig=sign(null,Buffer.from('different'),witnesses[2].key.privateKey).toString('base64');
    sql(`UPDATE person_key_recovery_witnesses SET doc=jsonb_set(doc,'{sig}',to_jsonb('${badSig}'::text)) WHERE doc->>'witnessUid'='w3';`);
    await expect(db.signingCommand('alice',activate)).rejects.toMatchObject({code:'LS030'});
    sql(`UPDATE person_key_recovery_witnesses SET doc=jsonb_set(doc,'{sig}',to_jsonb('${witnesses[2].command.sig}'::text)) WHERE doc->>'witnessUid'='w3';
      UPDATE person_key_recoveries SET doc=jsonb_set(doc,'{newSig}',to_jsonb('${badSig}'::text));`);
    await expect(db.signingCommand('alice',activate)).rejects.toMatchObject({code:'42501'});
    sql(`UPDATE person_key_recoveries SET doc=jsonb_set(doc,'{newSig}',to_jsonb('${newSig}'::text));`);
    await db.signingCommand('w3',{action:'freeze',epochId:witnesses[2].current.epochId,fingerprint:witnesses[2].current.fingerprint});
    await expect(db.signingCommand('alice',activate)).rejects.toMatchObject({code:'LS030'});
    await db.signingCommand('w4',witnesses[3].command);
    const oldHistory=sql("SELECT doc::text FROM person_key_events WHERE person_id='alice' ORDER BY id;");
    const attempts=await Promise.allSettled([db.signingCommand('alice',activate),db.signingCommand('alice',activate)]);
    expect(attempts.filter(result=>result.status==='fulfilled')).toHaveLength(1);
    expect(attempts.filter(result=>result.status==='rejected')).toHaveLength(1);
    const recovered=(await db.signingIdentity('alice')).identity;
    expect(recovered).toMatchObject({uid:'alice',lid:identity.lid,publicKeyB64:pub(candidate),fingerprint:begin.toFingerprint,epochId:'recovery',state:'active'});
    expect(sql("SELECT doc::text FROM person_key_events WHERE person_id='alice' AND doc->>'type'<>'recover' ORDER BY id;")).toBe(oldHistory);
    expect(sql("SELECT count(*) FROM person_keys WHERE person_id='alice';")).toBe('2');
    expect(sql('SELECT count(*) FROM person_key_recovery_witnesses;')).toBe('4');
    expect((await db.recoveryProposal('w1','alice','recovery')).proposal.status).toBe('activated');
    const history=await db.signingHistory({id:'alice',collection:'events',after:null,limit:100});
    const event=history.items.find((item:any)=>item.type==='recover');
    expect(event).toMatchObject({previousFingerprint:identity.fingerprint,keyFingerprint:begin.toFingerprint,recoveryId:'recovery'});
    expect(Date.parse(event.suspectedSince)).toBe(context.suspectedSinceMs);
  } finally {await db.close();}
});

it('pages recorded recovery witnesses for authenticated members without exposing imported extra fields',async()=>{
  const db=await apiDatabase();
  try {
    sql(`INSERT INTO person_key_recoveries VALUES ('alice','recovery','{}'),('alice','other','{}'),('bob','recovery','{}');
      INSERT INTO person_key_recovery_witnesses VALUES
      ('alice','recovery','a','{"version":3,"witnessUid":"first","epochId":"old","sig":"proof-a","privateNote":"hidden"}'),
      ('alice','recovery','Z','{"version":3,"witnessUid":"second","epochId":"current","sig":"proof-z"}'),
      ('alice','recovery','b','{"version":3,"witnessUid":"first","epochId":"new","sig":"proof-b"}'),
      ('alice','other','a','{"witnessUid":"wrong-recovery"}'),
      ('bob','recovery','a','{"witnessUid":"wrong-person"}'),
      ('alice','missing','a','{"witnessUid":"orphan"}');`);
    const query={id:'alice',event:'recovery',after:null,limit:1};
    await expect(db.recoveryWitnesses(null,query)).rejects.toMatchObject({code:'28000'});
    const first=await db.recoveryWitnesses('member',query);
    expect(first.items.map((w:any)=>w.id)).toEqual(['Z']);expect(first.next).toBe('Z');
    const second=await db.recoveryWitnesses('member',{...query,after:first.next});
    expect(second.items[0]).toMatchObject({id:'a',witnessUid:'first',sig:'proof-a'});
    expect(second.items[0]).not.toHaveProperty('privateNote');expect(second.next).toBe('a');
    const last=await db.recoveryWitnesses('member',{...query,after:second.next});
    expect(last.items[0]).toMatchObject({id:'b',witnessUid:'first'});expect(last.next).toBeNull();
    expect(await db.recoveryWitnesses('member',{...query,event:'missing'})).toEqual({items:[],next:null});
    expect(await db.recoveryWitnesses('member',{...query,after:'z'})).toEqual({items:[],next:null});
    // A list is recorded evidence, never an eligible-witness count (two rows share one UID).
    expect((await db.recoveryWitnesses('member',{...query,limit:100})).items).toHaveLength(3);
    for(const patch of [{limit:101},{limit:0},{after:''},{event:'bad\nevent'}]) {
      await expect(db.recoveryWitnesses('member',{...query,...patch})).rejects.toMatchObject({code:'22023'});
    }
    await expect(db.withSession('member',(c:any)=>c.query('SELECT * FROM person_key_recovery_witnesses'))).rejects.toThrow(/permission denied/);
  }finally{await db.close();}
});

it('runs device creation, rotation, witnessed recovery and lost-response reconciliation through the real authenticated API',async()=>{
  const {createSeedSession}=await import('../../src/services/independent/session');
  const {createSeedKeyCustody}=await import('../../src/services/independent/keyCustody');
  const {createSeedRecoveryCustody}=await import('../../src/services/independent/recoveryCustody');
  type Key=import('../../src/services/independent/keyStore').DeviceSigningKey;
  const fixture=authFixture();fixture.config.bindings.push(...['carol','dave'].map(uid=>({subject:'issuer-'+uid,uid})));
  const db=await apiDatabase(4),server=createApi(db,await createAuthenticator(fixture.config));
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();
  if(!address || typeof address==='string')throw new Error('missing_address');
  const base=`http://127.0.0.1:${address.port}`,keys:Key[]=[];
  const store={list:async(uid:string,lid:string)=>keys.filter(key=>key.uid===uid && key.lid===lid),save:async(key:Key)=>{
    const index=keys.findIndex(k=>k.uid===key.uid && k.lid===key.lid && k.publicKeyB64===key.publicKeyB64);
    if(index<0)keys.push(structuredClone(key));else keys[index]=structuredClone(key);
  }};
  const client=async(uid:string)=>{
    let drop='';const user={access_token:fixture.token({sub:'issuer-'+uid})};
    const session=createSeedSession({current:async()=>user,callback:async()=>user,login:async()=>{},logout:async()=>{},clear:async()=>{},changes:()=>()=>{}},async(path,options)=>{
      const response=await fetch(base+String(path),options);
      if(drop && options?.body && JSON.parse(String(options.body)).action===drop && response.ok){drop='';await response.arrayBuffer();throw new Error('response_lost');}
      return response;
    });
    await session.start();expect(session.snapshot()).toEqual({status:'authenticated',uid});
    await session.saveProfile(uid);return {session,drop:(action:string)=>{drop=action;}};
  };
  try {
    const alice=await client('alice'),custody=createSeedKeyCustody(alice.session,store);
    await custody.prepare();await custody.confirmBackup();expect((await custody.inspect()).status).toBe('ready');
    await custody.prepareRotation();alice.drop('rotate');await expect(custody.confirmBackup()).rejects.toThrow('response_lost');
    await custody.confirmBackup();expect(keys.filter(key=>key.uid==='alice')).toHaveLength(2);
    const current=(await db.signingIdentity('alice')).identity;
    await alice.session.signingCommand({action:'freeze',epochId:current.epochId,fingerprint:current.fingerprint});
    const recovery=createSeedRecoveryCustody(alice.session,store);await recovery.prepare();alice.drop('begin_recovery');
    const {code}=await recovery.confirmBackup();expect(code).toContain('alice:');
    await expect(recovery.activate(code)).rejects.toThrow('recovery_quorum_required');
    for(const uid of ['bob','carol','dave']) {
      const witness=await client(uid),witnessKey=createSeedKeyCustody(witness.session,store);
      await witnessKey.prepare();await witnessKey.confirmBackup();
      const witnessRecovery=createSeedRecoveryCustody(witness.session,store),reviewed=await witnessRecovery.read(code);
      await expect(witnessRecovery.witness(reviewed)).rejects.toThrow('forbidden');
      sql(`INSERT INTO initiates VALUES ('${uid}','{}');`);await witnessRecovery.witness(reviewed);
    }
    const event=code.slice(code.lastIndexOf(':')+1);
    const receipts=await alice.session.read('/v1/signing-recovery-witnesses?id=alice&event='+event) as {items:unknown[]};
    expect(receipts.items).toHaveLength(3);alice.drop('activate_recovery');await recovery.activate(code);
    expect((await createSeedKeyCustody(alice.session,store).inspect()).status).toBe('ready');
    expect((await recovery.read(code)).status).toBe('activated');
    await recovery.retry(code);expect(keys.filter(key=>key.uid==='alice')).toHaveLength(3);
    expect(sql("SELECT count(*) FROM person_key_events WHERE person_id='alice' AND doc->>'type'='recover';")).toBe('1');
    // Exercise the browser mint service with the recovered device key, real JWT
    // transport and locked PostgreSQL birth law, not a second signing mock.
    const {createSeedBlockMint}=await import('../../src/services/independent/blockMint');
    const {computeCanonicalHash}=await import('../../src/domain/chain/verify');
    sql(`INSERT INTO lifetrees VALUES ('mint-tree','{"anchorUid":"alice","visibility":"public","latestHash":"root","blockHeight":0}');
      INSERT INTO visions VALUES ('mint-vision','{"authorId":"alice","visibility":"private","title":"A dream"}');`);
    const mint=createSeedBlockMint(alice.session,store),competing=createSeedBlockMint(alice.session,store);
    await mint.prepare('tree','mint-tree',{type:'tree_growth',body:'Reviewed care',care:'watering'});
    await competing.prepare('tree','mint-tree',{type:'tree_growth',body:'Old head'});
    const born=await mint.submit() as {pulseId:string;hash:string};
    const record=(await alice.session.read('/v1/pulses?id='+born.pulseId) as {pulse:Record<string,any>}).pulse;
    expect(record.authorSignature.pubkey).toBe(keys.filter(key=>key.uid==='alice').at(-1)!.publicKeyB64);
    expect(record.hash).toBe(await computeCanonicalHash('root',record.mintedAt,record));
    await expect(competing.submit()).rejects.toThrow('block_head_moved');
    await expect(competing.submit()).rejects.toThrow('review_required');
    expect(sql("SELECT count(*) FROM pulses WHERE doc->>'lifetreeId'='mint-tree';")).toBe('1');
    await mint.prepare('vision','mint-vision',{type:'vision_growth',body:'Private contribution'});
    alice.drop('mint');await expect(mint.submit()).rejects.toThrow('response_lost');
    await expect(mint.submit()).rejects.toThrow('review_required');
    const history=await alice.session.read('/v1/pulses?vision=mint-vision') as {pulses:Record<string,any>[]};
    expect(history.pulses).toHaveLength(1);expect(history.pulses[0]).toMatchObject({body:'Private contribution',title:'A dream growth',visibility:'private'});
    expect(sql("SELECT count(*) FROM pulses WHERE doc->>'visionId'='mint-vision';")).toBe('1');
    const bob=await client('bob'),outsider=createSeedBlockMint(bob.session,store);
    await outsider.prepare('tree','mint-tree',{type:'tree_growth',body:'Not my tree'});
    await expect(outsider.submit()).rejects.toThrow('forbidden');
    expect(sql("SELECT count(*) FROM pulses WHERE doc->>'lifetreeId'='mint-tree';")).toBe('1');
    await alice.session.logout();await expect(recovery.activate(code)).rejects.toThrow('authentication_required');
  }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await db.close();}
});

it('appends canonically sealed growth with atomic head, care, watering and prior-field memory',async()=>{
  const db=await apiDatabase();const {computeCanonicalHash}=await import('../../src/domain/chain/verify');
  try {
    await db.profile('alice',{displayName:'Alice'});
    sql(`INSERT INTO lifetrees VALUES ('tree','{"anchorUid":"alice","name":"Oak","visibility":"private","genesisHash":"root","latestHash":"root","blockHeight":0,"domain":"tree.example","latestGrowthUrl":"old-photo","watering":{"mode":"scheduled","intervalDays":2,"overdue":true}}');
      UPDATE users SET doc=doc || '{"anonymous":true}' WHERE id='alice';`);
    const born=await db.blockCommand('alice',{action:'mint',on:'tree',id:'tree',block:{type:'tree_growth',body:'Watered',care:'watering',imageUrl:'new-photo'}},'node.example');
    const record=JSON.parse(sql(`SELECT doc FROM pulses WHERE id='${born.pulseId}';`)),tree=JSON.parse(sql("SELECT doc FROM lifetrees WHERE id='tree';"));
    expect(record).toMatchObject({authorId:'alice',lifetreeId:'tree',previousHash:'root',visibility:'circle',domain:'tree.example',wateringConfirmedBy:'pending'});
    expect(record).not.toHaveProperty('authorSignature');expect(record.hash).toBe(await computeCanonicalHash('root',record.mintedAt,record));
    expect(tree).toMatchObject({latestHash:record.hash,blockHeight:1,latestGrowthUrl:'new-photo',lastCaredAt:record.createdAt});
    expect(tree.watering).toMatchObject({mode:'scheduled',intervalDays:2,overdue:false,lastWateredAt:record.createdAt,lastWateredBy:'alice',lastWateredByName:'Oak'});
    expect(Date.parse(tree.watering.nextDueAt)-record.mintedAt).toBe(2*86400000);
    expect(record.bearerBefore).toMatchObject({latestGrowthUrl:'old-photo',lastCaredAt:null,watering:{overdue:true,lastWateredAt:null}});
    await expect(db.withSession('alice',(c:any)=>c.query("INSERT INTO pulses VALUES ('forged','{}')"))).rejects.toThrow(/permission denied/);
    const siblings=await Promise.all([db.blockCommand('alice',{action:'mint',on:'tree',id:'tree',block:{type:'tree_growth',body:'First'}},'node.example'),db.blockCommand('alice',{action:'mint',on:'tree',id:'tree',block:{type:'tree_growth',body:'Second'}},'node.example')]);
    const ordered=siblings.sort((a:any,b:any)=>a.blockHeight-b.blockHeight);
    expect(ordered.map((item:any)=>item.blockHeight)).toEqual([2,3]);expect(ordered[0].previousHash).toBe(born.hash);expect(ordered[1].previousHash).toBe(ordered[0].hash);
    expect(JSON.parse(sql("SELECT doc FROM lifetrees WHERE id='tree';")).latestHash).toBe(ordered[1].hash);
  }finally{await db.close();}
});

it('enforces chain carer, secret keeper, vision author and named staff-hand boundaries',async()=>{
  const db=await apiDatabase();
  try {
    sql(`INSERT INTO lifetrees VALUES ('tree','{"anchorUid":"alice"}'),('secret','{"anchorUid":"alice","treeType":"SECRET","visibility":"private"}');
      INSERT INTO visions VALUES ('vision','{"authorId":"alice","title":"Garden","visibility":"private"}');
      INSERT INTO links(from_id,rel,to_id,lid) VALUES ('bob','guardian','tree','guardian');
      INSERT INTO secret_links(from_id,rel,to_id,lid) VALUES ('carol','keeper','secret','secret-keeper');
      INSERT INTO admins VALUES ('staff','{}'); INSERT INTO config VALUES ('staffHands','{"tree_edit":false,"tree_water":true}');`);
    const command={action:'mint',on:'tree',id:'tree',block:{type:'tree_growth'}};
    await expect(db.blockCommand('bob',command,'node.example')).rejects.toMatchObject({code:'42501'});
    await expect(db.blockCommand('staff',command,'node.example')).rejects.toMatchObject({code:'42501'});
    await db.blockCommand('staff',{...command,block:{type:'tree_growth',care:'watering'}},'node.example');
    await expect(db.blockCommand('bob',{...command,id:'secret'},'node.example')).rejects.toMatchObject({code:'42501'});
    const secret=await db.blockCommand('carol',{...command,id:'secret'},'node.example');
    expect(JSON.parse(sql(`SELECT doc FROM pulses WHERE id='${secret.pulseId}';`)).visibility).toBe('circle');
    await expect(db.blockCommand('carol',{...command,id:'secret',block:{type:'tree_growth',visibility:'public'}},'node.example')).rejects.toMatchObject({refusal:'block_visibility_bad'});
    await expect(db.blockCommand('bob',{action:'mint',on:'vision',id:'vision',block:{type:'vision_growth'}},'node.example')).rejects.toMatchObject({code:'42501'});
    const vision=await db.blockCommand('alice',{action:'mint',on:'vision',id:'vision',block:{type:'vision_growth'}},'node.example');
    expect(JSON.parse(sql(`SELECT doc FROM pulses WHERE id='${vision.pulseId}';`))).toMatchObject({visionTitle:'Garden',title:'Garden growth',visibility:'private'});
    await expect(db.blockCommand('alice',{...command,block:{type:'tree_growth',authorId:'bob'}},'node.example')).rejects.toMatchObject({refusal:'block_field_unknown'});
    await expect(db.blockCommand('alice',{...command,block:{type:'tree_growth',care:'watering',wateringConfirmedBy:'guardian'}},'node.example')).rejects.toMatchObject({refusal:'block_witness_forged'});
  }finally{await db.close();}
});

it('accepts one signed head under competing appends and refuses stale, tampered, unsigned or frozen proofs',async()=>{
  const db=await apiDatabase(3);const {generateKeyPairSync,sign}=await import('node:crypto');
  const {judgeBlockBirth,blockSignaturePayload,blockSignaturePreimage}=await import('../../src/domain/chain/birth');
  const {computeCanonicalHash}=await import('../../src/domain/chain/verify');
  try {
    await db.profile('alice',{displayName:'Alice'});const pair=generateKeyPairSync('ed25519'),pub=pair.publicKey.export({format:'der',type:'spki'}).toString('base64');
    const {identity}=await db.signingCommand('alice',{action:'anchor',publicKeyB64:pub});
    sql(`INSERT INTO lifetrees VALUES ('tree','{"anchorUid":"alice","latestHash":"root","blockHeight":0}');`);
    const block={type:'tree_growth',body:'Signed care'};
    const judgment=judgeBlockBirth({on:'tree',minterUid:'alice',isStaff:false,bearer:{exists:true,carer:true,latestHash:'root',blockHeight:0},block});
    if(judgment.outcome!=='mint')throw new Error('fixture_rejected');
    const payload=blockSignaturePayload({on:'tree',bearerId:'tree',previousHash:'root',content:judgment.content,signerUid:'alice',keyFingerprint:identity.fingerprint,epochId:identity.epochId});
    const signature={sig:sign(null,Buffer.from(blockSignaturePreimage(payload)),pair.privateKey).toString('base64'),previousHash:'root',keyFingerprint:identity.fingerprint,epochId:identity.epochId};
    const command={action:'mint',on:'tree',id:'tree',block,signature};
    await expect(db.blockCommand('alice',{...command,signature:null},'node.example')).rejects.toMatchObject({refusal:'block_unsigned'});
    await expect(db.blockCommand('alice',{...command,block:{...block,body:'tampered'}},'node.example')).rejects.toMatchObject({refusal:'block_signature_bad'});
    sql("UPDATE users SET doc=jsonb_set(doc,'{uid}','\"someone-else\"') WHERE id='alice';");
    await expect(db.blockCommand('alice',command,'node.example')).rejects.toMatchObject({refusal:'block_key_stale'});
    sql("UPDATE users SET doc=jsonb_set(doc,'{uid}','\"alice\"') WHERE id='alice';");
    sql("UPDATE persons SET doc=jsonb_set(doc,'{publicKeyPem}','123') WHERE id='alice';");
    await expect(db.blockCommand('alice',{...command,signature:null},'node.example')).rejects.toMatchObject({refusal:'block_key_stale'});
    sql(`UPDATE persons SET doc=jsonb_set(doc,'{publicKeyPem}',to_jsonb('${pub}'::text)) WHERE id='alice';`);
    const attempts=await Promise.allSettled([db.blockCommand('alice',command,'node.example'),db.blockCommand('alice',command,'node.example')]);
    expect(attempts.filter(result=>result.status==='fulfilled')).toHaveLength(1);
    const refused=attempts.find(result=>result.status==='rejected') as PromiseRejectedResult;expect(refused.reason).toMatchObject({refusal:'block_head_moved'});
    expect(sql('SELECT count(*) FROM pulses;')).toBe('1');
    const record=JSON.parse(sql('SELECT doc FROM pulses;'));expect(record.authorSignature).toMatchObject({pubkey:pub,sig:signature.sig,epochId:identity.epochId});
    expect(record.hash).toBe(await computeCanonicalHash('root',record.mintedAt,record));
    await db.signingCommand('alice',{action:'freeze',epochId:identity.epochId,fingerprint:identity.fingerprint});
    await expect(db.blockCommand('alice',command,'node.example')).rejects.toMatchObject({refusal:'block_key_frozen'});
    expect(sql('SELECT count(*) FROM pulses;')).toBe('1');
  }finally{await db.close();}
});

it('rolls back the appended block when a later head update fails',async()=>{
  const db=await apiDatabase();
  try {
    sql(`INSERT INTO lifetrees VALUES ('tree','{"anchorUid":"alice","latestHash":"root","blockHeight":0}');
      CREATE FUNCTION public.fail_mint_head() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'head failed'; END $$;
      CREATE TRIGGER fail_mint_head BEFORE UPDATE ON lifetrees FOR EACH ROW EXECUTE FUNCTION public.fail_mint_head();`);
    await expect(db.blockCommand('alice',{action:'mint',on:'tree',id:'tree',block:{type:'tree_growth',care:'watering'}},'node.example')).rejects.toThrow('head failed');
    expect(sql('SELECT count(*) FROM pulses;')).toBe('0');expect(JSON.parse(sql("SELECT doc FROM lifetrees WHERE id='tree';"))).toEqual({anchorUid:'alice',latestHash:'root',blockHeight:0});
  }finally{await db.close();}
});

it('filters pulse history by circle/community/author access and keeps addressed reaches private even when mislabeled public',async()=>{
  const {seedPulseQuery}=await import('../../src/domain/seedPulse.mjs');const db=await apiDatabase();
  const query=(params:Record<string,string>={})=>seedPulseQuery(new URLSearchParams(params));
  try {
    sql(`INSERT INTO lifetrees VALUES ('tree','{"anchorUid":"alice"}'),('secret','{"anchorUid":"alice","treeType":"SECRET","visibility":"private"}');
      INSERT INTO communities VALUES ('community','{"anchorUid":"alice"}');
      INSERT INTO links(from_id,rel,to_id,lid) VALUES ('bob','observer','tree','observer'),('guardian','guardian','tree','guardian'),('member','member','community','member');
      INSERT INTO secret_links(from_id,rel,to_id,lid) VALUES ('keeper','keeper','secret','secret-keeper');
      INSERT INTO admins VALUES ('staff','{}');
      INSERT INTO pulses VALUES
        ('public','{"type":"tree_growth","visibility":"public","lifetreeId":"tree","authorId":"alice"}'),
        ('node','{"visibility":"node","authorId":"alice"}'),
        ('circle','{"visibility":"circle","lifetreeId":"tree","authorId":"alice"}'),
        ('secret','{"visibility":"circle","lifetreeId":"secret","authorId":"alice"}'),
        ('community','{"visibility":"community","communityId":"community","authorId":"alice"}'),
        ('private','{"visibility":"private","authorId":"alice"}'),
        ('reach','{"type":"reach","visibility":"public","lifetreeId":"tree","authorId":"alice","recipientUid":"bob"}'),
        ('thread','{"type":"reach","visibility":"node","authorId":"alice","participantUids":["member"]}'),
        ('broken-thread','{"type":"reach","visibility":"public","authorId":"alice","participantUids":{"bob":true}}'),
        ('legacy','{"authorId":"alice"}'),('legacy-null','{"participantUids":[null]}');`);
    const ids=async(uid:string|null,params:Record<string,string>={})=>(await db.pulses(query(params),uid)).pulses.map((p:any)=>p.id);
    expect(await ids(null)).toEqual(['public']);
    expect((await db.pulses(query({id:'legacy'}))).pulse.id).toBe('legacy');
    expect((await db.pulses(query({id:'reach'}))).pulse).toBeNull();
    expect(await ids('bob')).toEqual(['reach','public','node','circle']);
    expect(await ids('guardian',{tree:'tree'})).toEqual(['public']);
    expect(await ids('keeper',{tree:'secret'})).toEqual(['secret']);
    expect(await ids('member',{community:'community'})).toEqual(['community']);
    expect(await ids('bob',{participant:'member'})).toEqual([]);
    expect(await ids('member',{participant:'member'})).toEqual(['thread']);
    expect(await ids('bob',{author:'alice',recipient:'bob'})).toEqual(['reach']);
    expect(await ids('alice')).toContain('private');expect(await ids('alice')).toContain('broken-thread');
    expect(await ids('staff')).toHaveLength(11);
    expect((await db.withSession(null,(c:any)=>c.query('SELECT id FROM pulses ORDER BY id'))).rows.map((row:any)=>row.id)).toEqual(['legacy','legacy-null','public']);
    await expect(db.withSession('staff',(c:any)=>c.query("UPDATE pulses SET doc='{}'"))).rejects.toThrow(/permission denied/);
    sql(`INSERT INTO config VALUES ('superadmin','{"uid":123}');`);
    expect((await db.pulses(query({id:'private'}),'123')).pulse).toBeNull();
    sql(`UPDATE config SET doc='{"uid":"123"}' WHERE id='superadmin';`);
    expect((await db.pulses(query({id:'private'}),'123')).pulse.id).toBe('private');
  }finally{await db.close();}
});

it('paginates visible pulse history without hidden-row gaps or lost microsecond ties',async()=>{
  const {seedPulseQuery}=await import('../../src/domain/seedPulse.mjs');const db=await apiDatabase();
  const query=(params:Record<string,string>={})=>seedPulseQuery(new URLSearchParams(params));
  try {
    sql(`INSERT INTO pulses VALUES
      ('a','{"visibility":"public","visionId":"vision","createdAt":"2026-10-28T12:00:00.123455Z"}'),
      ('b','{"visibility":"public","visionId":"vision","createdAt":"2026-10-28T12:00:00.123456Z"}'),
      ('c','{"visibility":"public","visionId":"vision","createdAt":"2026-10-28T12:00:00.123456Z"}'),
      ('hidden','{"visibility":"private","visionId":"vision","authorId":"other","createdAt":"2026-10-28T12:00:00.999999Z"}'),
      ('old','{"visibility":"public","visionId":"vision","createdAt":"bad"}'),
      ('other','{"visibility":"public","visionId":"elsewhere"}');`);
    const first=await db.pulses(query({vision:'vision',limit:'1'}));expect(first.pulses[0].id).toBe('c');expect(first.next).toContain('.123456Z');
    const second=await db.pulses(query({vision:'vision',limit:'1',after:first.next}));expect(second.pulses[0].id).toBe('b');
    const third=await db.pulses(query({vision:'vision',limit:'1',after:second.next}));expect(third.pulses[0].id).toBe('a');
    const last=await db.pulses(query({vision:'vision',limit:'1',after:third.next}));expect(last.pulses[0].id).toBe('old');expect(last.next).toBeNull();
    expect((await db.pulses(query({id:'hidden'}))).pulse).toBeNull();expect((await db.pulses(query({id:'missing'}))).pulse).toBeNull();
  }finally{await db.close();}
});

it('accepts an offering once with two canonical heads and one atomic answer',async()=>{
  const db=await apiDatabase(4);const {computeCanonicalHash}=await import('../../src/domain/chain/verify');
  try {
    await db.profile('bob',{displayName:'Bob'});
    sql(`INSERT INTO lifetrees VALUES ('source','{"anchorUid":"alice","name":"Oak","latestHash":"source-root","blockHeight":2}'),
      ('target','{"anchorUid":"bob","name":"Willow","genesisHash":"target-root"}');
      INSERT INTO pulses VALUES ('offer','{"type":"offering","authorId":"alice","offeredToKind":"tree","offeredToId":"target","offeringFromTreeId":"source","title":"Care","visibility":"node"}');`);
    const results=await Promise.allSettled([db.acceptOffering('bob','offer'),db.acceptOffering('bob','offer')]);
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    expect(results.filter(r=>r.status==='rejected')).toHaveLength(1);
    const answer=JSON.parse(sql("SELECT doc FROM pulses WHERE id='offer';"));expect(answer.offeringStatus).toBe('accepted');expect(answer.offeringAnsweredBy).toBe('bob');
    const from=JSON.parse(sql(`SELECT doc FROM pulses WHERE id='${answer.offeringAcceptedPulseIds.from}';`));
    const to=JSON.parse(sql(`SELECT doc FROM pulses WHERE id='${answer.offeringAcceptedPulseIds.to}';`));
    expect(from).toMatchObject({authorId:'alice',previousHash:'source-root',lifetreeId:'source',offeringTwinOf:'target'});
    expect(to).toMatchObject({authorId:'bob',previousHash:'target-root',lifetreeId:'target',offeringTwinOf:'source'});
    for(const record of [from,to])expect(record.hash).toBe(await computeCanonicalHash(record.previousHash,record.mintedAt,record));
    expect(JSON.parse(sql("SELECT doc FROM lifetrees WHERE id='source';"))).toMatchObject({latestHash:from.hash,blockHeight:3});
    expect(JSON.parse(sql("SELECT doc FROM lifetrees WHERE id='target';"))).toMatchObject({latestHash:to.hash,blockHeight:1});
    expect(sql('SELECT count(*) FROM pulses;')).toBe('3');
    await expect(db.withSession('bob',(c:any)=>c.query("UPDATE pulses SET doc='{}' WHERE id='offer'"))).rejects.toThrow(/permission denied/);
  }finally{await db.close();}
});
it('refuses offerings without current source or recipient authority and supports vision recipients',async()=>{
  const db=await apiDatabase(3);
  try {
    sql(`INSERT INTO lifetrees VALUES ('source','{"anchorUid":"alice"}');
      INSERT INTO visions VALUES ('vision','{"authorId":"bob","title":"Dream","visibility":"private"}');
      INSERT INTO pulses VALUES ('offer','{"type":"offering","authorId":"alice","offeredToKind":"vision","offeredToId":"vision","offeringFromTreeId":"source"}');`);
    await expect(db.acceptOffering('eve','offer')).rejects.toMatchObject({code:'42501'});
    sql("UPDATE lifetrees SET doc='{\"anchorUid\":\"other\"}' WHERE id='source';");
    await expect(db.acceptOffering('bob','offer')).rejects.toMatchObject({code:'OFFERING_REJECTED',refusal:'permission-denied'});
    expect(sql('SELECT count(*) FROM pulses;')).toBe('1');
    sql("UPDATE lifetrees SET doc='{\"anchorUid\":\"alice\"}' WHERE id='source';");
    const result=await db.acceptOffering('bob','offer');
    expect(JSON.parse(sql(`SELECT doc FROM pulses WHERE id='${result.toPulseId}';`))).toMatchObject({visionId:'vision',authorId:'bob'});
  }finally{await db.close();}
});
it('rolls back both offering twins and both heads if writing the final answer fails',async()=>{
  const db=await apiDatabase(2);
  try {
    sql(`INSERT INTO lifetrees VALUES ('source','{"anchorUid":"alice","latestHash":"source-root"}'),('target','{"anchorUid":"bob","latestHash":"target-root"}');
      INSERT INTO pulses VALUES ('offer','{"type":"offering","authorId":"alice","offeredToKind":"tree","offeredToId":"target","offeringFromTreeId":"source"}');
      CREATE FUNCTION public.reject_offering_answer() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'answer failed'; END $$;
      CREATE TRIGGER reject_answer BEFORE UPDATE ON public.pulses FOR EACH ROW EXECUTE FUNCTION public.reject_offering_answer();`);
    await expect(db.acceptOffering('bob','offer')).rejects.toThrow('answer failed');
    expect(sql('SELECT count(*) FROM pulses;')).toBe('1');
    expect(sql("SELECT doc->>'latestHash' FROM lifetrees ORDER BY id;")).toBe('source-root\ntarget-root');
    expect(sql("SELECT doc ? 'offeringStatus' FROM pulses WHERE id='offer';")).toBe('f');
  }finally{await db.close();}
});

it('accepts offerings over authenticated HTTP without exposing a private counterpart through public twin labels',async()=>{
  const fixture=authFixture(),db=await apiDatabase(3),server=createApi(db,await createAuthenticator(fixture.config));
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();
  if(!address || typeof address==='string')throw new Error('missing_address');
  const base=`http://127.0.0.1:${address.port}`;
  const accept=(uid?:string,extra={})=>fetch(base+'/v1/offerings/command',{method:'POST',headers:{'Content-Type':'application/json',...(uid?{Authorization:'Bearer '+fixture.token({sub:'issuer-'+uid})}:{})},body:JSON.stringify({action:'accept',id:'offer',...extra})});
  try {
    sql(`INSERT INTO lifetrees VALUES ('source','{"anchorUid":"alice","name":"Public oak","visibility":"public"}');
      INSERT INTO visions VALUES ('vision','{"authorId":"bob","title":"Private dream","visibility":"private"}');
      INSERT INTO pulses VALUES ('offer','{"type":"offering","authorId":"alice","offeredToKind":"vision","offeredToId":"vision","offeringFromTreeId":"source","visibility":"public"}');`);
    expect((await accept()).status).toBe(401);expect((await accept('alice')).status).toBe(403);
    expect((await accept('bob',{authorId:'mallory'})).status).toBe(400);
    const accepted=await accept('bob');expect(accepted.status).toBe(200);
    const ids=await accepted.json();expect((await accept('bob')).status).toBe(409);
    for(const id of [ids.fromPulseId,ids.toPulseId]) {
      expect((await fetch(base+'/v1/pulses?id='+id)).status).toBe(404);
      for(const uid of ['alice','bob'])expect((await fetch(base+'/v1/pulses?id='+id,{headers:{Authorization:'Bearer '+fixture.token({sub:'issuer-'+uid})}})).status).toBe(200);
    }
    const publicHistory=await (await fetch(base+'/v1/pulses?tree=source')).json();expect(publicHistory.pulses).toEqual([]);
    const aliceHistory=await (await fetch(base+'/v1/pulses?vision=vision',{headers:{Authorization:'Bearer '+fixture.token({sub:'issuer-alice'})}})).json();
    expect(aliceHistory.pulses.map((p:any)=>p.id)).toEqual([ids.toPulseId]);
    // A forged document ID cannot borrow participant access from a recorded twin.
    sql(`INSERT INTO pulses SELECT 'forged',doc FROM pulses WHERE id='${ids.toPulseId}';`);
    const {seedPulseQuery}=await import('../../src/domain/seedPulse.mjs');
    expect((await db.pulses(seedPulseQuery(new URLSearchParams({id:'forged'})),'alice')).pulse).toBeNull();
    sql("UPDATE visions SET doc=jsonb_set(doc,'{visibility}','\"public\"') WHERE id='vision';");
    expect((await fetch(base+'/v1/pulses?id='+ids.fromPulseId)).status).toBe(200);
  }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await db.close();}
});
it('keeps offering twins inside both private circles and permits recorded parties after bearer removal',async()=>{
  const db=await apiDatabase(2);const {seedPulseQuery}=await import('../../src/domain/seedPulse.mjs');
  const read=(id:string,uid:string|null=null)=>db.pulses(seedPulseQuery(new URLSearchParams({id})),uid);
  try {
    sql(`INSERT INTO lifetrees VALUES ('source','{"anchorUid":"alice","visibility":"private"}'),('target','{"anchorUid":"bob","visibility":"private"}');
      INSERT INTO pulses VALUES ('offer','{"type":"offering","authorId":"alice","offeredToKind":"tree","offeredToId":"target","offeringFromTreeId":"source","visibility":"public"}');
      INSERT INTO links(from_id,rel,to_id,lid,doc) VALUES
      ('carol','observer','target','01900000-0000-7000-8000-000000000001','{}'),('dave','guardian','target','01900000-0000-7000-8000-000000000002','{}'),
      ('dave','guardian','source','01900000-0000-7000-8000-000000000003','{}');`);
    const ids=await db.acceptOffering('bob','offer');
    expect((await read(ids.fromPulseId,'carol')).pulse).toBeNull();
    expect((await read(ids.toPulseId,'dave')).pulse).toBeNull();
    sql("INSERT INTO links(from_id,rel,to_id,lid,doc) VALUES ('carol','observer','source','01900000-0000-7000-8000-000000000004','{}');");
    expect((await read(ids.fromPulseId,'carol')).pulse).not.toBeNull();
    expect((await read(ids.toPulseId,'carol')).pulse).not.toBeNull();
    sql("DELETE FROM lifetrees WHERE id='target';");
    expect((await read(ids.fromPulseId,'carol')).pulse).toBeNull();
    expect((await read(ids.fromPulseId,'alice')).pulse).not.toBeNull();expect((await read(ids.toPulseId,'bob')).pulse).not.toBeNull();
  }finally{await db.close();}
});

it('creates offerings with protected birth proofs and private recipient notices in one transaction',async()=>{
  const db=await apiDatabase(3);const {seedPulseQuery}=await import('../../src/domain/seedPulse.mjs');
  try {
    await db.profile('alice',{displayName:'Alice'});
    sql(`INSERT INTO lifetrees VALUES ('source','{"anchorUid":"alice","name":"Private oak","visibility":"private","latestHash":"unchanged"}'),
      ('target','{"anchorUid":"bob","name":"Willow","visibility":"public"}');`);
    const draft={action:'create',kind:'service',title:'Care',body:'Private terms',appreciation:21,toKind:'tree',toId:'target',fromTreeId:'source',visibility:'private'};
    const {offering}=await db.createOffering('alice',draft,'node.example');
    expect(offering).toMatchObject({authorId:'alice',offeringStatus:'open',offeredToKeeperUid:'bob',visibility:'private',offeringFromTreeName:'Private oak'});
    expect(offering).not.toHaveProperty('birthPreimage');
    expect(sql(`SELECT hash=encode(digest(convert_to(preimage,'UTF8'),'sha256'),'hex') FROM seed.offering_birth_proofs WHERE offering_id='${offering.id}';`)).toBe('t');
    await expect(db.withSession('alice',(c:any)=>c.query('SELECT * FROM seed.offering_birth_proofs'))).rejects.toThrow(/permission denied/);
    const read=(id:string,uid:string|null=null)=>db.pulses(seedPulseQuery(new URLSearchParams({id})),uid);
    expect((await read(offering.id)).pulse).toBeNull();expect((await read(offering.id,'bob')).pulse).not.toBeNull();expect((await read(offering.id,'eve')).pulse).toBeNull();
    const notice=JSON.parse(sql("SELECT doc FROM pulses WHERE doc->>'previousHash'='OFFER_NOTICE';"));
    expect(notice).toMatchObject({authorId:'alice',recipientUid:'bob',participantUids:['alice','bob'],visibility:'private'});
    expect((await read(notice.id,'bob')).pulse).not.toBeNull();expect((await read(notice.id,'eve')).pulse).toBeNull();
    expect((await db.pulses(seedPulseQuery(new URLSearchParams({type:'offering'})),'bob')).pulses.map((p:any)=>p.id)).toEqual([offering.id]);
    expect(sql("SELECT doc->>'latestHash' FROM lifetrees WHERE id='source';")).toBe('unchanged');
    await db.acceptOffering('bob',offering.id);
    expect(sql("SELECT count(*) FROM seed.offering_birth_proofs;")).toBe('1');
  }finally{await db.close();}
});
it('refuses forged offering authority, inaccessible targets, private-name disclosure and unpublished pictures',async()=>{
  const db=await apiDatabase(2);
  try {
    await db.profile('alice',{displayName:'Alice'});
    sql(`INSERT INTO lifetrees VALUES ('source','{"anchorUid":"alice","visibility":"private"}'),('foreign','{"anchorUid":"bob","visibility":"public"}'),
      ('bed','{"anchorUid":"alice","treeType":"BED","name":"Bed","visibility":"public"}');
      INSERT INTO visions VALUES ('hidden','{"authorId":"bob","visibility":"private"}');`);
    const draft={action:'create',kind:'service',title:'Care',body:'Terms',appreciation:21,visibility:'private'};
    await expect(db.createOffering('alice',{...draft,fromTreeId:'foreign',toKind:'tree',toId:'bed'},'node.example')).rejects.toMatchObject({code:'42501'});
    await expect(db.createOffering('alice',{...draft,fromTreeId:'source',toKind:'vision',toId:'hidden'},'node.example')).rejects.toMatchObject({code:'LS034'});
    await expect(db.createOffering('alice',{...draft,visibility:'public',fromTreeId:'source',toKind:'tree',toId:'foreign'},'node.example')).rejects.toMatchObject({code:'22023'});
    await expect(db.createOffering('alice',{...draft,paths:['users/alice/missing.jpg']},'node.example')).rejects.toMatchObject({code:'22023'});
    await expect(db.createOffering('alice',{...draft,authorId:'bob'},'node.example')).rejects.toMatchObject({code:'22023'});
    const {offering}=await db.createOffering('alice',{...draft,kind:'bed',bedId:'bed',visibility:'public'},'node.example');
    expect(offering).toMatchObject({offeringBedId:'bed',offeringBedName:'Bed'});
    expect(sql('SELECT count(*) FROM pulses;')).toBe('1');
    expect(sql('SELECT count(*) FROM seed.offering_birth_proofs;')).toBe('1');
  }finally{await db.close();}
});
it('rolls back the offering and protected proof when its recipient notice cannot be written',async()=>{
  const db=await apiDatabase(2);
  try {
    await db.profile('alice',{displayName:'Alice'});
    sql(`INSERT INTO lifetrees VALUES ('source','{"anchorUid":"alice","visibility":"public"}'),('target','{"anchorUid":"bob","visibility":"public"}');
      CREATE FUNCTION public.fail_offer_notice() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.doc->>'previousHash'='OFFER_NOTICE' THEN RAISE EXCEPTION 'notice failed'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER fail_notice BEFORE INSERT ON public.pulses FOR EACH ROW EXECUTE FUNCTION public.fail_offer_notice();`);
    await expect(db.createOffering('alice',{action:'create',kind:'code',title:'Change',body:'A patch',appreciation:1,url:'https://example.test/patch',
      fromTreeId:'source',toKind:'tree',toId:'target'},'node.example')).rejects.toThrow('notice failed');
    expect(sql('SELECT count(*) FROM pulses;')).toBe('0');expect(sql('SELECT count(*) FROM seed.offering_birth_proofs;')).toBe('0');
  }finally{await db.close();}
});

it('edits and pauses offering listings without rewriting birth proofs, identity or accepted words',async()=>{
  const db=await apiDatabase(3);
  try {
    await db.profile('alice',{displayName:'Alice'});
    const {offering}=await db.createOffering('alice',{action:'create',kind:'service',title:'First',body:'Private original',appreciation:21,visibility:'private'},'node.example');
    const proof=sql('SELECT preimage FROM seed.offering_birth_proofs;');
    const edit={action:'edit',id:offering.id,title:'Retold',body:'Public words',appreciation:22,url:'',visibility:'public'};
    await expect(db.offeringLifecycle('bob',edit)).rejects.toMatchObject({code:'42501'});
    const changed=(await db.offeringLifecycle('alice',edit)).offering;
    expect(changed).toMatchObject({title:'Retold',body:'Public words',content:'Public words',offeringAppreciationLight:22,visibility:'public',hash:offering.hash,lid:offering.lid,authorId:'alice'});
    expect(changed).not.toHaveProperty('birthPreimage');expect(sql('SELECT preimage FROM seed.offering_birth_proofs;')).toBe(proof);
    expect((await db.offeringLifecycle('alice',{action:'set_active',id:offering.id,active:false})).offering.offeringActive).toBe(false);
    expect((await db.offeringLifecycle('alice',{action:'set_active',id:offering.id,active:true})).offering.offeringActive).toBe(true);
    sql("INSERT INTO admins VALUES ('staff','{}');");
    await expect(db.offeringLifecycle('staff',{action:'set_active',id:offering.id,active:false})).rejects.toMatchObject({code:'42501'});
    await db.offeringLifecycle('staff',{...edit,title:'Staff retelling'});
    sql(`UPDATE pulses SET doc=doc || '{"offeringStatus":"accepted"}'::jsonb WHERE id='${offering.id}';`);
    await expect(db.offeringLifecycle('alice',edit)).rejects.toMatchObject({code:'LS035'});
    await expect(db.offeringLifecycle('staff',edit)).rejects.toMatchObject({code:'LS035'});
    expect(sql('SELECT preimage FROM seed.offering_birth_proofs;')).toBe(proof);
  }finally{await db.close();}
});
it('serializes withdrawal against acceptance and lets only current recipients decline',async()=>{
  const db=await apiDatabase(4);
  try {
    await db.profile('alice',{displayName:'Alice'});
    sql(`INSERT INTO lifetrees VALUES ('source','{"anchorUid":"alice","visibility":"public"}'),('target','{"anchorUid":"bob","visibility":"public"}');`);
    const draft={action:'create',kind:'service',title:'Care',body:'Terms',appreciation:21,fromTreeId:'source',toKind:'tree',toId:'target'};
    const {offering}=await db.createOffering('alice',draft,'node.example');
    const outcomes=await Promise.allSettled([db.offeringLifecycle('alice',{action:'withdraw',id:offering.id}),db.acceptOffering('bob',offering.id)]);
    expect(outcomes.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    const status=sql(`SELECT doc->>'offeringStatus' FROM pulses WHERE id='${offering.id}';`);
    expect(['withdrawn','accepted']).toContain(status);
    expect(Number(sql("SELECT count(*) FROM pulses WHERE doc ? 'offeringRole';"))).toBe(status==='accepted'?2:0);
    await expect(db.offeringLifecycle('alice',{action:'withdraw',id:offering.id})).rejects.toMatchObject({code:'LS035'});
    const second=(await db.createOffering('alice',draft,'node.example')).offering;
    await expect(db.offeringLifecycle('alice',{action:'decline',id:second.id})).rejects.toMatchObject({code:'42501'});
    await expect(db.offeringLifecycle('eve',{action:'decline',id:second.id})).rejects.toMatchObject({code:'42501'});
    sql("UPDATE lifetrees SET doc=doc || '{\"anchorUid\":\"carol\"}'::jsonb WHERE id='target';");
    await expect(db.offeringLifecycle('bob',{action:'decline',id:second.id})).rejects.toMatchObject({code:'42501'});
    const declined=(await db.offeringLifecycle('carol',{action:'decline',id:second.id})).offering;
    expect(declined).toMatchObject({offeringStatus:'declined',offeringAnsweredBy:'carol'});
    await expect(db.acceptOffering('carol',second.id)).rejects.toMatchObject({code:'OFFERING_REJECTED'});
  }finally{await db.close();}
});

it('filters offering source choices by current tree edit authority without granting visibility',async()=>{
  const db=await apiDatabase(2);const {seedTreeQuery}=await import('../../src/domain/seedTree.mjs');
  const query=(extra:Record<string,string>={})=>seedTreeQuery(new URLSearchParams({editable:'true',limit:'1',...extra}));
  try {
    sql(`INSERT INTO lifetrees VALUES ('a-own','{"anchorUid":"alice","visibility":"public"}'),('b-legacy','{}'),
      ('c-guardian','{"anchorUid":"bob","visibility":"private"}'),('d-foreign','{"anchorUid":"bob","visibility":"public"}');
      INSERT INTO links(from_id,rel,to_id,lid,doc) VALUES
      ('alice','keeper','b-legacy','01900000-0000-7000-8000-000000000001','{}'),
      ('alice','guardian','c-guardian','01900000-0000-7000-8000-000000000002','{}');`);
    expect((await db.trees(query())).trees).toEqual([]);
    const first=await db.trees(query(),'alice');expect(first.trees.map((t:any)=>t.id)).toEqual(['a-own']);
    const second=await db.trees(query({after:first.next}),'alice');expect(second.trees.map((t:any)=>t.id)).toEqual(['b-legacy']);expect(second.next).toBeNull();
  }finally{await db.close();}
});

it('accepts an alignment once with reciprocal seals and current authority on both trees',async()=>{
  const db=await apiDatabase();
  try {
    sql(`INSERT INTO lifetrees VALUES ('source','{"anchorUid":"alice","name":"Oak","visibility":"public","latestHash":"source-root","blockHeight":2}'),
      ('target','{"anchorUid":"owner","name":"Willow","visibility":"public","genesisHash":"target-root"}');
      INSERT INTO links(from_id,rel,to_id,lid) VALUES ('bob','steward','target','bob-seat');
      INSERT INTO alignments VALUES ('a','{"status":"PENDING","initiatorUid":"alice","targetUid":"bob","initiatorTreeId":"source","targetTreeId":"target"}');`);
    await expect(db.acceptAlignment('owner','a','node.example')).rejects.toMatchObject({code:'42501'});
    const results=await Promise.allSettled([db.acceptAlignment('bob','a','node.example'),db.acceptAlignment('bob','a','node.example')]);
    expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);
    const answer=JSON.parse(sql("SELECT doc FROM alignments WHERE id='a';"));expect(answer.status).toBe('ACCEPTED');
    const from=JSON.parse(sql(`SELECT doc FROM pulses WHERE id='${answer.acceptedPulseIds.from}';`));
    const to=JSON.parse(sql(`SELECT doc FROM pulses WHERE id='${answer.acceptedPulseIds.to}';`));
    const {computeCanonicalHash}=await import('../../src/domain/chain/verify');
    for(const record of [from,to])expect(record.hash).toBe(await computeCanonicalHash(record.previousHash,record.mintedAt,record));
    expect(from).toMatchObject({authorId:'alice',lifetreeId:'source',matchedLifetreeId:'target',previousHash:'source-root'});
    expect(to).toMatchObject({authorId:'bob',lifetreeId:'target',matchedLifetreeId:'source',previousHash:'target-root'});
    expect(JSON.parse(sql("SELECT doc FROM lifetrees WHERE id='source';"))).toMatchObject({latestHash:from.hash,blockHeight:3});
    expect(JSON.parse(sql("SELECT doc FROM lifetrees WHERE id='target';"))).toMatchObject({latestHash:to.hash,blockHeight:1});
    expect(sql('SELECT count(*) FROM pulses;')).toBe('2');
    await expect(db.withSession('bob',(c:any)=>c.query("UPDATE alignments SET doc='{}'"))).rejects.toThrow(/permission denied/);
  }finally{await db.close();}
});

it('refuses alignment acceptance when either participant loses standing or trees coincide',async()=>{
  const db=await apiDatabase();
  try {
    sql(`INSERT INTO lifetrees VALUES ('source','{"anchorUid":"owner"}'),('target','{"anchorUid":"owner"}');
      INSERT INTO alignments VALUES ('a','{"status":"PENDING","initiatorUid":"alice","targetUid":"bob","initiatorTreeId":"source","targetTreeId":"target"}');
      INSERT INTO links(from_id,rel,to_id,lid) VALUES ('bob','keeper','target','bob-seat');`);
    await expect(db.acceptAlignment('bob','a','node.example')).rejects.toMatchObject({code:'42501'});
    sql(`INSERT INTO links(from_id,rel,to_id,lid) VALUES ('alice','steward','source','alice-seat');DELETE FROM links WHERE from_id='bob';`);
    await expect(db.acceptAlignment('bob','a','node.example')).rejects.toMatchObject({code:'42501'});
    sql(`UPDATE alignments SET doc=doc || '{"targetTreeId":"source"}';`);
    await expect(db.acceptAlignment('bob','a','node.example')).rejects.toMatchObject({code:'LS037'});
    expect(sql('SELECT count(*) FROM pulses;')).toBe('0');
  }finally{await db.close();}
});

it('rolls back alignment records and both tree heads when answering fails',async()=>{
  const db=await apiDatabase();
  try {
    sql(`INSERT INTO lifetrees VALUES ('source','{"anchorUid":"alice","latestHash":"root"}'),('target','{"anchorUid":"bob","latestHash":"root"}');
      INSERT INTO alignments VALUES ('a','{"status":"PENDING","initiatorUid":"alice","targetUid":"bob","initiatorTreeId":"source","targetTreeId":"target"}');
      CREATE FUNCTION public.reject_alignment_answer() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'answer failed'; END $$;
      CREATE TRIGGER reject_alignment BEFORE UPDATE ON public.alignments FOR EACH ROW EXECUTE FUNCTION public.reject_alignment_answer();`);
    await expect(db.acceptAlignment('bob','a','node.example')).rejects.toThrow(/answer failed/);
    expect(sql('SELECT count(*) FROM pulses;')).toBe('0');expect(sql("SELECT count(*) FROM lifetrees WHERE doc->>'latestHash'='root';")).toBe('2');
    expect(JSON.parse(sql("SELECT doc FROM alignments WHERE id='a';")).status).toBe('PENDING');
  }finally{await db.close();}
});

it('protects alignment private counterparts and retains exact participant records',async()=>{
  const db=await apiDatabase();const {seedPulseQuery}=await import('../../src/domain/seedPulse.mjs');
  const read=(id:string,uid:string|null=null)=>db.pulses(seedPulseQuery(new URLSearchParams({id})),uid);
  try {
    sql(`INSERT INTO lifetrees VALUES ('source','{"anchorUid":"alice","visibility":"public"}'),('target','{"anchorUid":"bob","visibility":"private"}');
      INSERT INTO alignments VALUES ('a','{"status":"PENDING","initiatorUid":"alice","targetUid":"bob","initiatorTreeId":"source","targetTreeId":"target"}');
      INSERT INTO pulses VALUES ('ordinary','{"visibility":"public"}');`);
    const pair=await db.acceptAlignment('bob','a','node.example');
    for(const id of [pair.fromPulseId,pair.toPulseId]) {
      expect((await read(id)).pulse).toBeNull();
      for(const uid of ['alice','bob'])expect((await read(id,uid)).pulse.id).toBe(id);
      expect((await read(id,'eve')).pulse).toBeNull();
    }
    expect((await read('ordinary')).pulse.id).toBe('ordinary');
    sql(`INSERT INTO pulses SELECT 'copied',doc FROM pulses WHERE id='${pair.toPulseId}';`);
    expect((await read('copied','alice')).pulse).toBeNull();
    sql("DELETE FROM lifetrees WHERE id='target';");
    expect((await read(pair.toPulseId,'alice')).pulse.id).toBe(pair.toPulseId);
  }finally{await db.close();}
});

it('creates alignment proposals from the matched pulse author and keeps negotiation private',async()=>{
  const db=await apiDatabase();const {seedAlignmentQuery}=await import('../../src/domain/seedAlignment.mjs');
  const query=(p:Record<string,string>={})=>seedAlignmentQuery(new URLSearchParams(p));
  try {
    sql(`INSERT INTO lifetrees VALUES ('source','{"anchorUid":"alice","visibility":"public"}'),('target','{"anchorUid":"owner","visibility":"public"}');
      INSERT INTO links(from_id,rel,to_id,lid) VALUES ('bob','steward','target','bob-seat');
      INSERT INTO pulses VALUES ('match','{"authorId":"bob","lifetreeId":"target","visibility":"public"}');`);
    const {alignment}=await db.alignmentCommand('alice',{action:'propose',fromTreeId:'source',targetPulseId:'match'},'node.example');
    expect(alignment).toMatchObject({initiatorUid:'alice',targetUid:'bob',targetTreeId:'target',initiatorPulseId:'PENDING_CREATION',status:'PENDING'});
    expect((await db.alignments(query(),null)).alignments).toEqual([]);
    expect((await db.alignments(query(),'owner')).alignments).toEqual([]);
    expect((await db.alignments(query({target:'me',status:'PENDING'}),'bob')).alignments[0].id).toBe(alignment.id);
    await db.alignmentCommand('alice',{action:'note',id:alignment.id,text:'  Shall we?  '},'node.example');
    await db.alignmentCommand('bob',{action:'note',id:alignment.id,text:'Yes'},'node.example');
    const noted=(await db.alignments(query({id:alignment.id}),'alice')).alignment;
    expect(noted.messages.map((n:any)=>[n.by,n.text])).toEqual([['alice','Shall we?'],['bob','Yes']]);
    await expect(db.alignmentCommand('owner',{action:'note',id:alignment.id,text:'Forged'},'node.example')).rejects.toMatchObject({code:'LS036'});
    await expect(db.alignmentCommand('alice',{action:'reject',id:alignment.id},'node.example')).rejects.toMatchObject({code:'42501'});
    await db.alignmentCommand('bob',{action:'reject',id:alignment.id},'node.example');
    await expect(db.alignmentCommand('alice',{action:'note',id:alignment.id,text:'Too late'},'node.example')).rejects.toMatchObject({code:'LS037'});
    await expect(db.acceptAlignment('bob',alignment.id,'node.example')).rejects.toMatchObject({code:'LS037'});
    expect(sql('SELECT count(*) FROM pulses;')).toBe('1');
  }finally{await db.close();}
});

it('refuses alignment proposals from foreign trees, unreadable matches and mismatched initiating pulses',async()=>{
  const db=await apiDatabase();
  try {
    sql(`INSERT INTO lifetrees VALUES ('source','{"anchorUid":"alice","visibility":"public"}'),('foreign','{"anchorUid":"eve","visibility":"public"}'),('target','{"anchorUid":"bob","visibility":"public"}');
      INSERT INTO pulses VALUES ('match','{"authorId":"bob","lifetreeId":"target","visibility":"public"}'),
      ('hidden','{"authorId":"bob","lifetreeId":"target","visibility":"private"}'),('wrong','{"authorId":"alice","lifetreeId":"foreign"}');`);
    const draft={action:'propose',fromTreeId:'source',targetPulseId:'match'};
    await expect(db.alignmentCommand('alice',{...draft,fromTreeId:'foreign'},'node.example')).rejects.toMatchObject({code:'42501'});
    await expect(db.alignmentCommand('alice',{...draft,targetPulseId:'hidden'},'node.example')).rejects.toMatchObject({code:'LS036'});
    await expect(db.alignmentCommand('alice',{...draft,initiatorPulseId:'wrong'},'node.example')).rejects.toMatchObject({code:'LS036'});
    await expect(db.alignmentCommand('alice',{...draft,targetUid:'alice'},'node.example')).rejects.toMatchObject({code:'22023'});
    expect(sql('SELECT count(*) FROM alignments;')).toBe('0');
  }finally{await db.close();}
});

it('serves alignment negotiation and acceptance through authenticated HTTP',async()=>{
  const fixture=authFixture(),db=await apiDatabase(3),server=createApi(db,await createAuthenticator(fixture.config),{nodeDomain:'node.example'});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();
  if(!address||typeof address==='string')throw new Error('missing_address');
  const base=`http://127.0.0.1:${address.port}`;
  const headers=(uid?:string)=>({'Content-Type':'application/json',...(uid?{Authorization:'Bearer '+fixture.token({sub:'issuer-'+uid})}:{})});
  const post=(value:object,uid?:string)=>fetch(base+'/v1/alignments/command',{method:'POST',headers:headers(uid),body:JSON.stringify(value)});
  try {
    sql(`INSERT INTO lifetrees VALUES ('source','{"anchorUid":"alice","visibility":"public"}'),('target','{"anchorUid":"bob","visibility":"public"}');
      INSERT INTO pulses VALUES ('match','{"authorId":"bob","lifetreeId":"target","visibility":"public"}');`);
    const draft={action:'propose',fromTreeId:'source',targetPulseId:'match'};
    expect((await post(draft)).status).toBe(401);expect((await post({...draft,targetUid:'alice'},'alice')).status).toBe(400);
    const created=await post(draft,'alice');expect(created.status).toBe(200);const {alignment}=await created.json();
    expect((await fetch(base+'/v1/alignments?id='+alignment.id)).status).toBe(404);
    const incoming=await (await fetch(base+'/v1/alignments?target=me&status=PENDING',{headers:headers('bob')})).json();
    expect(incoming.alignments[0].id).toBe(alignment.id);
    expect((await post({action:'note',id:alignment.id,text:'Ready'},'bob')).status).toBe(200);
    expect((await post({action:'accept',id:alignment.id},'alice')).status).toBe(403);
    const accepted=await post({action:'accept',id:alignment.id},'bob');expect(accepted.status).toBe(200);
    expect(await accepted.json()).toMatchObject({fromPulseId:expect.any(String),toPulseId:expect.any(String)});
    expect((await post({action:'accept',id:alignment.id},'bob')).status).toBe(409);
    expect((await post({action:'reject',id:alignment.id},'bob')).status).toBe(409);
    expect((await fetch(base+'/v1/alignments?id=missing',{headers:headers('bob')})).status).toBe(404);
  }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await db.close();}
});

it('paginates private alignment history precisely and serializes rejection against acceptance',async()=>{
  const db=await apiDatabase(3);const {seedAlignmentQuery}=await import('../../src/domain/seedAlignment.mjs');
  const query=(p:Record<string,string>={})=>seedAlignmentQuery(new URLSearchParams(p));
  try {
    sql(`INSERT INTO lifetrees VALUES ('source','{"anchorUid":"alice","visibility":"public"}'),('target','{"anchorUid":"bob","visibility":"public"}');
      INSERT INTO alignments VALUES ('a','{"status":"PENDING","initiatorUid":"alice","targetUid":"bob","initiatorTreeId":"source","targetTreeId":"target","createdAt":"2026-10-29T01:02:03.123456Z"}'),
      ('b','{"status":"PENDING","initiatorUid":"alice","targetUid":"bob","initiatorTreeId":"source","targetTreeId":"target","createdAt":"2026-10-29T01:02:03.123456Z"}');`);
    const first=await db.alignments(query({tree:'source',limit:'1'}),'alice');expect(first.alignments[0].id).toBe('b');expect(first.next).toContain('.123456Z');
    const next=await db.alignments(query({tree:'source',limit:'1',after:first.next}),'alice');expect(next.alignments[0].id).toBe('a');expect(next.next).toBeNull();
    const results=await Promise.allSettled([db.alignmentCommand('bob',{action:'reject',id:'a'},'node.example'),db.acceptAlignment('bob','a','node.example')]);
    expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);
    const status=JSON.parse(sql("SELECT doc FROM alignments WHERE id='a';")).status;
    expect(sql('SELECT count(*) FROM pulses;')).toBe(status==='ACCEPTED'?'2':'0');
  }finally{await db.close();}
});

it('duplicates an event with protected birth proof and permanent lineage without copying participation',async()=>{
  const db=await apiDatabase();
  try {
    sql(`INSERT INTO communities VALUES ('garden','{"anchorUid":"owner"}');
      INSERT INTO links(from_id,rel,to_id,lid) VALUES ('bob','keeper','garden','keeper');
      INSERT INTO users VALUES ('bob','{"displayName":"Bob"}');
      INSERT INTO pulses VALUES ('parent','{"type":"event","authorId":"alice","title":"Gathering","visibility":"community","communityId":"garden","domain":"garden.example","generation":2,"lineageRootId":"root","circleCommunityId":"old-circle","loveCount":10}');`);
    await expect(db.eventCommand('eve',{action:'duplicate',id:'parent'})).rejects.toMatchObject({code:'42501'});
    const {event}=await db.eventCommand('bob',{action:'duplicate',id:'parent'});
    expect(event).toMatchObject({authorId:'bob',authorName:'Bob',title:'Gathering',visibility:'community',communityId:'garden',generation:3,lineageRootId:'root',descendsFromId:'parent',loveCount:0,commentCount:0,previousHash:'COMMUNITY_EVENT'});
    expect(event).not.toHaveProperty('circleCommunityId');expect(event).not.toHaveProperty('birthPreimage');
    expect(sql(`SELECT count(*) FROM links WHERE from_id='${event.id}' AND rel='descends_from' AND to_id='parent';`)).toBe('1');
    expect(sql(`SELECT hash=encode(digest(convert_to(preimage,'UTF8'),'sha256'),'hex') FROM seed.event_birth_proofs WHERE event_id='${event.id}';`)).toBe('t');
    await expect(db.withSession('bob',(c:any)=>c.query('SELECT * FROM seed.event_birth_proofs'))).rejects.toThrow(/permission denied/);
    sql("DELETE FROM links WHERE from_id='bob';");
    await expect(db.eventCommand('bob',{action:'duplicate',id:'parent'})).rejects.toMatchObject({code:'42501'});
  }finally{await db.close();}
});
it('rolls back the event copy and proof when its lineage edge cannot be created',async()=>{
  const db=await apiDatabase();
  try {
    sql(`INSERT INTO pulses VALUES ('parent','{"type":"event","authorId":"alice","title":"Gathering","visibility":"public"}');
      CREATE FUNCTION public.reject_lineage_edge() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'lineage failed'; END $$;
      CREATE TRIGGER reject_lineage BEFORE INSERT ON public.links FOR EACH ROW EXECUTE FUNCTION public.reject_lineage_edge();`);
    await expect(db.eventCommand('alice',{action:'duplicate',id:'parent'})).rejects.toThrow(/lineage failed/);
    expect(sql('SELECT count(*) FROM pulses;')).toBe('1');expect(sql('SELECT count(*) FROM seed.event_birth_proofs;')).toBe('0');
  }finally{await db.close();}
});

it('duplicates events over authenticated HTTP without accepting forged lineage or authorship',async()=>{
  const fixture=authFixture(),db=await apiDatabase(3),server=createApi(db,await createAuthenticator(fixture.config));
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();
  if(!address||typeof address==='string')throw new Error('missing_address');
  const base=`http://127.0.0.1:${address.port}`;
  const post=(uid?:string,extra={})=>fetch(base+'/v1/events/command',{method:'POST',headers:{'Content-Type':'application/json',...(uid?{Authorization:'Bearer '+fixture.token({sub:'issuer-'+uid})}:{})},body:JSON.stringify({action:'duplicate',id:'parent',...extra})});
  try {
    sql(`INSERT INTO pulses VALUES ('parent','{"type":"event","authorId":"alice","title":"Private gathering","visibility":"private"}');`);
    expect((await post()).status).toBe(401);expect((await post('bob')).status).toBe(403);
    expect((await post('alice',{authorId:'bob'})).status).toBe(400);
    expect((await post('alice',{generation:0})).status).toBe(400);
    const response=await post('alice');expect(response.status).toBe(200);const {event}=await response.json();
    expect(event).toMatchObject({visibility:'private',authorId:'alice',descendsFromId:'parent',lineageRootId:'parent',generation:1});
    expect((await fetch(base+'/v1/pulses?id='+event.id)).status).toBe(404);
    expect((await fetch(base+'/v1/pulses?id='+event.id,{headers:{Authorization:'Bearer '+fixture.token({sub:'issuer-alice'})}})).status).toBe(200);
  }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await db.close();}
});

it('creates events with server attribution, community authority and protected birth proofs',async()=>{
  const db=await apiDatabase();const draft={action:'create',title:'Gathering',body:'Welcome',visibility:'private'};
  try {
    sql(`INSERT INTO users VALUES ('alice','{"uid":"alice","displayName":"Alice"}'),('bob','{"uid":"bob","displayName":"Bob"}');
      INSERT INTO communities VALUES ('garden','{"name":"Garden","domain":"garden.example","anchorUid":"bob"}');`);
    const {event}=await db.eventCommand('alice',draft,'node.example');
    expect(event).toMatchObject({authorId:'alice',authorName:'Alice',domain:'node.example',previousHash:'EVENT',visibility:'private',imageUrls:[]});
    expect(sql(`SELECT hash=encode(digest(convert_to(preimage,'UTF8'),'sha256'),'hex') FROM seed.event_birth_proofs WHERE event_id='${event.id}';`)).toBe('t');
    await expect(db.eventCommand('alice',{...draft,communityId:'garden',visibility:'community'},'node.example')).rejects.toMatchObject({code:'42501'});
    const local=(await db.eventCommand('bob',{...draft,communityId:'garden',visibility:'community'},'node.example')).event;
    expect(local).toMatchObject({communityId:'garden',communityName:'Garden',domain:'garden.example',previousHash:'COMMUNITY_EVENT'});
    await expect(db.eventCommand('alice',{...draft,paths:['users/alice/unpublished']},'node.example')).rejects.toMatchObject({code:'22023'});
    await expect(db.eventCommand('alice',{...draft,eventDate:'bad'},'node.example')).rejects.toMatchObject({code:'EVENT_REJECTED'});
    expect(sql('SELECT count(*) FROM pulses;')).toBe('2');
  }finally{await db.close();}
});

it('edits event words without changing author, lineage, birth proof or omitted pictures',async()=>{
  const db=await apiDatabase();
  try {
    sql(`INSERT INTO users VALUES ('alice','{"uid":"alice","displayName":"Alice"}'); INSERT INTO admins VALUES ('staff','{}');`);
    const original=(await db.eventCommand('alice',{action:'create',title:'Original',body:'Private words',visibility:'private'},'node.example')).event;
    sql(`UPDATE pulses SET doc=doc || '{"imageUrls":["https://legacy.example/picture"],"imageUrl":"https://legacy.example/picture","descendsFromId":"parent","lineageRootId":"root","generation":2}' WHERE id='${original.id}';`);
    const proof=sql('SELECT preimage FROM seed.event_birth_proofs;');
    const edit={action:'edit',id:original.id,title:'Retold',body:'Public words',visibility:'public'};
    await expect(db.eventCommand('bob',edit)).rejects.toMatchObject({code:'42501'});
    const retold=(await db.eventCommand('staff',edit)).event;
    expect(retold).toMatchObject({authorId:'alice',hash:original.hash,lid:original.lid,domain:'node.example',descendsFromId:'parent',lineageRootId:'root',generation:2,imageUrls:['https://legacy.example/picture']});
    expect(sql('SELECT preimage FROM seed.event_birth_proofs;')).toBe(proof);
    expect((await db.eventCommand('alice',{...edit,paths:[]})).event.imageUrls).toEqual([]);
    expect(sql('SELECT preimage FROM seed.event_birth_proofs;')).toBe(proof);
  }finally{await db.close();}
});

it('adopts a standalone event once through its own place keeper, never by authorship alone',async()=>{
  const db=await apiDatabase();
  try {
    sql(`INSERT INTO users VALUES ('alice','{"uid":"alice"}');
      INSERT INTO communities VALUES ('garden','{"name":"Garden","domain":"node.example","anchorUid":"bob"}'),('elsewhere','{"name":"Elsewhere","domain":"elsewhere.example","anchorUid":"carol"}');`);
    const original=(await db.eventCommand('alice',{action:'create',title:'Event',body:'Words'},'node.example')).event;
    const edit={action:'edit',id:original.id,title:'Community gathering',body:'Words',communityId:'garden',visibility:'community'};
    await expect(db.eventCommand('alice',edit)).rejects.toMatchObject({code:'42501'});
    await expect(db.eventCommand('carol',{...edit,communityId:'elsewhere'})).rejects.toMatchObject({code:'42501'});
    const adopted=(await db.eventCommand('bob',edit)).event;
    expect(adopted).toMatchObject({communityId:'garden',communityName:'Garden',authorId:'alice',hash:original.hash,previousHash:'EVENT',domain:'node.example'});
    await expect(db.eventCommand('carol',{...edit,communityId:'elsewhere'})).rejects.toMatchObject({code:'22023'});
    expect((await db.eventCommand('alice',{...edit,title:'Author retelling'})).event.title).toBe('Author retelling');
  }finally{await db.close();}
});

it('rolls back an event birth when its protected proof cannot be written',async()=>{
  const db=await apiDatabase();
  try {
    sql(`INSERT INTO users VALUES ('alice','{"uid":"alice"}');
      CREATE FUNCTION public.reject_event_proof() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'proof failed'; END $$;
      CREATE TRIGGER reject_event_proof BEFORE INSERT ON seed.event_birth_proofs FOR EACH ROW EXECUTE FUNCTION public.reject_event_proof();`);
    await expect(db.eventCommand('alice',{action:'create',title:'Event',body:'Words'},'node.example')).rejects.toThrow(/proof failed/);
    expect(sql('SELECT count(*) FROM pulses;')).toBe('0');expect(sql('SELECT count(*) FROM seed.event_birth_proofs;')).toBe('0');
  }finally{await db.close();}
});

it('creates and edits events over HTTP with published pictures and rejects sealed-chain retelling',async()=>{
  const fixture=authFixture(),db=await apiDatabase(3),server=createApi(db,await createAuthenticator(fixture.config),{nodeDomain:'node.example'});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();
  if(!address||typeof address==='string')throw new Error('missing_address');const base=`http://127.0.0.1:${address.port}`;
  const post=(value:object,uid='alice')=>fetch(base+'/v1/events/command',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+fixture.token({sub:'issuer-'+uid})},body:JSON.stringify(value)});
  try {
    sql(`INSERT INTO users VALUES ('alice','{"uid":"alice","displayName":"Alice"}');
      INSERT INTO seed.media_objects VALUES ('users/alice/picture','{}');`);
    const draft={action:'create',title:'Gathering',body:'A'.repeat(5000),eventDate:'2026-11-01T18:00',eventEndDate:'2026-11-02T12:00',paths:['users/alice/picture'],webLinks:[{url:'example.test'}]};
    const response=await post(draft);expect(response.status).toBe(200);const {event}=await response.json();
    expect(event).toMatchObject({imageUrls:['/v1/media?path=users/alice/picture'],webLinks:[{url:'https://example.test/'}],authorId:'alice'});
    const edit={action:'edit',id:event.id,title:'Retold',body:'Words',visibility:'private'};
    expect((await post(edit,'bob')).status).toBe(403);
    const changed=await post(edit);expect(changed.status).toBe(200);
    expect((await changed.json()).event).toMatchObject({hash:event.hash,imageUrls:event.imageUrls,visibility:'private'});
    expect((await fetch(base+'/v1/pulses?id='+event.id)).status).toBe(404);
    expect((await post({...edit,authorId:'bob'})).status).toBe(400);
    sql(`UPDATE pulses SET doc=doc || '{"hashVersion":"lifeseed.block.v1"}' WHERE id='${event.id}';`);
    expect((await post(edit)).status).toBe(400);
  }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await db.close();}
});

it('forms one circle per event lineage concurrently and gathers only missing members',async()=>{
  const db=await apiDatabase(3);
  try {
    sql(`INSERT INTO pulses VALUES ('root','{"type":"event","authorId":"alice","title":"Gathering","domain":"node.example"}'),('copy','{"type":"event","authorId":"bob","lineageRootId":"root"}');
      INSERT INTO lifetrees VALUES ('oak','{"anchorUid":"alice"}'),('willow','{"anchorUid":"bob"}'),('bed','{"treeType":"BED","anchorUid":"bed-owner"}'),('secret','{"treeType":"SECRET","anchorUid":"secret-owner"}');
      INSERT INTO links(from_id,rel,to_id,lid) VALUES ('oak','participant','root','oak-link'),('willow','participant','copy','willow-link'),('bed','participant','root','bed-link'),('secret','participant','root','secret-link');`);
    const answers=await Promise.all([db.eventCommand('alice',{action:'form_circle',id:'root'}),db.eventCommand('bob',{action:'form_circle',id:'copy'})]);
    expect(answers[0].communityId).toBe(answers[1].communityId);expect(answers.filter((answer:any)=>!answer.gathered)).toHaveLength(1);
    const id=answers[0].communityId;
    expect(sql('SELECT count(*) FROM communities;')).toBe('1');
    expect(JSON.parse(sql(`SELECT doc FROM communities WHERE id='${id}';`))).toMatchObject({door:'invite',visibility:'invited',formation:'event',rootEventId:'root'});
    expect(sql(`SELECT string_agg(from_id,',' ORDER BY from_id) FROM links WHERE rel='member' AND to_id='${id}';`)).toBe('alice,bob');
    expect(sql(`SELECT string_agg(from_id,',' ORDER BY from_id) FROM links WHERE rel='participant' AND to_id='${id}';`)).toBe('oak,willow');
    sql(`INSERT INTO lifetrees VALUES ('new-tree','{"anchorUid":"carol"}'); INSERT INTO links(from_id,rel,to_id,lid) VALUES ('new-tree','participant','copy','new-link');`);
    const gathered=await db.eventCommand('bob',{action:'form_circle',id:'copy'});expect(gathered).toMatchObject({communityId:id,members:1,gathered:true});
    expect((await db.eventCommand('bob',{action:'form_circle',id:'copy'})).members).toBe(0);
    expect(sql(`SELECT count(*) FROM pulses WHERE doc->>'circleCommunityId'='${id}';`)).toBe('2');
  }finally{await db.close();}
});
it('refuses event circles without current host authority, eligible participants or a valid remembered binding',async()=>{
  const db=await apiDatabase();
  try {
    sql(`INSERT INTO communities VALUES ('host','{"anchorUid":"owner"}');
      INSERT INTO pulses VALUES ('event','{"type":"event","authorId":"alice","communityId":"host"}');
      INSERT INTO lifetrees VALUES ('bed','{"treeType":"BED","anchorUid":"bob"}'),('oak','{"anchorUid":"alice"}');
      INSERT INTO links(from_id,rel,to_id,lid) VALUES ('bed','participant','event','bed-link'),('bob','keeper','host','keeper');`);
    await expect(db.eventCommand('bob',{action:'form_circle',id:'event'})).rejects.toMatchObject({code:'LS039'});
    sql("INSERT INTO links(from_id,rel,to_id,lid) VALUES ('oak','participant','event','oak-link'); DELETE FROM links WHERE from_id='bob';");
    await expect(db.eventCommand('bob',{action:'form_circle',id:'event'})).rejects.toMatchObject({code:'42501'});
    sql(`UPDATE pulses SET doc=doc || '{"circleCommunityId":"host"}' WHERE id='event';`);
    await expect(db.eventCommand('alice',{action:'form_circle',id:'event'})).rejects.toMatchObject({code:'LS039'});
    sql(`INSERT INTO communities VALUES ('123','{"anchorUid":"bob"}');
      UPDATE pulses SET doc=(doc - 'circleCommunityId') || '{"communityId":123}' WHERE id='event';`);
    await expect(db.eventCommand('bob',{action:'form_circle',id:'event'})).rejects.toMatchObject({code:'42501'});
    expect(sql('SELECT count(*) FROM communities;')).toBe('2');
  }finally{await db.close();}
});
it('serializes event-circle capacity across different lineages',async()=>{
  const db=await apiDatabase(3);
  try {
    sql(`INSERT INTO config VALUES ('limits','{"maxNodeCommunities":1}');
      INSERT INTO pulses VALUES ('first','{"type":"event","authorId":"alice"}'),('second','{"type":"event","authorId":"bob"}');
      INSERT INTO lifetrees VALUES ('tree','{"anchorUid":"alice"}');
      INSERT INTO links(from_id,rel,to_id,lid) VALUES ('tree','participant','first','first-link'),('tree','participant','second','second-link');`);
    const results=await Promise.allSettled([db.eventCommand('alice',{action:'form_circle',id:'first'}),db.eventCommand('bob',{action:'form_circle',id:'second'})]);
    expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);
    expect(results.find(result=>result.status==='rejected')).toMatchObject({reason:{code:'LS002'}});
    expect(sql('SELECT count(*) FROM communities;')).toBe('1');expect(sql("SELECT count(*) FROM pulses WHERE doc ? 'circleCommunityId';")).toBe('1');
  }finally{await db.close();}
});
it('rolls back the whole event circle when recording its lineage memory fails',async()=>{
  const db=await apiDatabase();
  try {
    sql(`INSERT INTO pulses VALUES ('event','{"type":"event","authorId":"alice"}'); INSERT INTO lifetrees VALUES ('tree','{"anchorUid":"alice"}');
      INSERT INTO links(from_id,rel,to_id,lid) VALUES ('tree','participant','event','participant');
      CREATE FUNCTION public.reject_circle_memory() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'memory failed'; END $$;
      CREATE TRIGGER reject_circle_memory BEFORE UPDATE ON public.pulses FOR EACH ROW EXECUTE FUNCTION public.reject_circle_memory();`);
    await expect(db.eventCommand('alice',{action:'form_circle',id:'event'})).rejects.toThrow(/memory failed/);
    expect(sql('SELECT count(*) FROM communities;')).toBe('0');expect(sql('SELECT count(*) FROM links;')).toBe('1');
    expect(sql("SELECT doc ? 'circleCommunityId' FROM pulses WHERE id='event';")).toBe('f');
  }finally{await db.close();}
});

it('resolves portable names through current visibility without exposing private records or stale index entries',async()=>{
  const db=await apiDatabase(1);
  const lids=Array.from({length:7},(_,i)=>'019a1400-0000-7000-8000-00000000000'+(i+1));
  try {
    sql(`INSERT INTO lifetrees VALUES
      ('private-tree','{"lid":"${lids[0]}","id":"forged","anchorUid":"alice","visibility":"private"}'),
      ('secret-tree','{"lid":"${lids[1]}","anchorUid":"alice","treeType":"SECRET","visibility":"public"}');
      INSERT INTO visions VALUES ('private-vision','{"lid":"${lids[2]}","authorId":"alice","visibility":"private"}');
      INSERT INTO communities VALUES ('community','{"lid":"${lids[3]}","door":"closed"}');
      INSERT INTO pulses VALUES ('private-message','{"lid":"${lids[4]}","type":"reach","authorId":"alice","recipientUid":"bob","visibility":"public"}');
      INSERT INTO persons VALUES ('alice','{"lid":"${lids[5]}","displayName":"Alice","privateImportedField":"never-return"}');
      INSERT INTO users VALUES ('hidden-account','{"lid":"${lids[6]}","email":"private@example.test"}');`);
    const read=(lid:string,uid:string|null=null)=>db.being({lid},uid);
    expect((await read(lids[0])).being).toBeNull();
    expect((await read(lids[0],'alice')).being).toEqual({kind:'tree',id:'private-tree',lid:lids[0]});
    expect((await read(lids[0],'bob')).being).toBeNull();
    expect((await read(lids[1])).being).toBeNull();
    expect((await read(lids[1],'alice')).being?.id).toBe('secret-tree');
    expect((await read(lids[2])).being).toBeNull();
    expect((await read(lids[2],'alice')).being?.kind).toBe('vision');
    expect((await read(lids[3])).being).toEqual({kind:'community',id:'community',lid:lids[3]});
    expect((await read(lids[4])).being).toBeNull();
    expect((await read(lids[4],'bob')).being?.id).toBe('private-message');
    expect((await read(lids[5])).being).toEqual({kind:'person',id:'alice',lid:lids[5]});
    expect((await read(lids[6],'hidden-account')).being).toBeNull();
    sql("UPDATE lifetrees SET doc=doc || '{\"visibility\":\"public\"}' WHERE id='private-tree';");
    expect((await read(lids[0])).being?.id).toBe('private-tree');
    sql("DELETE FROM lifetrees WHERE id='private-tree';");
    expect((await read(lids[0])).being).toBeNull();
    await expect(db.withSession(null,(c:any)=>c.query('SELECT * FROM seed.identity_bindings'))).rejects.toMatchObject({code:'42501'});
    expect((await db.withSession('hidden-account',(c:any)=>c.query('SELECT id FROM users'))).rows.map((r:any)=>r.id)).toEqual(['hidden-account']);
  }finally{await db.close();}
});
it('refuses visible portable-name collisions over HTTP without disclosing hidden duplicates',async()=>{
  const fixture=authFixture(),db=await apiDatabase(2),server=createApi(db,await createAuthenticator(fixture.config));
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();
  if(!address||typeof address==='string')throw new Error('missing_address');const base=`http://127.0.0.1:${address.port}`;
  const lid='019a1400-0000-7000-8000-000000000001';
  const get=(uid?:string)=>fetch(base+'/v1/beings?lid='+lid,{headers:uid?{Authorization:'Bearer '+fixture.token({sub:'issuer-'+uid})}:{}});
  try {
    expect((await get()).status).toBe(404);
    sql(`INSERT INTO lifetrees VALUES ('tree','{"lid":"${lid}","visibility":"public","anchorUid":"alice"}');
      INSERT INTO visions VALUES ('hidden','{"lid":"${lid}","visibility":"private","authorId":"alice"}');`);
    expect(await (await get()).json()).toEqual({being:{kind:'tree',id:'tree',lid}});
    const conflict=await get('alice');expect(conflict.status).toBe(409);expect(await conflict.json()).toEqual({error:'identity_needs_review'});
    expect((await get('bob')).status).toBe(200);
    sql(`INSERT INTO communities VALUES ('duplicate','{"lid":"${lid}"}');`);
    expect((await get()).status).toBe(409);
    expect((await fetch(base+'/v1/beings?lid='+lid+'&uid=alice')).status).toBe(400);
    expect((await fetch(base+'/v1/beings?lid='+lid,{headers:{Authorization:'Bearer forged'}})).status).toBe(401);
  }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await db.close();}
});

it('upgrades portable-name indexes without rewriting malformed imported identities',async()=>{
  await migrate(sources.filter(source=>source.name<'049_being_lookup.sql'));
  const lid='019a1400-0000-7000-8000-000000000001';
  sql(`INSERT INTO lifetrees VALUES
    ('oversized',jsonb_build_object('lid',(SELECT string_agg(md5(i::text),'') FROM generate_series(1,1000) i))),
    ('valid','{"lid":"${lid}","visibility":"public"}'),
    ('duplicate','{"lid":"${lid}","visibility":"public"}');`);
  await migrate();
  expect(sql("SELECT length(doc->>'lid') FROM lifetrees WHERE id='oversized';")).toBe('32000');
  expect(sql(`SELECT count(*) FROM lifetrees WHERE doc->>'lid'='${lid}';`)).toBe('2');
  // 049's four finding aids and the Light House's (059), every one bounded to a well-formed name.
  expect(sql("SELECT count(*) FROM pg_indexes WHERE indexname LIKE '%_lid_lookup';")).toBe('5');
  sql(`INSERT INTO lifetrees VALUES ('another-oversized',jsonb_build_object('lid',(SELECT string_agg(md5(i::text),'') FROM generate_series(1,1000) i)));`);
  await migrate();
});
