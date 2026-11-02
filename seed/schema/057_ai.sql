-- THE AI ORGAN (ring 2026-11-03): the soil's half of what functions/src/ai.ts does for the origin
-- node. A provider key a hand or a place keeps rests here as CIPHERTEXT the API sealed under the
-- installation's credential key (seed/api/ai.mjs): a dump of this table yields nothing usable, and
-- the API process alone can open a row — only for a hand entitled to spend it. The node's own key
-- never touches the database; whether this hand may spend it is read here (seed.ai_gate: staff, the
-- dial config/limits.nodeAiValidatedOnly, a validated membership) and counted here (seed.ai_quota in
-- seed.usage, the origin's usage/{uid} counters). No row is reachable by a request except through
-- these functions, each executed as the runtime role under the session's seed.uid().

create table seed.provider_credentials(
  id text primary key,
  scope text not null check (scope in ('user','community')),
  holder_id text not null check (holder_id<>''),
  provider text not null check (provider in ('anthropic','openai','deepseek','google')),
  ciphertext text not null check (ciphertext<>''),
  key_id text not null,
  key_hint text not null,
  updated_by text not null,
  updated_at timestamptz not null default now());
alter table seed.provider_credentials enable row level security;
revoke all on seed.provider_credentials from public;

-- ── WHO MAY KEEP, WHO MAY SPEND ──────────────────────────────────────────────────────────────
-- Keeping (the origin's canManageCredential): one's own key; a community's by its anchor or staff.
create function seed.credential_manageable(cred_scope text, holder text) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select seed.uid() is not null and holder is not null and holder<>'' and case cred_scope
    when 'user' then holder=seed.uid()
    when 'community' then seed.is_staff() or exists(select 1 from public.communities where id=holder and doc->>'anchorUid'=seed.uid())
    else false end;
$$;
revoke all on function seed.credential_manageable(text,text) from public;
-- Spending (the origin's canUseCredential): one's own key; a community's by any member, its anchor or staff.
create function seed.credential_usable(cred_scope text, holder text) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select seed.uid() is not null and holder is not null and holder<>'' and case cred_scope
    when 'user' then holder=seed.uid()
    when 'community' then seed.is_staff()
      or exists(select 1 from public.links where from_id=seed.uid() and rel='member' and to_id=holder)
      or exists(select 1 from public.communities where id=holder and doc->>'anchorUid'=seed.uid())
    else false end;
$$;
revoke all on function seed.credential_usable(text,text) from public;

-- ── A KEY KEPT, ROTATED, REMOVED ─────────────────────────────────────────────────────────────
-- The API hands the ciphertext and the hint; the row is named as the origin names its document. The
-- connection is mirrored onto the intelligence named — only one the hand may write (its author, or staff).
create function seed.credential_save(cred_scope text, holder text, cred_provider text, cipher text, cipher_key text, hint text, intelligence_id text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid();
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if cred_scope not in ('user','community') or cred_provider not in ('anthropic','openai','deepseek','google') or holder is null or holder='' or length(holder)>128
    or cipher is null or cipher='' or length(cipher)>8192 or cipher_key is null or cipher_key='' or hint is null or length(hint)>16
    or (intelligence_id is not null and (intelligence_id='' or length(intelligence_id)>128)) then raise exception 'Invalid credential' using errcode='22023'; end if;
  if not seed.credential_manageable(cred_scope,holder) then raise exception 'Forbidden' using errcode='42501'; end if;
  insert into seed.provider_credentials(id,scope,holder_id,provider,ciphertext,key_id,key_hint,updated_by,updated_at)
    values(cred_scope||'_'||holder||'_'||cred_provider,cred_scope,holder,cred_provider,cipher,cipher_key,hint,actor,now())
    on conflict(id) do update set ciphertext=excluded.ciphertext,key_id=excluded.key_id,key_hint=excluded.key_hint,updated_by=excluded.updated_by,updated_at=now();
  if intelligence_id is not null then
    update public.intelligences set doc=doc||jsonb_build_object('connected',true,'keyHint',hint,'credentialScope',cred_scope,'credentialHolderUid',holder)
      where id=intelligence_id and (doc->>'authorId'=actor or seed.is_staff());
  end if;
  return jsonb_build_object('connected',true,'keyHint',hint);
end;
$$;
revoke all on function seed.credential_save(text,text,text,text,text,text,text) from public;
create function seed.credential_remove(cred_scope text, holder text, cred_provider text, intelligence_id text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid();
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if cred_scope not in ('user','community') or cred_provider not in ('anthropic','openai','deepseek','google') or holder is null or holder='' or length(holder)>128
    or (intelligence_id is not null and (intelligence_id='' or length(intelligence_id)>128)) then raise exception 'Invalid credential' using errcode='22023'; end if;
  if not seed.credential_manageable(cred_scope,holder) then raise exception 'Forbidden' using errcode='42501'; end if;
  delete from seed.provider_credentials where id=cred_scope||'_'||holder||'_'||cred_provider;
  if intelligence_id is not null then
    update public.intelligences set doc=(doc||'{"connected":false}'::jsonb)-'keyHint' where id=intelligence_id and (doc->>'authorId'=actor or seed.is_staff());
  end if;
  return '{"connected":false}'::jsonb;
end;
$$;
revoke all on function seed.credential_remove(text,text,text,text) from public;
-- The ciphertext a hand may spend, or null: an unknown row and a row that is not theirs answer alike
-- (the origin falls back to the node key in silence), and the key never leaves this function in the clear.
create function seed.credential_take(cred_scope text, holder text, cred_provider text) returns jsonb
language sql stable security definer set search_path=pg_catalog as $$
  select case when seed.uid() is not null and seed.credential_usable(cred_scope,holder)
    then (select jsonb_build_object('id',id,'ciphertext',ciphertext,'keyId',key_id) from seed.provider_credentials where id=cred_scope||'_'||holder||'_'||cred_provider)
    else null end;
$$;
revoke all on function seed.credential_take(text,text,text) from public;

-- ── THE NODE'S OWN KEY: A MEMBER BENEFIT ─────────────────────────────────────────────────────
-- The facts for nodeAiRefusal (domain/aiRequest): staff, the dial (absent or true restricts), and a
-- validated membership — an initiate of the git ledger, or the anchor of a validated tree.
create function seed.ai_gate() returns jsonb
language sql stable security definer set search_path=pg_catalog as $$
  select case when seed.uid() is null then null else jsonb_build_object(
    'staff',seed.is_staff(),
    'validatedOnly',coalesce((select doc->'nodeAiValidatedOnly' from public.config where id='limits'),'true'::jsonb)<>'false'::jsonb,
    'validated',exists(select 1 from public.initiates where id=seed.uid())
      or exists(select 1 from public.lifetrees where doc->>'anchorUid'=seed.uid() and doc->'validated'='true'::jsonb)) end;
$$;
revoke all on function seed.ai_gate() from public;
-- One more reflection (or picture) today on the node's key, or the day's limit (LS068). Staff are not counted.
create function seed.ai_quota(counter text, daily_limit integer) returns integer
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); today date:=(now() at time zone 'UTC')::date; used integer;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if counter not in ('dailyAiText','dailyAiImage') or daily_limit is null or daily_limit<1 then raise exception 'Invalid quota' using errcode='22023'; end if;
  if seed.is_staff() then return -1; end if;
  insert into seed.usage(uid,day) values(actor,today) on conflict do nothing;
  select coalesce(seed.doc_num(counters->counter,0),0)::integer into used from seed.usage where uid=actor and day=today for update;
  if used>=daily_limit then raise exception 'Daily AI limit reached' using errcode='LS068'; end if;
  update seed.usage set counters=counters||jsonb_build_object(counter,used+1) where uid=actor and day=today;
  return used+1;
end;
$$;
revoke all on function seed.ai_quota(text,integer) from public;
