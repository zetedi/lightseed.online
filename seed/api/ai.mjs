// THE AI ORGAN (ring 2026-11-03): how the independent node reaches a model on a hand's behalf — the
// mirror of functions/src/ai.ts. THE HAND (aiCommand generate): the shell sends a transcript, the
// organ decides WHOSE KEY answers — a kept credential the hand may spend (opened here, for the length
// of one call), else the node's own key, which is a member benefit (seed.ai_gate → nodeAiRefusal) and
// counted against the day (seed.ai_quota) — then asks the rail OUTSIDE the transaction and carries
// the answer or the refusal back by name. THE KEEPING (save_credential): a key is sealed under the
// installation's credential key (AES-256-GCM, bound to its row name) before it touches the soil;
// an empty key removes. Nothing here is reachable except through aiCommand; no route returns a key.
import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
import {AI_RAIL_PROVIDERS,AI_DEFAULT_MODEL,AI_KIND_COUNTER,AI_KIND_LIMIT,nodeAiRefusal,aiKindOf,providerStatusOf,providerKeyRejected,aiRailRefusal,credentialIdOf,keyHintOf} from '../generated/chain.mjs';
import {refuse} from './organs.mjs';

const run=(c,sql,params)=>c.query(sql,params).then(r=>r.rows[0].result);

/** The cipher over a kept key: 32 bytes from SEED_CREDENTIAL_KEY (base64 or hex). A row is sealed with
 * its own name as associated data, so a ciphertext moved to another row will not open. @param {string} secret */
export function createCredentialCipher(secret) {
  const raw=typeof secret==='string'?secret.trim():'';
  const key=/^[0-9a-fA-F]{64}$/.test(raw)?Buffer.from(raw,'hex'):Buffer.from(raw,'base64');
  if(key.length!==32)throw Object.assign(new Error('SEED_CREDENTIAL_KEY must be 32 bytes, base64 or hex (openssl rand -base64 32).'),{code:'credential_key_invalid'});
  const keyId=createHash('sha256').update(key).digest('hex').slice(0,16);
  return {
    keyId,
    seal(plain,name) {
      const iv=randomBytes(12);
      const cipher=createCipheriv('aes-256-gcm',key,iv);
      cipher.setAAD(Buffer.from(name,'utf8'));
      const data=Buffer.concat([cipher.update(plain,'utf8'),cipher.final()]);
      return {ciphertext:Buffer.concat([iv,cipher.getAuthTag(),data]).toString('base64'),keyId};
    },
    open(ciphertext,name,sealedKeyId) {
      if(sealedKeyId!==keyId)throw Object.assign(new Error('The credential was sealed under another key.'),{code:'credential_key_mismatch'});
      const sealed=Buffer.from(String(ciphertext),'base64');
      if(sealed.length<29)throw Object.assign(new Error('The credential ciphertext is malformed.'),{code:'credential_malformed'});
      const decipher=createDecipheriv('aes-256-gcm',key,sealed.subarray(0,12));
      decipher.setAAD(Buffer.from(name,'utf8'));
      decipher.setAuthTag(sealed.subarray(12,28));
      return Buffer.concat([decipher.update(sealed.subarray(28)),decipher.final()]).toString('utf8');
    },
  };
}

/** The organ, configured by the installation: the rails (`{google, anthropic}`, each `{complete(ask)}` →
 * `{text, image?}`), the cipher over kept keys (absent: keys cannot be kept), and the node's own keys
 * (absent for a provider: that rail answers only with a kept key).
 * @param {{rails?: Record<string, {complete: (ask: *) => Promise<{text?: string, image?: string}>}>, cipher?: ReturnType<typeof createCredentialCipher> | null,
 *   nodeKeys?: Record<string, string | null | undefined>, log?: {warn: (...args: *[]) => void}}} options */
export function createAiOrgan({rails={},cipher=null,nodeKeys={},log=console}) {
  const providers=AI_RAIL_PROVIDERS.filter(p=>rails[p] && typeof rails[p].complete==='function');

  async function keep(withSession,uid,command) {
    if(!cipher)refuse('credentials_unavailable',503);
    if(!command.key)return withSession(uid,c=>run(c,'SELECT seed.credential_remove($1,$2,$3,$4) AS result',[command.scope,command.holderId,command.provider,command.intelligenceId]));
    const sealed=cipher.seal(command.key,credentialIdOf(command.scope,command.holderId,command.provider));
    return withSession(uid,c=>run(c,'SELECT seed.credential_save($1,$2,$3,$4,$5,$6,$7) AS result',
      [command.scope,command.holderId,command.provider,sealed.ciphertext,sealed.keyId,keyHintOf(command.key),command.intelligenceId]));
  }

  // Whose key answers: a kept credential the hand may spend, else the node's — gated and counted.
  async function credit(withSession,uid,command,kind) {
    return withSession(uid,async c=>{
      if(command.credential && cipher) {
        const kept=await run(c,'SELECT seed.credential_take($1,$2,$3) AS result',[command.credential.scope,command.credential.holderId,command.provider]);
        if(kept) {
          try {return {apiKey:cipher.open(kept.ciphertext,kept.id,kept.keyId),source:'byo'};}
          catch(error) {log.warn('a kept credential could not be opened:',kept.id,error?.code??error?.message);}
        }
      }
      const apiKey=nodeKeys[command.provider]||null;
      if(!apiKey)refuse('ai_key_missing',412);
      const refusal=nodeAiRefusal(await run(c,'SELECT seed.ai_gate() AS result',[])??{});
      if(refusal)refuse(refusal,403);
      await run(c,'SELECT seed.ai_quota($1,$2) AS result',[AI_KIND_COUNTER[kind],AI_KIND_LIMIT[kind]]);
      return {apiKey,source:'node'};
    });
  }

  async function aiCommand(withSession,uid,command) {
    if(command.action==='save_credential')return keep(withSession,uid,command);
    const rail=providers.includes(command.provider)?rails[command.provider]:null;
    if(!rail)refuse('ai_provider_unknown',400);
    const model=command.model??AI_DEFAULT_MODEL[command.provider];
    const kind=aiKindOf({model,imageOut:command.image});
    const key=await credit(withSession,uid,command,kind);
    let answer;
    try {answer=await rail.complete({apiKey:key.apiKey,model,system:command.system,messages:command.messages,json:command.json,image:command.image});}
    catch(error) {
      const {refusal,status}=aiRailRefusal(providerStatusOf(error),providerKeyRejected(error));
      if(refusal==='ai_failed')log.warn('the model did not answer:',command.provider,model,error?.message??error);
      refuse(refusal,status);
    }
    return {text:typeof answer?.text==='string'?answer.text:'',...(typeof answer?.image==='string' && answer.image?{image:answer.image}:{}),source:key.source};
  }
  return {providers,hasCipher:!!cipher,aiCommand};
}
