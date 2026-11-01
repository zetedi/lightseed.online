-- Local authentication bindings are not portable identity and never match by email.
-- Only the server's verified issuer/subject may call the narrow resolver.
create table seed.identity_bindings (
  issuer text not null,
  subject text not null,
  uid text not null,
  binding_kind text not null check(binding_kind in ('explicit','enrolled')),
  created_at timestamptz not null default now(),
  primary key(issuer,subject)
);
alter table seed.identity_bindings enable row level security;
revoke all on seed.identity_bindings from public;
create index identity_bindings_uid on seed.identity_bindings(uid);

create function seed.resolve_identity(verified_issuer text, verified_subject text, explicit_uid text, registration_open boolean, candidate_uid text) returns text
language plpgsql security definer set search_path=pg_catalog as $$
declare local_uid text; source_kind text;
begin
  if verified_issuer is null or verified_subject is null or length(verified_issuer) not between 1 and 512
    or length(verified_subject) not between 1 and 512 or verified_issuer !~ '^https://'
    or verified_issuer ~ '[[:space:][:cntrl:]]' or verified_subject ~ '[[:space:][:cntrl:]]'
    or (explicit_uid is not null and (length(explicit_uid) not between 1 and 128 or explicit_uid ~ '[[:space:][:cntrl:]]'))
    then raise exception 'Invalid identity' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('issuer:' || length(verified_issuer)::text || ':' || verified_issuer || verified_subject,0));
  select uid,binding_kind into local_uid,source_kind from seed.identity_bindings where issuer=verified_issuer and subject=verified_subject;
  if found then
    if explicit_uid is not null and explicit_uid<>local_uid then raise exception 'Identity binding conflict' using errcode='LS010'; end if;
    -- Removing an explicit binding from reviewed configuration still revokes it.
    -- Closing registration alone does not lock out existing self-enrolled accounts.
    if source_kind='explicit' and explicit_uid is null then return null; end if;
    return local_uid;
  end if;
  if explicit_uid is not null then local_uid:=explicit_uid;
  elsif registration_open is true then
    if candidate_uid is null or candidate_uid !~ '^oidc_[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then raise exception 'Invalid identity' using errcode='22023'; end if;
    local_uid:=candidate_uid;
    -- Serialize a candidate collision as well as a subject race. Never adopt an
    -- existing person/profile merely because a generated identifier collided.
    perform pg_advisory_xact_lock(hashtextextended('identity-uid:' || local_uid,0));
    if exists(select 1 from public.users where id=local_uid) or exists(select 1 from public.persons where id=local_uid)
      or exists(select 1 from seed.identity_bindings where uid=local_uid)
      then raise exception 'Identity binding conflict' using errcode='LS010'; end if;
  else return null;
  end if;
  insert into seed.identity_bindings(issuer,subject,uid,binding_kind) values(verified_issuer,verified_subject,local_uid,
    case when explicit_uid is null then 'enrolled' else 'explicit' end);
  return local_uid;
end;
$$;
revoke all on function seed.resolve_identity(text,text,text,boolean,text) from public;
