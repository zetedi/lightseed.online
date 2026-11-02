-- THE MAIL ORGAN (ring 2026-11-03): how letters leave this node, and the effects a write has beyond
-- its row. On the origin node every outbound mail is a document the Trigger Email extension sends
-- and the effects are Cloud Functions on document events; here the queue is seed.mail (the courier
-- in seed/api/mail.mjs sends it over SMTP and settles each row), and the effects are an OUTBOX the
-- triggers below fill — a reach, a knock on a community's door, the first profile — which the same
-- courier composes from facts read by the context functions here. Everything in this file lives in
-- the seed schema: none of it travels (the plan excludes mail, mailThrottle, usage), none of it is a
-- being. The runtime role reaches only the functions granted in domain/seedRuntime; the courier's
-- doors (mail_take, outbox_take, the contexts) are server-only hands no HTTP request can ask for.

-- ── THE QUEUE, THE THROTTLE, THE COUNTERS, THE OUTBOX ──────────────────────────────────────────
create table seed.mail(
  id text primary key, uid text, doc jsonb not null, delivery jsonb not null,
  created_at timestamptz not null default now(), next_attempt_at timestamptz not null default now(), lease_until timestamptz);
alter table seed.mail enable row level security;
revoke all on seed.mail from public;
create index mail_due on seed.mail(next_attempt_at) where (delivery->>'state') in ('PENDING','PROCESSING');
create table seed.mail_throttle(id text primary key, last_sent_at timestamptz not null);
alter table seed.mail_throttle enable row level security;
revoke all on seed.mail_throttle from public;
create table seed.usage(uid text not null, day date not null, counters jsonb not null default '{}'::jsonb, primary key(uid,day));
alter table seed.usage enable row level security;
revoke all on seed.usage from public;
create table seed.outbox(
  id bigserial primary key, kind text not null, ref text not null, created_at timestamptz not null default now(),
  attempts integer not null default 0, next_attempt_at timestamptz not null default now(), lease_until timestamptz, done_at timestamptz, outcome text);
alter table seed.outbox enable row level security;
revoke all on seed.outbox from public;
create index outbox_open on seed.outbox(next_attempt_at) where done_at is null;
create index subscriptions_unsub_token on public.subscriptions((doc->>'unsubToken'));
create index invite_requests_email on public.invite_requests((doc->>'email'),id);

-- A true name the soil can mint when a server effect births a link (UUIDv7: the moment in the first
-- 48 bits, the rest random). Every other lid still arrives from the API's hand.
create function seed.lid() returns text language plpgsql volatile set search_path=pg_catalog as $$
declare b bytea:=decode(replace(gen_random_uuid()::text,'-',''),'hex'); ms bigint:=(extract(epoch from clock_timestamp())*1000)::bigint;
begin
  b:=set_byte(b,0,((ms>>40)&255)::int); b:=set_byte(b,1,((ms>>32)&255)::int); b:=set_byte(b,2,((ms>>24)&255)::int);
  b:=set_byte(b,3,((ms>>16)&255)::int); b:=set_byte(b,4,((ms>>8)&255)::int); b:=set_byte(b,5,(ms&255)::int);
  b:=set_byte(b,6,(get_byte(b,6)&15)|112); b:=set_byte(b,8,(get_byte(b,8)&63)|128);
  return encode(b,'hex')::uuid::text;
end;
$$;
revoke all on function seed.lid() from public;

-- ── WHAT A HAND MAY ASK ─────────────────────────────────────────────────────────────────────
-- One more letter today, or the day's limit (LS067). Staff are not counted (the origin's isStaffUid).
create function seed.mail_quota(daily_limit integer) returns integer
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); today date:=(now() at time zone 'UTC')::date; used integer;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if daily_limit is null or daily_limit<1 then raise exception 'Invalid limit' using errcode='22023'; end if;
  if seed.is_staff() then return -1; end if;
  insert into seed.usage(uid,day) values(actor,today) on conflict do nothing;
  select coalesce(seed.doc_num(counters->'dailyEmail',0),0)::integer into used from seed.usage where uid=actor and day=today for update;
  if used>=daily_limit then raise exception 'Daily mail limit reached' using errcode='LS067'; end if;
  update seed.usage set counters=counters||jsonb_build_object('dailyEmail',used+1) where uid=actor and day=today;
  return used+1;
end;
$$;
revoke all on function seed.mail_quota(integer) from public;
-- The place rooted at a door (or answering at it as an alias): what lends a letter its voice.
create function seed.mail_place(door text) returns jsonb language sql stable security definer set search_path=pg_catalog as $$
  select jsonb_build_object('name',c.doc->'name','domain',c.doc->'domain','theme',c.doc->'theme','mail',c.doc->'mail')
  from public.communities c where door is not null and door<>'' and (c.doc->>'domain'=door
    or (jsonb_typeof(c.doc->'domainAliases')='array' and c.doc->'domainAliases' @> to_jsonb(door)))
  order by seed.vision_moment(c.doc),c.id limit 1;
$$;
revoke all on function seed.mail_place(text) from public;
-- One letter into the queue (internal): the shape the courier sends, the owner who may read its state.
create function seed.mail_insert(owner text, letter jsonb) returns text
language plpgsql security definer set search_path=pg_catalog as $$
declare mail_id text:=letter->>'id';
begin
  if jsonb_typeof(letter) is distinct from 'object' or mail_id is null or mail_id !~ '^[A-Za-z0-9_-]{1,128}$'
    or jsonb_typeof(letter->'to') is distinct from 'array' or jsonb_array_length(letter->'to') not between 1 and 5
    or exists(select 1 from jsonb_array_elements(letter->'to') e where jsonb_typeof(e) is distinct from 'string' or (e#>>'{}') !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
    or jsonb_typeof(letter->'from') is distinct from 'string' or jsonb_typeof(letter->'subject') is distinct from 'string' or jsonb_typeof(letter->'html') is distinct from 'string'
    or (letter ? 'text' and jsonb_typeof(letter->'text') is distinct from 'string') or (letter ? 'headers' and jsonb_typeof(letter->'headers') is distinct from 'object')
    or (owner is not null and (length(owner) not between 1 and 128 or owner ~ '[[:space:][:cntrl:]]'))
    then raise exception 'Invalid letter' using errcode='22023'; end if;
  insert into seed.mail(id,uid,doc,delivery) values(mail_id,owner,(letter-'id')-'uid',jsonb_build_object('state','PENDING','attempts',0));
  return mail_id;
end;
$$;
revoke all on function seed.mail_insert(text,jsonb) from public;
-- The asking hand's own letters (send_system): queued under its uid, ids returned.
create function seed.mail_enqueue(letters jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); letter jsonb; ids text[]:='{}';
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if jsonb_typeof(letters) is distinct from 'array' or jsonb_array_length(letters) not between 1 and 5 then raise exception 'Invalid letters' using errcode='22023'; end if;
  for letter in select * from jsonb_array_elements(letters) loop ids:=ids||seed.mail_insert(actor,letter); end loop;
  return to_jsonb(ids);
end;
$$;
revoke all on function seed.mail_enqueue(jsonb) from public;
-- A letter's delivery, to its owner or staff (the origin's `mail` read rule); null to any other hand.
create function seed.mail_status(mail_id text) returns jsonb language sql stable security definer set search_path=pg_catalog as $$
  select m.delivery from seed.mail m where m.id=mail_id and seed.uid() is not null and (m.uid=seed.uid() or seed.is_staff());
$$;
revoke all on function seed.mail_status(text) from public;

-- ── THE COURIER'S DOORS (server-only: never reached by a request) ──────────────────────────
-- Letters due now, leased to one courier (skip locked), each attempt counted as it begins.
create function seed.mail_take(n integer, lease_ms integer) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare moment timestamptz:=now(); taken jsonb;
begin
  if n is null or n not between 1 and 100 or lease_ms is null or lease_ms not between 1000 and 3600000 then raise exception 'Invalid take' using errcode='22023'; end if;
  with due as (select id from seed.mail where (delivery->>'state') in ('PENDING','PROCESSING') and next_attempt_at<=moment and (lease_until is null or lease_until<moment)
      order by next_attempt_at,id limit n for update skip locked),
    leased as (update seed.mail m set lease_until=moment+make_interval(secs=>lease_ms/1000.0), next_attempt_at=moment+make_interval(secs=>lease_ms/1000.0),
      delivery=m.delivery||jsonb_build_object('state','PROCESSING','attempts',coalesce(seed.doc_num(m.delivery->'attempts',0),0)::integer+1,'startTime',seed.doc_stamp(moment))
      from due where m.id=due.id returning m.id,m.doc,m.delivery)
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'doc',doc,'attempts',delivery->'attempts') order by id),'[]'::jsonb) into taken from leased;
  return taken;
end;
$$;
revoke all on function seed.mail_take(integer,integer) from public;
-- The attempt's outcome: rest (SUCCESS), wait (PENDING, next_in_ms from now), or give up (ERROR).
create function seed.mail_settle(mail_id text, new_state text, error_text text, next_in_ms numeric) returns void
language plpgsql security definer set search_path=pg_catalog as $$
declare moment timestamptz:=now();
begin
  if new_state not in ('PENDING','SUCCESS','ERROR') or (new_state='PENDING' and (next_in_ms is null or next_in_ms<0)) then raise exception 'Invalid settlement' using errcode='22023'; end if;
  update seed.mail set lease_until=null,
    next_attempt_at=case when new_state='PENDING' then moment+make_interval(secs=>next_in_ms/1000.0) else next_attempt_at end,
    delivery=(delivery-'error')||jsonb_build_object('state',new_state)
      ||case when error_text is null then '{}'::jsonb else jsonb_build_object('error',left(error_text,500)) end
      ||case when new_state in ('SUCCESS','ERROR') then jsonb_build_object('endTime',seed.doc_stamp(moment)) else '{}'::jsonb end
    where id=mail_id;
end;
$$;
revoke all on function seed.mail_settle(text,text,text,numeric) from public;
-- Letters and effects are not kept forever: a delivered or failed letter's words leave after thirty
-- days, a settled effect after seven, a throttle mark after one, a day's counters after seven.
create function seed.mail_sweep() returns void language sql security definer set search_path=pg_catalog as $$
  delete from seed.mail where (delivery->>'state') in ('SUCCESS','ERROR') and created_at<now()-interval '30 days';
  delete from seed.outbox where done_at is not null and done_at<now()-interval '7 days';
  delete from seed.mail_throttle where last_sent_at<now()-interval '1 day';
  delete from seed.usage where day<(now() at time zone 'UTC')::date-7;
$$;
revoke all on function seed.mail_sweep() from public;
-- Effects due now, leased to one courier.
create function seed.outbox_take(n integer, lease_ms integer) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare moment timestamptz:=now(); taken jsonb;
begin
  if n is null or n not between 1 and 100 or lease_ms is null or lease_ms not between 1000 and 3600000 then raise exception 'Invalid take' using errcode='22023'; end if;
  with due as (select id from seed.outbox where done_at is null and next_attempt_at<=moment and (lease_until is null or lease_until<moment)
      order by next_attempt_at,id limit n for update skip locked),
    leased as (update seed.outbox o set lease_until=moment+make_interval(secs=>lease_ms/1000.0), next_attempt_at=moment+make_interval(secs=>lease_ms/1000.0), attempts=o.attempts+1
      from due where o.id=due.id returning o.id,o.kind,o.ref,o.attempts,o.created_at)
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'ref',ref,'attempts',attempts,'createdAt',seed.doc_stamp(created_at)) order by id),'[]'::jsonb) into taken from leased;
  return taken;
end;
$$;
revoke all on function seed.outbox_take(integer,integer) from public;
-- An effect's end: done, stale (too old to deliver), failed (out of patience), or retry after next_in_ms.
create function seed.outbox_settle(outbox_id bigint, outcome_text text, next_in_ms numeric) returns void
language plpgsql security definer set search_path=pg_catalog as $$
begin
  if outcome_text not in ('done','stale','failed','retry') or (outcome_text='retry' and (next_in_ms is null or next_in_ms<0)) then raise exception 'Invalid settlement' using errcode='22023'; end if;
  if outcome_text='retry' then update seed.outbox set lease_until=null, next_attempt_at=now()+make_interval(secs=>next_in_ms/1000.0) where id=outbox_id;
  else update seed.outbox set lease_until=null, done_at=now(), outcome=outcome_text where id=outbox_id; end if;
end;
$$;
revoke all on function seed.outbox_settle(bigint,text,numeric) from public;
-- The composed effect lands: its letters queued (each under its recipient), its throttle marks set,
-- the effect done — in one transaction, so a letter is never queued twice for one effect.
create function seed.apply_courier(outbox_id bigint, letters jsonb, throttles text[]) returns integer
language plpgsql security definer set search_path=pg_catalog as $$
declare letter jsonb; n integer:=0; mark text; moment timestamptz:=now();
begin
  if jsonb_typeof(letters) is distinct from 'array' or jsonb_array_length(letters)>100 then raise exception 'Invalid letters' using errcode='22023'; end if;
  if not exists(select 1 from seed.outbox where id=outbox_id and done_at is null for update) then raise exception 'Effect already settled' using errcode='22023'; end if;
  for letter in select * from jsonb_array_elements(letters) loop perform seed.mail_insert(letter->>'uid',letter); n:=n+1; end loop;
  foreach mark in array coalesce(throttles,'{}'::text[]) loop
    insert into seed.mail_throttle(id,last_sent_at) values(mark,moment) on conflict(id) do update set last_sent_at=moment;
  end loop;
  update seed.outbox set lease_until=null, done_at=moment, outcome='done' where id=outbox_id;
  return n;
end;
$$;
revoke all on function seed.apply_courier(bigint,jsonb,text[]) from public;

-- ── THE FACTS AN EFFECT IS COMPOSED FROM ───────────────────────────────────────────────────
-- A reach: the pulse, every candidate recipient's address, opt-out, quiet (by the thread key the
-- letter law also derives), their devices, and the place whose voice dresses the notice.
create function seed.reach_context(pulse_id text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare p jsonb; thread_key text; cid text;
begin
  select doc into p from public.pulses where id=pulse_id;
  if p is null then return null; end if;
  thread_key:=replace(coalesce(nullif(p->>'threadId',''),coalesce(p->>'reachTreeId','')||'_'||coalesce(p->>'lifetreeId','')),'/','_');
  cid:=seed.place_of(p);
  return jsonb_build_object('pulse',p,
    'recipients',coalesce((select jsonb_agg(jsonb_build_object('uid',cand.uid,'email',u.doc->'email','directMessages',u.doc->'emailNotifications'->'directMessages',
        'lastSentAt',(select seed.doc_stamp(t.last_sent_at) from seed.mail_throttle t where t.id=cand.uid||'__'||thread_key),
        'subscriptions',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'endpoint',s.doc->'endpoint','keys',s.doc->'keys') order by s.id) from seed.push_subscriptions s where s.uid=cand.uid),'[]'::jsonb)) order by cand.uid)
      from (select distinct e.uid from (select jsonb_array_elements_text(case when jsonb_typeof(p->'participantUids')='array' then p->'participantUids' else '[]'::jsonb end) as uid
        union select p->>'recipientUid') e where e.uid is not null and e.uid<>'') cand left join public.users u on u.id=cand.uid),'[]'::jsonb),
    'place',(select jsonb_build_object('name',c.doc->'name','domain',c.doc->'domain','theme',c.doc->'theme','mail',c.doc->'mail') from public.communities c where c.id=cid));
end;
$$;
revoke all on function seed.reach_context(text) from public;
-- A knock: the request link, the community and its stewards, the requester's public-name facts, the keepers' addresses.
create function seed.knock_context(link_id text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare l record; c jsonb; stewards text[]; requester text;
begin
  select from_id,to_id into l from public.links where id=link_id and rel='join_request';
  if not found then return null; end if;
  select doc into c from public.communities where id=l.to_id;
  if c is null then return null; end if;
  requester:=l.from_id;
  stewards:=coalesce((select array_agg(from_id order by from_id) from public.links where rel='steward' and to_id=l.to_id),'{}'::text[]);
  return jsonb_build_object('requesterUid',requester,
    'community',jsonb_build_object('id',l.to_id,'name',c->'name','domain',c->'domain','anchorUid',c->'anchorUid','theme',c->'theme','mail',c->'mail'),
    'stewardUids',to_jsonb(stewards),
    'requester',(select jsonb_build_object('displayName',p.doc->'displayName','anonymous',p.doc->'anonymous',
      'treeName',(select t.doc->'name' from public.lifetrees t where t.doc->>'anchorUid'=requester order by t.id limit 1)) from public.persons p where p.id=requester),
    'emails',coalesce((select jsonb_object_agg(u.id,u.doc->'email') from public.users u where u.id=any(stewards||coalesce(c->>'anchorUid','')) and jsonb_typeof(u.doc->'email')='string'),'{}'::jsonb));
end;
$$;
revoke all on function seed.knock_context(text) from public;
-- A welcome: the newcomer's name and address.
create function seed.welcome_context(newcomer text) returns jsonb language sql stable security definer set search_path=pg_catalog as $$
  select jsonb_build_object('displayName',p.doc->'displayName','email',u.doc->'email') from public.persons p left join public.users u on u.id=p.id where p.id=newcomer;
$$;
revoke all on function seed.welcome_context(text) from public;
-- A device that answered 404/410 is gone.
create function seed.push_drop(owner text, subscription_id text) returns void language sql security definer set search_path=pg_catalog as $$
  delete from seed.push_subscriptions where uid=owner and id=subscription_id;
$$;
revoke all on function seed.push_drop(text,text) from public;

-- ── THE LETTER OF A PLACE ───────────────────────────────────────────────────────────────────
-- The facts for newsletterSendRefusal and the audience, to the community's keeper or staff alone.
create function seed.newsletter_context(cid text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); c jsonb; keeper boolean; staff boolean;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select doc into c from public.communities where id=cid;
  if c is null then return null; end if;
  keeper:=c->>'anchorUid'=actor or exists(select 1 from public.links where from_id=actor and rel='keeper' and to_id=cid);
  staff:=seed.is_staff();
  if not keeper and not staff then raise exception 'Forbidden' using errcode='42501'; end if;
  return jsonb_build_object('community',jsonb_build_object('id',cid,'name',c->'name','domain',c->'domain','anchorUid',c->'anchorUid','theme',c->'theme','mail',c->'mail'),
    'isKeeper',keeper,'isStaff',staff,
    'subscriptions',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'email',s.doc->'email','uid',s.doc->'uid','active',s.doc->'active','domain',s.doc->'domain','unsubToken',s.doc->'unsubToken') order by s.id)
      from public.subscriptions s where s.doc->>'domain'=lower(coalesce(c->>'domain',''))),'[]'::jsonb));
end;
$$;
revoke all on function seed.newsletter_context(text) from public;
-- The fan-out lands: one letter per subscriber under their own uid, missing unsubscribe tokens
-- persisted, the place stamped (and the node's own stamp for the node's place) — under the same standing.
create function seed.apply_newsletter(cid text, letters jsonb, tokens jsonb, subject text, node_place boolean) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); c jsonb; letter jsonb; tok jsonb; n integer:=0; moment timestamptz:=now();
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if jsonb_typeof(letters) is distinct from 'array' or jsonb_array_length(letters) not between 1 and 10000 or jsonb_typeof(tokens) is distinct from 'array'
    or subject is null or length(subject) not between 1 and 200 then raise exception 'Invalid newsletter' using errcode='22023'; end if;
  select doc into c from public.communities where id=cid for update;
  if c is null then raise exception 'Community missing' using errcode='LS003'; end if;
  if not (c->>'anchorUid'=actor or exists(select 1 from public.links where from_id=actor and rel='keeper' and to_id=cid) or seed.is_staff()) then raise exception 'Forbidden' using errcode='42501'; end if;
  for tok in select * from jsonb_array_elements(tokens) loop
    if (tok->>'token') !~ '^[A-Za-z0-9_-]{16,128}$' then raise exception 'Invalid token' using errcode='22023'; end if;
    update public.subscriptions set doc=doc||jsonb_build_object('unsubToken',tok->>'token') where id=tok->>'id' and doc->>'domain'=lower(coalesce(c->>'domain','')) and jsonb_typeof(doc->'unsubToken') is distinct from 'string';
  end loop;
  for letter in select * from jsonb_array_elements(letters) loop perform seed.mail_insert(letter->>'uid',letter); n:=n+1; end loop;
  update public.communities set doc=doc||jsonb_build_object('newsletterLastSentAt',seed.doc_stamp(moment),'newsletterLastSubject',subject,'newsletterLastSent',n) where id=cid;
  if node_place then
    insert into public.config(id,doc) values('newsletter',jsonb_build_object('lastSentAt',seed.doc_stamp(moment),'lastSubject',subject,'lastSent',n))
      on conflict(id) do update set doc=public.config.doc||excluded.doc;
  end if;
  return jsonb_build_object('sent',n);
end;
$$;
revoke all on function seed.apply_newsletter(text,jsonb,jsonb,text,boolean) from public;
-- One-click release by TOKEN alone (never a uid): the subscription rests, the profile's switch for
-- that place follows (and the legacy node switch when the place is the node's own).
create function seed.unsubscribe(token text, node_domains text[]) returns boolean
language plpgsql security definer set search_path=pg_catalog as $$
declare s record; place text; moment timestamptz:=now();
begin
  if token is null or token !~ '^[A-Za-z0-9_-]{16,128}$' then return false; end if;
  select id,doc into s from public.subscriptions where doc->>'unsubToken'=token order by id limit 1 for update;
  if not found then return false; end if;
  update public.subscriptions set doc=doc||jsonb_build_object('active',false,'updatedAt',seed.doc_stamp(moment)) where id=s.id;
  place:=coalesce(nullif(s.doc->>'domain',''),node_domains[1]);
  if jsonb_typeof(s.doc->'uid')='string' and place is not null then
    update public.users set doc=seed.doc_set_path(doc,array['newsletterPlaces',place],'false'::jsonb)
      ||case when place=any(coalesce(node_domains,'{}'::text[])) then '{"newsletterSubscribed":false}'::jsonb else '{}'::jsonb end
      where id=s.doc->>'uid';
  end if;
  return true;
end;
$$;
revoke all on function seed.unsubscribe(text,text[]) from public;

-- ── A STRANGER ASKS FOR AN INVITATION (functions requestInvite) ─────────────────────────────
create function seed.request_invite(address text, reason text, new_id text) returns text
language plpgsql security definer set search_path=pg_catalog as $$
begin
  if address is null or length(address)>254 or address !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or address<>lower(address)
    or reason is null or length(reason)>2000 or new_id is null or new_id !~ '^[A-Za-z0-9_-]{1,128}$' then raise exception 'Invalid request' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('invite-request:'||address,0));
  if exists(select 1 from public.network_invites where doc->>'email'=address and doc->>'status'='pending') then return 'pending_invite_exists'; end if;
  if exists(select 1 from public.invite_requests where doc->>'email'=address and doc->>'status'='pending') then return 'already_requested'; end if;
  insert into public.invite_requests(id,doc) values(new_id,jsonb_build_object('email',address,'reason',reason,'status','pending','createdAt',seed.doc_stamp(now())));
  return 'created';
end;
$$;
revoke all on function seed.request_invite(text,text,text) from public;

-- ── THE ADDRESS A LOGIN CARRIES ─────────────────────────────────────────────────────────────
-- The issuer verified the address (email_verified) and the API verified the issuer: the account
-- remembers it, so a letter can reach the being. Identity is never matched by it (migration 008).
create function seed.record_login_email(account text, address text) returns void
language plpgsql security definer set search_path=pg_catalog as $$
begin
  if account is null or length(account) not between 1 and 128 or account ~ '[[:space:][:cntrl:]]'
    or address is null or length(address)>254 or address !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Invalid address' using errcode='22023'; end if;
  insert into public.users(id,doc) values(account,jsonb_build_object('uid',account,'email',address))
    on conflict(id) do update set doc=public.users.doc||jsonb_build_object('email',address) where public.users.doc->>'email' is distinct from address;
end;
$$;
revoke all on function seed.record_login_email(text,text) from public;
-- The signed-in hand's own address, for the shell (the Footer's subscription seat).
create function seed.my_email() returns text language sql stable security definer set search_path=pg_catalog as $$
  select u.doc->>'email' from public.users u where u.id=seed.uid() and seed.uid() is not null and jsonb_typeof(u.doc->'email')='string';
$$;
revoke all on function seed.my_email() from public;

-- ── THE EFFECTS OF A WRITE: outbox rows, and the links an acceptance mints ─────────────────
-- Only a request's own write (seed.uid() set) has an effect: the crossing's import and the owner's
-- repairs never re-send a letter.
create function seed.outbox_on_pulse() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  if seed.uid() is not null and new.doc->>'type'='reach' then insert into seed.outbox(kind,ref) values('reach',new.id); end if;
  return null;
end;
$$;
create trigger pulses_outbox after insert on public.pulses for each row execute function seed.outbox_on_pulse();
create function seed.outbox_on_link() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  if seed.uid() is not null and new.rel='join_request' then insert into seed.outbox(kind,ref) values('join_request',new.id); end if;
  return null;
end;
$$;
create trigger links_outbox after insert on public.links for each row execute function seed.outbox_on_link();
create function seed.outbox_on_person() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  if seed.uid() is not null and new.id=seed.uid() then insert into seed.outbox(kind,ref) values('welcome',new.id); end if;
  return null;
end;
$$;
create trigger persons_outbox after insert on public.persons for each row execute function seed.outbox_on_person();
-- An accepted network invitation (functions onNetworkInviteAccepted), in the acceptance's own
-- transaction: newcomer __welcomed_by__ inviter always; membership of the node the invitation was
-- sent from ONLY when the inviter belongs there (the escalation guard), as `member` (droppable) and
-- `invited_by` (append-only provenance). Create-if-absent: a lid once given is never rewritten.
create function seed.invite_accepted() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare member text:=new.doc->>'acceptedByUserId'; inviter text:=new.doc->>'invitedByUserId'; cid text:=nullif(new.doc->>'nodeCommunityId','');
begin
  if old.doc->>'status'='accepted' or new.doc->>'status' is distinct from 'accepted' then return null; end if;
  if member is null or inviter is null or member=inviter or member ~ '[[:space:][:cntrl:]]' or inviter ~ '[[:space:][:cntrl:]]' then return null; end if;
  insert into public.links(from_id,rel,to_id,lid,doc) values(member,'welcomed_by',inviter,seed.lid(),jsonb_build_object('type','link','inviteId',new.id)) on conflict do nothing;
  if cid is null then return null; end if;
  if not exists(select 1 from public.communities c where c.id=cid and (c.doc->>'anchorUid'=inviter
    or exists(select 1 from public.links l where l.from_id=inviter and l.rel='member' and l.to_id=cid))) then return null; end if;
  insert into public.links(from_id,rel,to_id,lid,doc) values(member,'member',cid,seed.lid(),jsonb_build_object('type','link','inviteId',new.id,'invitedBy',inviter)) on conflict do nothing;
  insert into public.links(from_id,rel,to_id,lid,doc) values(member,'invited_by',cid,seed.lid(),jsonb_build_object('type','link','inviteId',new.id,'invitedBy',inviter)) on conflict do nothing;
  return null;
end;
$$;
create trigger network_invites_accepted after update on public.network_invites for each row execute function seed.invite_accepted();
