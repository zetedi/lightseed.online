-- Finding aids over authoritative records, not a second identity registry.
-- Non-unique indexes allow existing/imported disagreements to remain reviewable.
-- Bound index keys so malformed imported names cannot break installation or writes.
create index lifetrees_lid_lookup on public.lifetrees ((doc->>'lid')) where length(doc->>'lid')=36;
create index visions_lid_lookup on public.visions ((doc->>'lid')) where length(doc->>'lid')=36;
create index communities_lid_lookup on public.communities ((doc->>'lid')) where length(doc->>'lid')=36;
create index pulses_lid_lookup on public.pulses ((doc->>'lid')) where length(doc->>'lid')=36;
-- Persons retain their existing unique LID index and identity constraint.

-- People already have a public identity/name projection. Expose only its local
-- address here, never private users or the remainder of the person document.
create function seed.person_lid_candidates(portable_id text) returns table(id text)
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
  if portable_id is null or portable_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'Invalid portable identity' using errcode='22023'; end if;
  return query select p.id from public.persons p where p.doc->>'lid'=portable_id and p.doc ? 'lid' limit 2;
end;
$$;
revoke all on function seed.person_lid_candidates(text) from public;
