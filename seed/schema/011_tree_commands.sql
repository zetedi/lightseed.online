create function seed.can_edit_tree(tree_id text, tree jsonb) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select seed.uid() is not null and coalesce(seed.can_read_tree(tree_id,tree),false) and (
    tree->>'anchorUid'=seed.uid() or exists(select 1 from public.links where from_id=seed.uid() and rel in ('keeper','steward') and to_id=tree_id)
    or (tree->>'treeType'='SECRET' and exists(select 1 from public.secret_links where from_id=seed.uid() and rel='keeper' and to_id=tree_id))
    or (seed.is_staff() and not exists(select 1 from public.config where id='staffHands' and doc->'tree_edit'='false'::jsonb)));
$$;
revoke all on function seed.can_edit_tree(text,jsonb) from public;

-- Atomic birth: quota, tree, Root Vision (only a lifetree), and the guarded-tree
-- follow either all commit or all roll back. There is no asynchronous uprooting.
create function seed.tree_command(command jsonb, tree_lid text, vision_lid text, link_lid text, node_domain text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); action text:=command->>'action'; kind text:=command->>'treeType';
  target text:=command->>'id'; tree jsonb; person jsonb; cap numeric; configured text; countable bigint;
  moment bigint:=floor(extract(epoch from clock_timestamp())*1000); preimage text; genesis text; vision_genesis text; view_level text:=command->>'visibility';
  privacy boolean; can_edit boolean;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if jsonb_typeof(command) is distinct from 'object' or coalesce(action,'') not in ('plant','edit')
    or octet_length(command::text)>262144
    or exists(select 1 from jsonb_object_keys(command) k where k not in ('action','id','name','body','treeType','visibility','latitude','longitude','locationName'))
    or jsonb_typeof(command->'name') is distinct from 'string' or length(command->>'name') not between 1 and 120
    or command->>'name' ~ '[[:cntrl:]]' or btrim(command->>'name')=''
    or jsonb_typeof(command->'body') is distinct from 'string' or length(command->>'body')>64000
    then raise exception 'Invalid tree' using errcode='22023'; end if;
  if (command ? 'latitude')<>(command ? 'longitude') then raise exception 'Invalid place' using errcode='22023'; end if;
  if command ? 'latitude' and not (action='edit' and command->'latitude'='null'::jsonb and command->'longitude'='null'::jsonb) then
    if jsonb_typeof(command->'latitude') is distinct from 'number' or jsonb_typeof(command->'longitude') is distinct from 'number'
      then raise exception 'Invalid place' using errcode='22023'; end if;
    if (command->>'latitude')::numeric not between -90 and 90 or (command->>'longitude')::numeric not between -180 and 180
      then raise exception 'Invalid place' using errcode='22023'; end if;
  end if;
  if command ? 'locationName' and (jsonb_typeof(command->'locationName') is distinct from 'string'
    or length(command->>'locationName')>240 or command->>'locationName' ~ '[[:cntrl:]]') then raise exception 'Invalid place' using errcode='22023'; end if;
  if action='edit' then
    if command ? 'treeType' or command ? 'visibility' or target is null then raise exception 'Invalid tree' using errcode='22023'; end if;
    select doc into tree from public.lifetrees where id=target for update;
    -- Hidden and missing targets return the same refusal.
    if not found or not coalesce(seed.can_read_tree(target,tree),false) then raise exception 'Tree missing' using errcode='LS014'; end if;
    can_edit:=seed.can_edit_tree(target,tree);
    if not coalesce(can_edit,false) then raise exception 'Forbidden' using errcode='42501'; end if;
    tree:=tree || (command-'action'-'id') || jsonb_build_object('updatedAt',now());
    if command->'latitude'='null'::jsonb and command->'longitude'='null'::jsonb then
      tree:=tree-'latitude'-'longitude'-'locationName';
    end if;
    update public.lifetrees set doc=tree where id=target;
    return jsonb_build_object('tree',tree || jsonb_build_object('id',target));
  end if;
  if command ? 'id' or coalesce(kind,'') not in ('LIFETREE','GUARDED','SECRET')
    or coalesce(view_level,'') not in ('public','node','private') or (kind='SECRET' and view_level<>'private')
    or tree_lid=vision_lid or tree_lid=link_lid or vision_lid=link_lid
    or node_domain is null or node_domain='' or tree_lid is null or vision_lid is null or link_lid is null
    or exists(select 1 from unnest(array[tree_lid,vision_lid,link_lid]) v where v !~
      '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
    then raise exception 'Invalid tree' using errcode='22023'; end if;
  select doc into person from public.persons where id=actor;
  if person is null or person->>'uid' is distinct from actor or coalesce(person->>'lid','') !~
    '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then raise exception 'Profile required' using errcode='LS001'; end if;
  perform pg_advisory_xact_lock(hashtextextended('tree:plant:' || actor,0));
  cap:=case kind when 'SECRET' then 12 when 'GUARDED' then 132 else 193 end;
  if kind<>'SECRET' then
    select doc->>(case kind when 'GUARDED' then 'maxGuardedTrees' else 'maxLifetrees' end) into configured from public.config where id='limits';
    if configured ~ '^[0-9]+(\.[0-9]+)?$' then if configured::numeric>=1 then cap:=floor(configured::numeric); end if; end if;
  end if;
  select count(*) into countable from public.lifetrees where doc->>'anchorUid'=actor and
    (case when doc->>'treeType' in ('SECRET','BED') then doc->>'treeType'
      when doc->>'treeType'='GUARDED' or (nullif(doc->>'treeType','') is null and doc->>'isNature'='true') then 'GUARDED'
      else 'LIFETREE' end)=kind;
  if not seed.is_staff() and countable>=cap then raise exception 'Tree limit reached' using errcode='LS015'; end if;
  select doc->'onlyValidatedCanReach'='true'::jsonb into privacy from public.users where id=actor;
  -- The established v0 genesis preimage is preserved verbatim, including key order,
  -- so it can be rechecked after JSONB serialization or export/import.
  preimage:='{"msg":"Birth","lid":"' || tree_lid || '"}0' || moment::text;
  genesis:=encode(public.digest(convert_to(preimage,'UTF8'),'sha256'),'hex');
  tree:=(command-'action') || jsonb_build_object('lid',tree_lid,'anchorUid',actor,'domain',node_domain,
    'createdAt',to_timestamp(moment/1000.0),'updatedAt',now(),'genesisHash',genesis,'latestHash',genesis,'blockHeight',0,
    'genesisPreimage',preimage,'genesisAtMs',moment,'validated',false,'validatorId',null,'status','HEALTHY',
    'isNature',kind='GUARDED','onlyValidatedCanReach',coalesce(privacy,false));
  insert into public.lifetrees(id,doc) values(tree_lid,tree);
  if kind='LIFETREE' then
    preimage:='{"msg":"Birth","lid":"' || vision_lid || '"}0' || moment::text;
    vision_genesis:=encode(public.digest(convert_to(preimage,'UTF8'),'sha256'),'hex');
    insert into public.visions(id,doc) values(vision_lid,jsonb_build_object('lid',vision_lid,'lifetreeId',tree_lid,
      'authorId',actor,'title','Root Vision','body',command->>'body','domain',node_domain,'visibility',view_level,
      'createdAt',to_timestamp(moment/1000.0),'genesisHash',vision_genesis,'latestHash',vision_genesis,'blockHeight',0,
      'genesisPreimage',preimage,'genesisAtMs',moment));
  elsif kind='GUARDED' then
    insert into public.links(from_id,rel,to_id,lid) values(actor,'guardian',tree_lid,link_lid);
  end if;
  return jsonb_build_object('tree',tree || jsonb_build_object('id',tree_lid));
end;
$$;
revoke all on function seed.tree_command(jsonb,text,text,text,text) from public;
