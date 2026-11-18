-- THE FIELD RETIRED (ring 2026-11-18, step 5). Every reader now finds a vision's tree through its
-- grounds, so the old `lifetreeId` on a vision says nothing the link does not. The plan is the
-- shared law's (src/domain/groundMigration.ts planFieldRetirement, over the facts of 066); this
-- function carries out one row as the keeper and re-proves it: the field is removed only while it
-- still names that tree AND the vision's ground in that tree stands. A vision whose field has no
-- such ground keeps it. Nothing else of the vision is touched. Idempotent.
create function seed.repair_vision_field_retire(vision_id text, tree_id text) returns boolean
language plpgsql security definer set search_path=pg_catalog as $$
begin
  perform seed.repair_gate();
  if not seed.ground_id_ok(vision_id) or not seed.ground_id_ok(tree_id) then raise exception 'Invalid repair' using errcode='22023'; end if;
  perform 1 from public.visions where id=vision_id for update;
  if not exists(select 1 from public.links where from_id=vision_id and rel='grounded_in' and to_id=tree_id) then return false; end if;
  update public.visions set doc=doc-'lifetreeId' where id=vision_id and doc->>'lifetreeId'=tree_id;
  return found;
end;
$$;
revoke all on function seed.repair_vision_field_retire(text,text) from public;
