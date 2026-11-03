-- THE FACE OF THE NODE (ring 2026-11-03): the soil's half of what the origin serves from four
-- Cloud Functions behind hosting rewrites (functions/src/preview.ts — beingPreview, facePreview,
-- sitemap, faceEvents). The being card and the sitemap read as a STRANGER reads: the runtime role
-- with no session, under the same row policies every anonymous API read obeys, and the origin's
-- card gate on top in the law (domain/facePage). Only the face feed needs a door of its own: a
-- visitor standing at a face IS at the node, so the node's own gatherings greet them — a reading
-- the row policies refuse to a stranger by design (the 2026-08-24 tightening). None of this
-- travels; none of it is a being.

-- The finding aids the card needs: a Light House by its true name (the others came in 049), and
-- a face's gatherings by the ground they stand on.
create index light_houses_lid_lookup on public.light_houses((doc->>'lid')) where length(doc->>'lid')=36;
create index pulses_face_events on public.pulses((doc->>'domain')) where doc->>'type'='event';

-- The face feed: the cradle at a domain (the community rooted there, else one answering at that
-- door), and its domain-stamped gatherings a visitor at the face may see — public and node, never
-- narrower, never an addressed reach — newest first, two hundred at most. The law (domain/faceEvents
-- faceFeedOf) is the last gate in the API: it keeps only events wearing a feed-visible cloak and
-- shapes them to the seven feed fields, so nothing else in a pulse ever leaves.
create function seed.face_events(host text) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare home text; found_cradle boolean; gatherings jsonb;
begin
  if host is null or length(host) not between 4 and 253 or host !~ '^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$' then
    raise exception 'Invalid domain' using errcode='22023'; end if;
  select c.doc->>'domain', true into home, found_cradle from public.communities c
    where c.doc->>'domain'=host or (jsonb_typeof(c.doc->'domainAliases')='array' and c.doc->'domainAliases' @> to_jsonb(host))
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
revoke all on function seed.face_events(text) from public;
