-- THE OLD TIE BECOMES A GROUND: the apply (ring 2026-11-18, step 4b; the keeper's three words).
-- The plan is the shared law's (src/domain/groundMigration.ts, read through 066); these two
-- functions carry out its two kinds of act, one row at a time, as the keeper, and each RE-PROVES
-- on the soil what the plan believed — so a plan read a moment too early can never store what the
-- law forbids.
--   LINKS ALONE: no block is written on either chain. These grounds were never asked and
--     answered; the link says so (`migrated`) and names no pair of blocks.
--   THE FIELD IS KEPT on a grounded vision, until every reader has moved to the link.
--   AN ORPHAN'S FIELD IS CLEARED: a vision naming a tree that is gone stands on its own.
-- Idempotent: a ground that stands, or a field that already changed, answers false.

-- One migrated ground. True when written; false when the soil no longer agrees with the plan.
create function seed.repair_vision_ground(vision_id text, tree_id text, birth boolean, link_lid text) returns boolean
language plpgsql security definer set search_path=pg_catalog as $$
declare tree jsonb; vision jsonb; author text;
begin
  perform seed.repair_gate();
  if not seed.ground_id_ok(vision_id) or not seed.ground_id_ok(tree_id) or birth is null
    or coalesce(link_lid,'') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'Invalid repair' using errcode='22023'; end if;
  -- The locks of seed.ground_context, in its order: the tree, the vision, then their links.
  select doc into tree from public.lifetrees where id=tree_id for update;
  select doc into vision from public.visions where id=vision_id for update;
  perform 1 from public.links where (from_id=vision_id and rel in ('grounded_in','ground_request'))
    or (to_id=tree_id and rel in ('grounded_in','ground_request','keeper','steward')) order by id collate "C" for update;
  author:=coalesce(vision->>'authorId','');
  if tree is null or vision is null or author='' or vision->>'lifetreeId' is distinct from tree_id
    or not seed.ground_lawful(tree,vision)
    -- the consent the law asks for: the author stands on both sides
    or not (coalesce(jsonb_typeof(tree->'anchorUid')='string' and tree->>'anchorUid'=author,false)
      or exists(select 1 from public.links where from_id=author and to_id=tree_id and rel in ('keeper','steward')))
    or exists(select 1 from public.links where from_id=vision_id and rel='grounded_in' and to_id=tree_id)
    or (select count(*) from public.links where from_id=vision_id and rel='grounded_in')>=12
    or (select count(*) from public.links where to_id=tree_id and rel='grounded_in')>=12
    -- a tree is born once: a birth ground only where none stands, and only for the anchor's own vision
    or (birth and (tree->>'anchorUid' is distinct from author
      or exists(select 1 from public.links where to_id=tree_id and rel='grounded_in' and doc->'birth'='true'::jsonb))) then
    return false; end if;
  insert into public.links(from_id,rel,to_id,lid,doc) values(vision_id,'grounded_in',tree_id,link_lid,
    jsonb_build_object('self',true,'birth',birth,'requestedBy',author,'acceptedBy',author,'migrated',true));
  -- the knock, if one was standing, is answered by the ground
  delete from public.links where from_id=vision_id and rel='ground_request' and to_id=tree_id;
  return true;
end;
$$;
revoke all on function seed.repair_vision_ground(text,text,boolean,text) from public;

-- One orphan set free: the field is cleared only while it still names that tree and the tree is
-- still gone. The vision's chain, words and author are untouched.
create function seed.repair_vision_ground_clear(vision_id text, tree_id text) returns boolean
language plpgsql security definer set search_path=pg_catalog as $$
begin
  perform seed.repair_gate();
  if not seed.ground_id_ok(vision_id) or not seed.ground_id_ok(tree_id) then raise exception 'Invalid repair' using errcode='22023'; end if;
  perform 1 from public.visions where id=vision_id for update;
  if exists(select 1 from public.lifetrees where id=tree_id) then return false; end if;
  update public.visions set doc=doc-'lifetreeId' where id=vision_id and doc->>'lifetreeId'=tree_id;
  return found;
end;
$$;
revoke all on function seed.repair_vision_ground_clear(text,text) from public;
