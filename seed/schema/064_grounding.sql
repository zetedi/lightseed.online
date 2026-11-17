-- THE GROUND (ring 2026-11-17; src/domain/grounding.ts). A vision stands on its own; grounding is a
-- consented link between a vision and a tree: the vision's author knocks (links.rel
-- 'ground_request'), a keeper or steward of the tree says yes, and the yes is the link
-- 'grounded_in' plus one block on each chain. Either side lets go alone, and the letting go is a
-- second pair of blocks. The origin keeps these hands in functions/src/grounding.ts; here they
-- follow the one pattern of 044: FACTS under locks (seed.ground_context), the PURE LAW asked by
-- the API from the shared domain bundle (seed/api/grounding.mjs), and what the law allowed APPLIED
-- (seed.apply_*), every apply re-proving the invariants the soil must never lose whatever the
-- API believed: both consents, a living non-secret non-bed tree, neither being private, the tree
-- seen at least as far as the vision, both caps, both heads unmoved, both records in shape.
-- No row policy lets the runtime role write either rel, and seed.link_command names neither.

-- How far a being is seen: absent is the legacy 'public'; an unknown word is hidden.
create function seed.ground_reach(being jsonb) returns integer language sql immutable set search_path=pg_catalog as $$
  select case when being is null then 0 when not (being ? 'visibility') or being->'visibility'='null'::jsonb or being->>'visibility'='public' then 2
    when being->>'visibility'='node' then 1 else 0 end;
$$;
revoke all on function seed.ground_reach(jsonb) from public;

create function seed.ground_id_ok(value text) returns boolean language sql immutable set search_path=pg_catalog as $$
  select value is not null and length(value) between 1 and 512 and value !~ '[[:cntrl:]/]' and position('__' in value)=0;
$$;
revoke all on function seed.ground_id_ok(text) from public;

-- FACTS, under locks. Both beings are locked first (trees, then visions — the order every paired
-- operation takes), so every ground act on the same vision or the same tree is serialised and the
-- counts below cannot be overtaken. Returned to the API alone; nothing here reaches a client.
create function seed.ground_context(vision_id text, tree_id text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); tree jsonb; vision jsonb; profile jsonb; ask jsonb; ground jsonb; cares boolean;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if not seed.ground_id_ok(vision_id) or not seed.ground_id_ok(tree_id) then raise exception 'Invalid ground' using errcode='22023'; end if;
  select doc into profile from public.users where id=actor for share;
  select doc into tree from public.lifetrees where id=tree_id for update;
  select doc into vision from public.visions where id=vision_id for update;
  perform 1 from public.links where (from_id=vision_id and rel in ('grounded_in','ground_request'))
    or (to_id=tree_id and rel in ('grounded_in','ground_request','keeper','steward')) order by id collate "C" for update;
  select doc into ask from public.links where from_id=vision_id and rel='ground_request' and to_id=tree_id;
  select doc into ground from public.links where from_id=vision_id and rel='grounded_in' and to_id=tree_id;
  cares:=tree is not null and (coalesce(jsonb_typeof(tree->'anchorUid')='string' and tree->>'anchorUid'=actor,false)
    or exists(select 1 from public.links where from_id=actor and to_id=tree_id and rel in ('keeper','steward')));
  return jsonb_build_object('vision',vision,'tree',tree,'profile',profile,'cares',cares,'ask',ask,'ground',ground,
    'visionGrounds',(select count(*) from public.links where from_id=vision_id and rel='grounded_in'),
    'visionAsks',(select count(*) from public.links where from_id=vision_id and rel='ground_request'),
    'treeGrounds',(select count(*) from public.links where to_id=tree_id and rel='grounded_in'));
end;
$$;
revoke all on function seed.ground_context(text,text) from public;

-- MAY THIS TREE GROUND THIS VISION — the soil's own copy of domain/grounding groundRefusal, so an
-- apply can never store what the law forbids even if the API were wrong.
create function seed.ground_lawful(tree jsonb, vision jsonb) returns boolean language sql immutable set search_path=pg_catalog as $$
  select tree is not null and vision is not null
    and coalesce(tree->>'treeType','LIFETREE') not in ('SECRET','BED')
    and (not (tree ? 'diedAt') or tree->'diedAt'='null'::jsonb)
    and seed.ground_reach(vision)>=1 and seed.ground_reach(tree)>=seed.ground_reach(vision);
$$;
revoke all on function seed.ground_lawful(jsonb,jsonb) from public;

-- One block of a ground act, checked against the chain it lands on.
create function seed.ground_record_check(record jsonb, bearer jsonb, bearer_kind text, bearer_id text, twin_id text, act text, height bigint, actor text) returns void
language plpgsql immutable set search_path=pg_catalog as $$
declare stored numeric;
begin
  begin stored:=coalesce((bearer->>'blockHeight')::numeric,0);
  exception when others then raise exception 'Invalid chain height' using errcode='22023'; end;
  if height is null or height<>stored+1 or height not between 1 and 9007199254740991
    or record->>'previousHash' is distinct from coalesce(nullif(bearer->>'latestHash',''),nullif(bearer->>'genesisHash',''),'0') then
    raise exception 'Chain head moved' using errcode='LS032'; end if;
  if jsonb_typeof(record) is distinct from 'object'
    or record->>'type' is distinct from (case when bearer_kind='tree' then 'standard' else 'vision_growth' end)
    or record->>'authorId' is distinct from actor or record->>'groundAct' is distinct from act
    or record->>'groundRole' is distinct from bearer_kind or record->>'groundTwinOf' is distinct from twin_id
    or record->>'groundTwinKind' is distinct from (case when bearer_kind='tree' then 'vision' else 'tree' end)
    or record->>(case when bearer_kind='tree' then 'lifetreeId' else 'visionId' end) is distinct from bearer_id
    or record ? (case when bearer_kind='tree' then 'visionId' else 'lifetreeId' end)
    or coalesce(record->>'visibility','') not in ('public','node','private')
    or coalesce(record->>'id','') !~ '^[A-Za-z0-9_-]{1,128}$'
    or coalesce(record->>'lid','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or coalesce(record->>'hash','') !~ '^[a-f0-9]{64}$' or record->>'hashVersion' is distinct from 'lifeseed.block.v1' then
    raise exception 'Invalid ground record' using errcode='22023'; end if;
end;
$$;
revoke all on function seed.ground_record_check(jsonb,jsonb,text,text,text,text,bigint,text) from public;

-- THE KNOCK: only the vision's author, once, at a tree that may ground it; grounds and standing
-- asks counted together against the twelve.
create function seed.apply_ground_ask(vision_id text, tree_id text, link_lid text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); context jsonb:=seed.ground_context(vision_id,tree_id); vision jsonb; tree jsonb;
begin
  vision:=context->'vision';tree:=context->'tree';
  if vision='null'::jsonb then vision:=null; end if; if tree='null'::jsonb then tree:=null; end if;
  if vision is null or tree is null or coalesce(vision->>'authorId','')<>actor or not seed.ground_lawful(tree,vision)
    or context->'ask'<>'null'::jsonb or context->'ground'<>'null'::jsonb
    or (context->>'visionGrounds')::bigint+(context->>'visionAsks')::bigint>=12 then
    raise exception 'Ground refused' using errcode='LS070'; end if;
  insert into public.links(from_id,rel,to_id,lid,doc) values(vision_id,'ground_request',tree_id,link_lid,jsonb_build_object('requestedBy',actor));
  return jsonb_build_object('asked',true);
end;
$$;
revoke all on function seed.apply_ground_ask(text,text,text) from public;

-- THE KNOCK LET GO: its author withdraws it, a carer of the tree declines it.
create function seed.ground_ask_drop(vision_id text, tree_id text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); context jsonb:=seed.ground_context(vision_id,tree_id);
begin
  if context->'ask'='null'::jsonb then raise exception 'Ground refused' using errcode='LS070'; end if;
  if not coalesce((context->>'cares')::boolean,false) and coalesce(context->'vision'->>'authorId','')<>actor
    and coalesce(context->'ask'->>'requestedBy','')<>actor then raise exception 'Not yours' using errcode='42501'; end if;
  delete from public.links where from_id=vision_id and rel='ground_request' and to_id=tree_id;
  return jsonb_build_object('dropped',true);
end;
$$;
revoke all on function seed.ground_ask_drop(text,text) from public;

-- THE YES: a carer of the tree, on a knock made by the one who is the vision's author NOW — or no
-- knock at all when the carer IS that author (a vision grown from one's own tree).
create function seed.apply_ground(vision_id text, tree_id text, tree_record jsonb, vision_record jsonb, tree_height bigint, vision_height bigint, link_lid text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); context jsonb:=seed.ground_context(vision_id,tree_id); vision jsonb; tree jsonb; ask jsonb; author text; own boolean;
begin
  vision:=context->'vision';tree:=context->'tree';ask:=context->'ask';
  if vision='null'::jsonb then vision:=null; end if; if tree='null'::jsonb then tree:=null; end if;
  author:=coalesce(vision->>'authorId','');own:=author<>'' and author=actor;
  if vision is null or tree is null or not coalesce((context->>'cares')::boolean,false) or not seed.ground_lawful(tree,vision)
    or (not own and (ask='null'::jsonb or author='' or coalesce(ask->>'requestedBy','')<>author))
    or context->'ground'<>'null'::jsonb
    or (context->>'visionGrounds')::bigint>=12 or (context->>'treeGrounds')::bigint>=12 then
    raise exception 'Ground refused' using errcode='LS070'; end if;
  if tree_record->>'id' is not distinct from vision_record->>'id' then raise exception 'Twin IDs must differ' using errcode='22023'; end if;
  perform seed.ground_record_check(tree_record,tree,'tree',tree_id,vision_id,'grounded',tree_height,actor);
  perform seed.ground_record_check(vision_record,vision,'vision',vision_id,tree_id,'grounded',vision_height,actor);
  insert into public.pulses(id,doc) values(tree_record->>'id',tree_record),(vision_record->>'id',vision_record);
  update public.lifetrees set doc=doc || jsonb_build_object('latestHash',tree_record->>'hash','blockHeight',tree_height) where id=tree_id;
  update public.visions set doc=doc || jsonb_build_object('latestHash',vision_record->>'hash','blockHeight',vision_height) where id=vision_id;
  insert into public.links(from_id,rel,to_id,lid,doc) values(vision_id,'grounded_in',tree_id,link_lid,
    jsonb_build_object('self',own,'birth',false,'requestedBy',author,'acceptedBy',actor,
      'groundedPulseIds',jsonb_build_object('tree',tree_record->>'id','vision',vision_record->>'id')));
  delete from public.links where from_id=vision_id and rel='ground_request' and to_id=tree_id;
  return jsonb_build_object('treePulseId',tree_record->>'id','visionPulseId',vision_record->>'id','self',own);
end;
$$;
revoke all on function seed.apply_ground(text,text,jsonb,jsonb,bigint,bigint,text) from public;

-- LETTING GO: the vision's author or a carer of the tree; one block on each chain that still
-- exists. When the vision is gone, the hand the ground remembers (requestedBy) stands for it.
create function seed.apply_ground_release(vision_id text, tree_id text, tree_record jsonb, vision_record jsonb, tree_height bigint, vision_height bigint) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); context jsonb:=seed.ground_context(vision_id,tree_id); vision jsonb; tree jsonb; ground jsonb; author text;
begin
  vision:=context->'vision';tree:=context->'tree';ground:=context->'ground';
  if vision='null'::jsonb then vision:=null; end if; if tree='null'::jsonb then tree:=null; end if;
  if ground='null'::jsonb then raise exception 'Ground refused' using errcode='LS070'; end if;
  author:=case when vision is not null then coalesce(vision->>'authorId','') else coalesce(ground->>'requestedBy','') end;
  if not coalesce((context->>'cares')::boolean,false) and (author='' or author<>actor) then raise exception 'Not yours' using errcode='42501'; end if;
  if (tree is null)<>(tree_record is null or tree_record='null'::jsonb) or (vision is null)<>(vision_record is null or vision_record='null'::jsonb) then
    raise exception 'Invalid ground record' using errcode='22023'; end if;
  if tree is not null then
    perform seed.ground_record_check(tree_record,tree,'tree',tree_id,vision_id,'released',tree_height,actor);
    insert into public.pulses(id,doc) values(tree_record->>'id',tree_record);
    update public.lifetrees set doc=doc || jsonb_build_object('latestHash',tree_record->>'hash','blockHeight',tree_height) where id=tree_id;
  end if;
  if vision is not null then
    perform seed.ground_record_check(vision_record,vision,'vision',vision_id,tree_id,'released',vision_height,actor);
    insert into public.pulses(id,doc) values(vision_record->>'id',vision_record);
    update public.visions set doc=doc || jsonb_build_object('latestHash',vision_record->>'hash','blockHeight',vision_height) where id=vision_id;
  end if;
  delete from public.links where from_id=vision_id and rel='grounded_in' and to_id=tree_id;
  return jsonb_build_object('treePulseId',tree_record->>'id','visionPulseId',vision_record->>'id');
end;
$$;
revoke all on function seed.apply_ground_release(text,text,jsonb,jsonb,bigint,bigint) from public;

-- A VISION IS NOT HANDED TO ANOTHER (the origin's rule of the same day): its author may not
-- rewrite `authorId` — that would put words, a chain and a ground's consent under a name that
-- never gave it. Staff keep the mend. The rest of the rule is 051's, unchanged.
create or replace function seed.rule_visions(action text, doc_id text, parent text, old_doc jsonb, new_doc jsonb, changed text[], moment timestamptz) returns boolean
language plpgsql stable security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); head text[]:=array['latestHash','blockHeight','genesisHash'];
begin
  case action
    when 'get','list' then return coalesce(seed.can_read_vision(old_doc),false);
    when 'create' then return actor is not null and (seed.is_staff() or new_doc->>'authorId'=actor)
      and (not (new_doc ? 'latestHash') or (new_doc->>'latestHash'=coalesce(new_doc->>'genesisHash','') and seed.doc_num(new_doc->'blockHeight',0)=0));
    when 'update' then return actor is not null and (old_doc->>'authorId'=actor or seed.is_staff())
      and not seed.changed_any(changed,array['lid','loveCount'])
      and (seed.is_staff() or not seed.changed_any(changed,array['authorId']))
      and (not seed.changed_any(changed,head) or (not (old_doc ? 'genesisHash')
        and coalesce(new_doc->>'latestHash','')=coalesce(new_doc->>'genesisHash','') and seed.doc_num(new_doc->'blockHeight',0)=0));
    when 'delete' then return actor is not null and (old_doc->>'authorId'=actor or seed.is_staff());
    else return false;
  end case;
end;
$$;

-- NO VISION IS BORN WITH A TREE ANY MORE (the origin's planting of the same day). 011's command
-- wrote a "Root Vision" beside every lifetree, tied by the `lifetreeId` field; a vision is now
-- grown from the tree afterwards and grounded there by a link. The function is 011's, whole,
-- without that one insert; `vision_lid` stays in the signature so no caller has to change.
create or replace function seed.tree_command(command jsonb, tree_lid text, vision_lid text, link_lid text, node_domain text) returns jsonb
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
  if kind='GUARDED' then
    insert into public.links(from_id,rel,to_id,lid) values(actor,'guardian',tree_lid,link_lid);
  end if;
  return jsonb_build_object('tree',tree || jsonb_build_object('id',tree_lid));
end;
$$;
