create function seed.can_form_circle(community_id text, community jsonb) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select seed.uid() is not null and community->>'formation'='tree_keeping'
    and (not (community ? 'formedAt') or community->'formedAt'='null'::jsonb)
    and exists(select 1 from public.lifetrees t where t.id=community->>'rootLifetreeId'
      and t.doc->>'treeType' is distinct from 'SECRET' and (
        community->>'anchorUid'=seed.uid()
        or exists(select 1 from public.links where from_id=seed.uid() and rel='keeper' and to_id=community_id)
        or seed.is_tree_keeper(t.id,t.doc)));
$$;
revoke all on function seed.can_form_circle(text,jsonb) from public;
create function seed.form_circle(command jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); target text:=command->>'id'; root_id text; tree jsonb; community jsonb;
  chosen_name text:=command->>'name'; birthplace text;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if jsonb_typeof(command) is distinct from 'object' or command->>'action' is distinct from 'form_circle'
    or jsonb_typeof(command->'id') is distinct from 'string' or length(target) not between 1 and 128 or target ~ '[[:space:][:cntrl:]]'
    or exists(select 1 from jsonb_object_keys(command) k where k not in ('action','id','name'))
    or (command ? 'name' and (jsonb_typeof(command->'name') is distinct from 'string' or length(chosen_name)>120 or chosen_name ~ '[[:cntrl:]]'))
    then raise exception 'Invalid command' using errcode='22023'; end if;
  select doc->>'rootLifetreeId' into root_id from public.communities where id=target;
  if not found then raise exception 'Community missing' using errcode='LS003'; end if;
  -- Same tree-before-circle order as invitation admission; recheck the binding after locking.
  select doc into tree from public.lifetrees where id=root_id for share;
  select doc into community from public.communities where id=target for update;
  if not found then raise exception 'Community missing' using errcode='LS003'; end if;
  if community->>'formation' is distinct from 'tree_keeping' then raise exception 'Not a tree circle' using errcode='LS022'; end if;
  if community ? 'formedAt' and community->'formedAt'<>'null'::jsonb then raise exception 'Already formed' using errcode='LS023'; end if;
  if tree is null or tree->>'treeType'='SECRET' or community->>'rootLifetreeId' is distinct from root_id then
    raise exception 'Circle identity needs review' using errcode='LS012'; end if;
  if not coalesce(seed.can_form_circle(target,community),false) then raise exception 'Forbidden' using errcode='42501'; end if;
  birthplace:=regexp_replace(lower(btrim(coalesce(tree->>'domain',''))),'^https?://','');
  birthplace:=regexp_replace(birthplace,'[/?#].*$','');
  birthplace:=regexp_replace(regexp_replace(birthplace,'^www\.',''),':[0-9]+$','');
  chosen_name:=coalesce(nullif(btrim(chosen_name),''),community->>'name');
  community:=community || jsonb_build_object('name',chosen_name,'visibility','public','formedAt',now(),'formedBy',actor,'updatedAt',now());
  if birthplace<>'' then community:=community || jsonb_build_object('bornOn',birthplace); end if;
  update public.communities set doc=community where id=target;
  return jsonb_build_object('communityId',target,'name',chosen_name,'bornOn',nullif(birthplace,''));
end;
$$;
revoke all on function seed.form_circle(jsonb) from public;
