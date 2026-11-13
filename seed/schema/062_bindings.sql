-- THE BINDING CEREMONY (ring 2026-11-03): the installation's reviewed bindings (the auth trust file:
-- issuer subject → local uid) become durable rows when the API boots, not only when each person's first
-- token arrives (seed.resolve_identity) — so a crossing may land a person before they have spoken here
-- (domain/bundleMerge: loginBound reads the explicit rows), and the ceremony before a crossing is: name
-- each person's subject in the trust file, restart, import. A row standing under another uid is never
-- relinked: the durable record wins, the conflict is reported, and that subject's tokens are refused as
-- before (LS010). A self-enrolled login the file now names is affirmed as explicit — the installation
-- vouches for it from here on, with the explicit kind's own rule (removal revokes). Validation as the
-- resolver's; the same advisory lock, so a boot and a first token never race on one subject.
create function seed.bind_explicit(verified_issuer text, bindings jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare item jsonb; subject_value text; uid_value text; standing_uid text; standing_kind text;
  bound integer:=0; standing integer:=0; conflicts jsonb:='[]'::jsonb;
begin
  if verified_issuer is null or length(verified_issuer) not between 1 and 512 or verified_issuer !~ '^https://'
    or verified_issuer ~ '[[:space:][:cntrl:]]' or jsonb_typeof(bindings) is distinct from 'array' or jsonb_array_length(bindings)>10000
    then raise exception 'Invalid identity' using errcode='22023'; end if;
  for item in select value from jsonb_array_elements(bindings) loop
    subject_value:=item->>'subject'; uid_value:=item->>'uid';
    if subject_value is null or uid_value is null or length(subject_value) not between 1 and 512 or length(uid_value) not between 1 and 128
      or subject_value ~ '[[:space:][:cntrl:]]' or uid_value ~ '[[:space:][:cntrl:]]' then raise exception 'Invalid identity' using errcode='22023'; end if;
    perform pg_advisory_xact_lock(hashtextextended('issuer:' || length(verified_issuer)::text || ':' || verified_issuer || subject_value,0));
    select uid,binding_kind into standing_uid,standing_kind from seed.identity_bindings where issuer=verified_issuer and subject=subject_value;
    if found then
      if standing_uid=uid_value then
        if standing_kind='enrolled' then update seed.identity_bindings set binding_kind='explicit' where issuer=verified_issuer and subject=subject_value; end if;
        standing:=standing+1;
      else conflicts:=conflicts||jsonb_build_object('subject',subject_value,'uid',uid_value,'bound',standing_uid); end if;
    else
      insert into seed.identity_bindings(issuer,subject,uid,binding_kind) values(verified_issuer,subject_value,uid_value,'explicit');
      bound:=bound+1;
    end if;
  end loop;
  return jsonb_build_object('bound',bound,'standing',standing,'conflicts',conflicts);
end;
$$;
revoke all on function seed.bind_explicit(text,jsonb) from public;
