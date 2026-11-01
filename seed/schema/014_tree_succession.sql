-- A tree's anchor and canonical keeper seats are peers; staff status is not a seat.
create function seed.is_tree_keeper(tree_id text, tree jsonb) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select seed.uid() is not null and coalesce(tree->>'anchorUid'=seed.uid()
    or exists(select 1 from public.links where from_id=seed.uid() and rel='keeper' and to_id=tree_id)
    or (tree->>'treeType'='SECRET' and exists(select 1 from public.secret_links where from_id=seed.uid() and rel='keeper' and to_id=tree_id)),false);
$$;
revoke all on function seed.is_tree_keeper(text,jsonb) from public;
create function seed.tree_resign(command jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); target text:=command->>'id'; tree jsonb; successor text; private_circle boolean;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if jsonb_typeof(command) is distinct from 'object' or command->>'action' is distinct from 'resign_keeper'
    or jsonb_typeof(command->'id') is distinct from 'string' or length(target) not between 1 and 512 or target ~ '[[:space:][:cntrl:]]'
    or exists(select 1 from jsonb_object_keys(command) k where k not in ('action','id')) then
    raise exception 'Invalid command' using errcode='22023'; end if;
  select doc into tree from public.lifetrees where id=target for update;
  if not found or not coalesce(seed.can_read_tree(target,tree),false) then raise exception 'Tree missing' using errcode='LS014'; end if;
  if coalesce(tree->>'anchorUid','')='' then raise exception 'Tree identity needs review' using errcode='LS012'; end if;
  if not seed.is_tree_keeper(target,tree) then raise exception 'Forbidden' using errcode='42501'; end if;
  private_circle:=tree->>'treeType'='SECRET';
  if tree->>'anchorUid'=actor then
    select from_id into successor from (
      select from_id,created_at from public.links where rel='keeper' and to_id=target and from_id<>actor
      union all
      select from_id,created_at from public.secret_links where private_circle and rel='keeper' and to_id=target and from_id<>actor
    ) seats group by from_id order by min(created_at),from_id collate "C" limit 1;
    if successor is null then raise exception 'Last keeper' using errcode='LS011'; end if;
    if length(successor) not between 1 and 128 or successor ~ '[[:space:][:cntrl:]]' then
      raise exception 'Tree identity needs review' using errcode='LS012'; end if;
    tree:=tree || jsonb_build_object('anchorUid',successor,'updatedAt',now());
    update public.lifetrees set doc=tree where id=target;
  end if;
  -- A secret tree can contain legacy public seats as well as private ones. Remove
  -- every departing/promoted duplicate, but never turn those seats into public data.
  delete from public.links where rel='keeper' and to_id=target and (from_id=actor or from_id=successor);
  if private_circle then
    delete from public.secret_links where rel='keeper' and to_id=target and (from_id=actor or from_id=successor);
  end if;
  return jsonb_build_object('id',target,'resigned',actor,'successor',successor);
end;
$$;
revoke all on function seed.tree_resign(jsonb) from public;

-- Keeper departure goes through the locked succession command, never generic deletion.
drop policy links_own_withdraw on public.links;
create policy links_own_withdraw on public.links for delete using (
  seed.uid() is not null and from_id=seed.uid()
  and rel not in ('keeper','invited_by','welcomed_by','party','collaborates_with',
    'recognises','shares_resources_with','accepts_coin_of','descends_from')
  and not (rel in ('member','steward') and exists(select 1 from public.communities c where c.id=to_id))
);
