-- A VISION IS GONE: ITS GROUNDS END WITH IT (ring 2026-11-18; src/domain/grounding.ts; the origin's
-- functions/src/grounding.ts onVisionDeleted of the same day). Releasing a vision (030) removed
-- the links pointing AT it and left those leading FROM it, so a released vision kept a place among
-- a tree's twelve and showed there as a being no one could name. Now the release ends them: every
-- `grounded_in` link from the vision is removed with ONE sealed block on the tree's chain (the
-- vision has no chain left to write on), and every knock is withdrawn. The pattern is 064's:
-- facts under locks, the shared law's blocks sealed by the API (seed/api/grounding.mjs), an apply
-- that re-proves each record against the chain it lands on — all in the ONE transaction that then
-- releases the vision (seed.vision_release), so a ground never ends for a vision that stays.

create function seed.vision_grounds_context(vision_id text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); vision jsonb; profile jsonb;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if not seed.ground_id_ok(vision_id) then raise exception 'Invalid ground' using errcode='22023'; end if;
  select doc into profile from public.users where id=actor for share;
  -- trees, then the vision: the order every paired operation takes (seed.ground_context)
  perform 1 from public.lifetrees t where t.id in (select to_id from public.links where from_id=vision_id and rel='grounded_in') order by t.id collate "C" for update;
  select doc into vision from public.visions where id=vision_id for update;
  perform 1 from public.links where from_id=vision_id and rel in ('grounded_in','ground_request') order by id collate "C" for update;
  return jsonb_build_object('vision',vision,'profile',profile,
    'grounds',coalesce((select jsonb_agg(jsonb_build_object('treeId',l.to_id,'self',coalesce(l.doc->'self','false'::jsonb),'tree',t.doc) order by l.to_id collate "C")
      from public.links l left join public.lifetrees t on t.id=l.to_id where l.from_id=vision_id and l.rel='grounded_in'),'[]'::jsonb));
end;
$$;
revoke all on function seed.vision_grounds_context(text) from public;

-- `records` is [{treeId, record, height}], one for every standing ground whose tree still exists.
-- Only the hand that may release the vision (its author, or staff) ends its grounds.
create function seed.apply_vision_grounds_end(vision_id text, records jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); vision jsonb; ground record; tree jsonb; entry jsonb; ended bigint:=0;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if not seed.ground_id_ok(vision_id) or jsonb_typeof(records) is distinct from 'array' then raise exception 'Invalid ground' using errcode='22023'; end if;
  select doc into vision from public.visions where id=vision_id for update;
  -- the release's own answers, in its order (030): a vision this hand cannot see is missing
  if vision is null or not coalesce(seed.can_read_vision(vision),false) then raise exception 'Vision missing' using errcode='LS025'; end if;
  if not seed.is_staff() and (jsonb_typeof(vision->'authorId') is distinct from 'string' or vision->>'authorId' is distinct from actor) then
    raise exception 'Forbidden' using errcode='42501'; end if;
  for ground in select to_id from public.links where from_id=vision_id and rel='grounded_in' order by to_id collate "C" loop
    select doc into tree from public.lifetrees where id=ground.to_id for update;
    if found then
      select value into entry from jsonb_array_elements(records) where value->>'treeId'=ground.to_id limit 1;
      if entry is null or jsonb_typeof(entry->'height') is distinct from 'number' then raise exception 'Invalid ground record' using errcode='22023'; end if;
      perform seed.ground_record_check(entry->'record',tree,'tree',ground.to_id,vision_id,'released',(entry->>'height')::bigint,actor);
      insert into public.pulses(id,doc) values(entry->'record'->>'id',entry->'record');
      update public.lifetrees set doc=doc || jsonb_build_object('latestHash',entry->'record'->>'hash','blockHeight',(entry->>'height')::bigint) where id=ground.to_id;
    end if;
    ended:=ended+1;
  end loop;
  delete from public.links where from_id=vision_id and rel in ('grounded_in','ground_request');
  return jsonb_build_object('ended',ended);
end;
$$;
revoke all on function seed.apply_vision_grounds_end(text,jsonb) from public;
