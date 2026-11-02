// THE MAIL ORGAN (ring 2026-11-03): how letters leave the independent node. The origin node queues a
// document the Trigger Email extension sends and lets Cloud Functions answer document events; here
// one organ does both halves. THE HANDS (mailCommand): a system letter the node composes from plain
// words (domain/mailLetter), the letter of a place fanned out one per subscriber, a look at one's own
// letter's delivery. THE COURIER (createCourier): every tick it composes the effects the triggers of
// migration 056 left in the outbox (a reach's notice and push knock, a join request's knock on the
// keepers, the welcome of a first profile) from facts the context functions read, lands them as
// letters in one transaction, then carries due letters over SMTP and settles each — retrying with the
// law's patience, giving up out loud. Identity never rides a letter: the sender is the charter's,
// the voice a place's record, the recipients the node's own facts. Nothing here is reachable by a
// request except through mailCommand, unsubscribe and requestInvite.
import {randomBytes} from 'node:crypto';
import {uuidv7} from '../../src/domain/uuidv7.mjs';
import {mailVoiceOf,systemMailOf,systemLetterOf,reachRecipientsOf,reachThrottleIdOf,reachMayWrite,reachLetterOf,knockLetterOf,knockRecipientsOf,
  welcomeLetterOf,newsletterFooterOf,unsubscribeUrlOf,newsletterHeadersOf,mailSettlementOf,outboxIsStale,MAIL_DAILY_LIMIT,MAIL_MAX_ATTEMPTS,
  audienceOf,newsletterSendRefusal,normalizePlaceDomain,notificationOf,mailFromOf,charterOwnDomains,charterOrigin,publicNameOf,independentCharterProblem} from '../generated/chain.mjs';
import {refuse} from './organs.mjs';

const run=(c,sql,params)=>c.query(sql,params).then(r=>r.rows[0].result);
const lid=()=>uuidv7(Date.now(),randomBytes(10));
const text=value=>typeof value==='string'?value:'';
const msOf=value=>{if(typeof value!=='string')return null;const ms=Date.parse(value);return Number.isFinite(ms)?ms:null;};
const doorOf=raw=>{
  const door=text(raw).trim().toLowerCase().replace(/^www\./,'');
  return /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/.test(door) && door.length<=253?door:null;
};

/** The organ, configured by the installation: the charter (name, domains, sender), the public origin,
 * the postal line of every footer, and the two couriers — `transport` (nodemailer-shaped: sendMail)
 * and `push` ({send(subscription, notice)}) — either of which may be absent.
 * @param {{charter: *, nodeOrigin?: string | null, postal?: string | null, transport?: {sendMail: (letter: *) => Promise<*>} | null,
 *   push?: {send: (subscription: {endpoint: string, keys: {p256dh: string, auth: string}}, notice: *) => Promise<*>} | null, now?: () => number, log?: {warn: (...args: *[]) => void}}} options */
export function createMailOrgan({charter,nodeOrigin=null,postal=null,transport=null,push=null,now=Date.now,log=console}) {
  const problem=independentCharterProblem(charter);
  if(problem)throw Object.assign(new Error('The mail organ needs a sound independent charter: '+problem),{code:'charter_unsound'});
  const ownDomains=charterOwnDomains(charter);
  const nodeVoice={name:charter.name,origin:nodeOrigin??charterOrigin(charter),postal:postal||charter.keeper.email};
  const voiceOf=source=>mailVoiceOf(source,nodeVoice);
  // A letter as the queue stores it and the courier sends it; the sender wears the place (domain/charter mailFromOf).
  const letterOf=({to,subject,html,text:plain,headers,place,uid})=>({id:lid(),uid:uid??null,to,from:mailFromOf(charter,place??null),subject,html,
    ...(plain?{text:plain}:{}),...(headers?{headers}:{})});

  async function mailCommand(withSession,uid,command) {
    if(command.action==='status')return withSession(uid,async c=>{
      const delivery=await run(c,'SELECT seed.mail_status($1) AS result',[command.id]);
      if(!delivery)refuse('mail_missing',404);
      return {delivery};
    });
    if(!transport)refuse('mail_unavailable',503);
    if(command.action==='send_system') {
      const mail=systemMailOf(command,charter.name);
      if('refusal' in mail)refuse(mail.refusal,400);
      return withSession(uid,async c=>{
        await run(c,'SELECT seed.mail_quota($1) AS result',[MAIL_DAILY_LIMIT]);
        // The door the hand stood at names the place whose voice dresses the letter; a node door, or no place, is the node.
        const door=doorOf(command.domain);
        const source=door && !ownDomains.includes(door)?(await run(c,'SELECT seed.mail_place($1) AS result',[door]))??{domain:door}:null;
        const letter=systemLetterOf(mail.text,mail.ctaUrl,mail.ctaLabel,voiceOf(source));
        const ids=await run(c,'SELECT seed.mail_enqueue($1::jsonb) AS result',[JSON.stringify([letterOf({to:mail.recipients,subject:mail.subject,html:letter.html,text:letter.text,
          place:source?{name:text(source.name),domain:text(source.domain)}:null})])]);
        return {success:true,id:ids[0]};
      });
    }
    return withSession(uid,async c=>{
      const context=await run(c,'SELECT seed.newsletter_context($1) AS result',[command.communityId]);
      if(!context)refuse('community_missing',404);
      const home=normalizePlaceDomain(text(context.community.domain));
      const audience=audienceOf(context.subscriptions,home);
      const isNodePlace=ownDomains.includes(home);
      const refusal=newsletterSendRefusal({isKeeper:context.isKeeper===true,isStaff:context.isStaff===true,isNodePlace,audience:audience.length});
      if(refusal)refuse(refusal,refusal==='newsletter_not_keeper'?403:409);
      const place={name:text(context.community.name)||home,domain:home};
      const voice=voiceOf({name:context.community.name,domain:home,theme:context.community.theme,mail:context.community.mail});
      const tokens=[],letters=[];
      for(const sub of audience) {
        // Every subscriber gets their own opaque unsubscribe token, minted here when the record has none.
        const token=typeof sub.unsubToken==='string' && /^[A-Za-z0-9_-]{16,128}$/.test(sub.unsubToken)?sub.unsubToken:randomBytes(16).toString('hex');
        if(token!==sub.unsubToken)tokens.push({id:sub.id,token});
        const unsubscribe=unsubscribeUrlOf(nodeVoice.origin,token);
        letters.push(letterOf({to:[String(sub.email)],uid:typeof sub.uid==='string'?sub.uid:null,place,subject:command.subject,
          html:command.html+newsletterFooterOf({placeName:place.name,unsubscribeUrl:unsubscribe},voice),headers:newsletterHeadersOf(unsubscribe)}));
      }
      return run(c,'SELECT seed.apply_newsletter($1,$2::jsonb,$3::jsonb,$4,$5) AS result',[command.communityId,JSON.stringify(letters),JSON.stringify(tokens),command.subject,isNodePlace]);
    });
  }

  // ── THE EFFECTS, COMPOSED FROM FACTS ──────────────────────────────────────────────────────
  // Letters to queue and throttle marks to set for one effect, plus the knocks to push after it lands.
  async function compose(withSession,effect) {
    const nowMs=now();
    if(effect.kind==='reach') {
      const context=await withSession(null,c=>run(c,'SELECT seed.reach_context($1) AS result',[effect.ref]));
      if(!context)return {letters:[],throttles:[],knocks:[]};
      const pulse=context.pulse??{};
      const voice=voiceOf(context.place??null);
      const facts=new Map((Array.isArray(context.recipients)?context.recipients:[]).map(r=>[r.uid,r]));
      const letters=[],throttles=[],knocks=[];
      const origin=typeof pulse.domain==='string' && doorOf(pulse.domain)?`https://${doorOf(pulse.domain)}`:nodeVoice.origin;
      const notice=push?notificationOf(pulse,origin):null;
      for(const uid of reachRecipientsOf(pulse)) {
        const fact=facts.get(uid);
        if(!fact)continue;
        if(transport && reachMayWrite({directMessages:fact.directMessages,email:fact.email,lastSentAtMs:msOf(fact.lastSentAt),nowMs})) {
          const letter=reachLetterOf(pulse,voice,charter.name);
          letters.push(letterOf({to:[fact.email],uid,subject:letter.subject,html:letter.html,text:letter.text,place:context.place?{name:text(context.place.name),domain:text(context.place.domain)}:null}));
          throttles.push(reachThrottleIdOf(uid,pulse));
        }
        if(notice)for(const sub of Array.isArray(fact.subscriptions)?fact.subscriptions:[])knocks.push({uid,subscription:sub,notice});
      }
      return {letters,throttles,knocks};
    }
    if(effect.kind==='join_request') {
      const context=await withSession(null,c=>run(c,'SELECT seed.knock_context($1) AS result',[effect.ref]));
      if(!context || !transport)return {letters:[],throttles:[],knocks:[]};
      const community=context.community??{};
      const voice=voiceOf({name:community.name,domain:community.domain,theme:community.theme,mail:community.mail});
      const who=context.requester??{};
      const requester=publicNameOf({displayName:text(who.displayName),anonymous:who.anonymous===true,treeName:text(who.treeName)||null})||'Someone';
      const letter=knockLetterOf({requester,communityName:text(community.name),nodeName:charter.name,nodeOrigin:nodeVoice.origin},voice);
      const emails=context.emails??{};
      const letters=knockRecipientsOf({anchorUid:community.anchorUid,stewardUids:Array.isArray(context.stewardUids)?context.stewardUids:[],requesterUid:text(context.requesterUid)})
        .filter(uid=>typeof emails[uid]==='string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emails[uid]))
        .map(uid=>letterOf({to:[emails[uid]],uid,subject:letter.subject,html:letter.html,text:letter.text,place:{name:text(community.name),domain:text(community.domain)}}));
      return {letters,throttles:[],knocks:[]};
    }
    if(effect.kind==='welcome') {
      const context=await withSession(null,c=>run(c,'SELECT seed.welcome_context($1) AS result',[effect.ref]));
      if(!context || !transport || typeof context.email!=='string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(context.email))return {letters:[],throttles:[],knocks:[]};
      const words=welcomeLetterOf({displayName:text(context.displayName),nodeName:charter.name});
      const letter=systemLetterOf(words.text,'','Open',voiceOf(null));
      return {letters:[letterOf({to:[context.email],uid:effect.ref,subject:words.subject,html:letter.html,text:letter.text})],throttles:[],knocks:[]};
    }
    return {letters:[],throttles:[],knocks:[]};
  }

  // A knock on a device; a device that is gone (404/410) is dropped from the ledger.
  async function knock(withSession,{uid,subscription,notice}) {
    const sub=subscription??{};
    if(typeof sub.endpoint!=='string' || typeof sub.keys?.p256dh!=='string' || typeof sub.keys?.auth!=='string')return;
    try {await push.send({endpoint:sub.endpoint,keys:{p256dh:sub.keys.p256dh,auth:sub.keys.auth}},notice);}
    catch(error) {
      const status=error?.statusCode;
      if(status===404 || status===410)await withSession(null,c=>c.query('SELECT seed.push_drop($1,$2)',[uid,sub.id])).catch(()=>undefined);
      else log.warn('push knock failed:',status??(error instanceof Error?error.message:'unknown'));
    }
  }

  // ── THE COURIER: effects, then letters, then the sweep — one tick ──────────────────────────
  function createCourier(withSession,{batch=20,leaseMs=120000}={}) {
    let busy=false,timer=null;
    async function tick() {
      if(busy)return null;
      busy=true;
      const report={effects:0,letters:0,delivered:0,failed:0,retried:0};
      try {
        const effects=await withSession(null,c=>run(c,'SELECT seed.outbox_take($1,$2) AS result',[batch,leaseMs]));
        for(const effect of effects) {
          report.effects++;
          try {
            if(outboxIsStale(msOf(effect.createdAt)??0,now())){await withSession(null,c=>c.query('SELECT seed.outbox_settle($1,$2,NULL)',[effect.id,'stale']));continue;}
            const {letters,throttles,knocks}=await compose(withSession,effect);
            await withSession(null,c=>c.query('SELECT seed.apply_courier($1,$2::jsonb,$3::text[])',[effect.id,JSON.stringify(letters),throttles]));
            report.letters+=letters.length;
            for(const k of knocks)await knock(withSession,k);
          } catch(error) {
            const give=effect.attempts>=MAIL_MAX_ATTEMPTS;
            log.warn(`effect ${effect.kind} ${effect.ref} failed (attempt ${effect.attempts}):`,error instanceof Error?error.message:'unknown');
            await withSession(null,c=>c.query('SELECT seed.outbox_settle($1,$2,$3)',[effect.id,give?'failed':'retry',give?null:mailSettlementOf({attempts:effect.attempts,ok:false}).nextInMs])).catch(()=>undefined);
          }
        }
        if(transport) {
          const letters=await withSession(null,c=>run(c,'SELECT seed.mail_take($1,$2) AS result',[batch,leaseMs]));
          for(const letter of letters) {
            const d=letter.doc??{};
            let settlement;
            try {
              await transport.sendMail({from:d.from,to:d.to,subject:d.subject,html:d.html,...(d.text?{text:d.text}:{}),...(d.headers?{headers:d.headers}:{})});
              settlement=mailSettlementOf({attempts:Number(letter.attempts)||1,ok:true});
              report.delivered++;
            } catch(error) {
              settlement=mailSettlementOf({attempts:Number(letter.attempts)||1,ok:false,error:error instanceof Error?error.message:'delivery_failed'});
              if(settlement.state==='ERROR')report.failed++;else report.retried++;
            }
            await withSession(null,c=>c.query('SELECT seed.mail_settle($1,$2,$3,$4)',[letter.id,settlement.state,settlement.error,settlement.nextInMs])).catch(()=>undefined);
          }
        }
        await withSession(null,c=>c.query('SELECT seed.mail_sweep()')).catch(()=>undefined);
      } finally {busy=false;}
      return report;
    }
    return {
      tick,
      start(intervalMs=15000) {if(timer)return;timer=setInterval(()=>{tick().catch(error=>log.warn('courier tick failed:',error instanceof Error?error.message:'unknown'));},intervalMs);timer.unref();},
      stop() {if(timer){clearInterval(timer);timer=null;}},
    };
  }

  return {name:charter.name,ownDomains,origin:nodeVoice.origin,hasTransport:!!transport,hasPush:!!push,mailCommand,createCourier};
}

// The SMTP courier from one URL (smtps://user:pass@host:465 — TLS from the first byte; smtp://host:587 —
// STARTTLS required): nodemailer's transport, never a plaintext session — except where the installation
// says so out loud (smtp://relay:1025?plaintext=true), for a local walk's mail catcher on the Compose network.
export function smtpTransportOptions(url) {
  let parsed;
  try {parsed=new URL(url);}catch{throw Object.assign(new Error('SEED_SMTP_URL must be an smtps:// or smtp:// URL.'),{code:'smtp_url_unsound'});}
  const plaintext=parsed.protocol==='smtp:' && parsed.search==='?plaintext=true';
  if(!['smtps:','smtp:'].includes(parsed.protocol) || !parsed.hostname || parsed.pathname.length>1 || (parsed.search && !plaintext) || parsed.hash)throw Object.assign(new Error('SEED_SMTP_URL must be an smtps:// or smtp:// URL.'),{code:'smtp_url_unsound'});
  const secure=parsed.protocol==='smtps:';
  const port=parsed.port?Number(parsed.port):secure?465:587;
  if(!Number.isInteger(port) || port<1 || port>65535)throw Object.assign(new Error('SEED_SMTP_URL port is not sound.'),{code:'smtp_url_unsound'});
  const options={host:parsed.hostname,port,secure,...(secure?{}:plaintext?{ignoreTLS:true}:{requireTLS:true})};
  if(parsed.username)options.auth={user:decodeURIComponent(parsed.username),pass:decodeURIComponent(parsed.password)};
  return options;
}
