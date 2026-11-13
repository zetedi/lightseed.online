-- WHO WEARS A HOST (ring 2026-11-03, the review's mending): a community wears a host — its front door, the
-- voice of its mail, its face feed — only by an alias the steward granted (seed.door_open writes
-- domainAliases, frozen to every other hand) or by its own domain VERIFIED by DNS (seed.domain_verified
-- writes domainVerification.domain, frozen likewise). A domain merely written into the record wears
-- nothing: seed.community_command lets any keeper edit `domain`, and until this ring the oldest community
-- claiming a host by that field wore the host's front door, mail voice and feed. The three doors that
-- answered "by domain or alias" now answer by this one predicate; the verified cradle is preferred.
create function seed.wears_host(doc jsonb, host text) returns boolean
language sql immutable set search_path=pg_catalog as $$
  select host is not null and host<>'' and (
    (jsonb_typeof(doc->'domainAliases')='array' and doc->'domainAliases' @> to_jsonb(host))
    or (doc->>'domain'=host and doc->'domainVerification'->>'domain'=host));
$$;
revoke all on function seed.wears_host(jsonb,text) from public;

create or replace function seed.mail_place(door text) returns jsonb language sql stable security definer set search_path=pg_catalog as $$
  select jsonb_build_object('name',c.doc->'name','domain',c.doc->'domain','theme',c.doc->'theme','mail',c.doc->'mail')
  from public.communities c where seed.wears_host(c.doc,door)
  order by (c.doc->>'domain'=door) desc nulls last, seed.vision_moment(c.doc),c.id limit 1;
$$;

create or replace function seed.face_events(host text) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare home text; found_cradle boolean; gatherings jsonb;
begin
  if host is null or length(host) not between 4 and 253 or host !~ '^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$' then
    raise exception 'Invalid domain' using errcode='22023'; end if;
  select c.doc->>'domain', true into home, found_cradle from public.communities c
    where seed.wears_host(c.doc,host)
    order by (c.doc->>'domain'=host) desc nulls last, seed.vision_moment(c.doc), c.id limit 1;
  if found_cradle is not true then return null; end if;
  home:=coalesce(nullif(home,''),host);
  select coalesce(jsonb_agg(p.doc order by seed.vision_moment(p.doc) desc, p.id),'[]'::jsonb) into gatherings from (
    select doc, id from public.pulses
      where doc->>'domain'=home and doc->>'type'='event' and not seed.pulse_addressed(doc)
        and coalesce(doc->>'visibility','') in ('','public','node')
      order by seed.vision_moment(doc) desc, id limit 200) p;
  return jsonb_build_object('domain',home,'events',gatherings);
end;
$$;
