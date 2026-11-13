// THE MAIL REPOSITORY (ring 2026-11-03): the statements of the mail organ (migration 056) — a letter's
// delivery, the daily quota, the place a door names, the queue, the newsletter's facts and apply, the effects'
// facts (a reach, a knock, a welcome), a dropped device, the outbox and the courier's settlements, the sweep,
// the subscriber's release by token and the stranger's request. The letters are composed in the organ.
import {run,perform,repositoryOf} from './statements.mjs';

export const mailRepository=withSession=>repositoryOf(withSession,{
  status:(c,id)=>run(c,'SELECT seed.mail_status($1) AS result',[id]),
  quota:(c,limit)=>run(c,'SELECT seed.mail_quota($1) AS result',[limit]),
  place:(c,door)=>run(c,'SELECT seed.mail_place($1) AS result',[door]),
  enqueue:(c,letters)=>run(c,'SELECT seed.mail_enqueue($1::jsonb) AS result',[JSON.stringify(letters)]),
  newsletterContext:(c,communityId)=>run(c,'SELECT seed.newsletter_context($1) AS result',[communityId]),
  applyNewsletter:(c,communityId,letters,tokens,subject,isNodePlace)=>run(c,'SELECT seed.apply_newsletter($1,$2::jsonb,$3::jsonb,$4,$5) AS result',
    [communityId,JSON.stringify(letters),JSON.stringify(tokens),subject,isNodePlace]),
  reachContext:(c,ref)=>run(c,'SELECT seed.reach_context($1) AS result',[ref]),
  knockContext:(c,ref)=>run(c,'SELECT seed.knock_context($1) AS result',[ref]),
  welcomeContext:(c,ref)=>run(c,'SELECT seed.welcome_context($1) AS result',[ref]),
  pushDrop:(c,uid,subscriptionId)=>perform(c,'SELECT seed.push_drop($1,$2)',[uid,subscriptionId]),
  outboxTake:(c,batch,leaseMs)=>run(c,'SELECT seed.outbox_take($1,$2) AS result',[batch,leaseMs]),
  outboxSettle:(c,id,outcome,nextInMs)=>perform(c,'SELECT seed.outbox_settle($1,$2,$3)',[id,outcome,nextInMs]),
  applyCourier:(c,id,letters,throttles)=>perform(c,'SELECT seed.apply_courier($1,$2::jsonb,$3::text[])',[id,JSON.stringify(letters),throttles]),
  take:(c,batch,leaseMs)=>run(c,'SELECT seed.mail_take($1,$2) AS result',[batch,leaseMs]),
  settle:(c,id,state,error,nextInMs)=>perform(c,'SELECT seed.mail_settle($1,$2,$3,$4)',[id,state,error,nextInMs]),
  sweep:c=>perform(c,'SELECT seed.mail_sweep()'),
  unsubscribe:(c,token,ownDomains)=>run(c,'SELECT seed.unsubscribe($1,$2::text[]) AS result',[token,ownDomains]).then(result=>result===true),
  requestInvite:(c,email,reason,lid)=>run(c,'SELECT seed.request_invite($1,$2,$3) AS result',[email,reason,lid]),
});
