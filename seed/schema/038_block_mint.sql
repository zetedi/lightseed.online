-- Facts for the trusted API's shared birth and Ed25519 checks. All authority and
-- head rows remain locked until the append and its side effects commit together.
create function seed.block_context(bearer_kind text,bearer_id text,is_watering boolean) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); bearer jsonb; person jsonb; profile jsonb; carer boolean:=false; staff boolean:=false;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if bearer_kind is null or bearer_kind not in ('tree','vision') or bearer_id is null or length(bearer_id) not between 1 and 512
    or bearer_id ~ '[[:cntrl:]]' or is_watering is null then raise exception 'Invalid bearer' using errcode='22023'; end if;
  select doc into profile from public.users where id=actor for share;
  select doc into person from public.persons where id=actor for update;
  if bearer_kind='tree' then select doc into bearer from public.lifetrees where id=bearer_id for update;
  else select doc into bearer from public.visions where id=bearer_id for update; end if;
  if bearer is null then raise exception 'Bearer missing' using errcode='LS033'; end if;
  perform 1 from public.admins where id=actor for share;
  perform 1 from public.config where id in ('superadmin','staffHands') order by id for share;
  if bearer_kind='vision' then carer:=coalesce(jsonb_typeof(bearer->'authorId')='string' and bearer->>'authorId'=actor,false);
  else
    perform 1 from public.links where from_id=actor and to_id=bearer_id and rel in ('keeper','steward') order by rel for share;
    perform 1 from public.secret_links where from_id=actor and to_id=bearer_id and rel='keeper' for share;
    carer:=coalesce(jsonb_typeof(bearer->'anchorUid')='string' and bearer->>'anchorUid'=actor,false)
      or exists(select 1 from public.links where from_id=actor and to_id=bearer_id and rel in ('keeper','steward'))
      or (coalesce(bearer->>'treeType'='SECRET',false) and exists(select 1 from public.secret_links where from_id=actor and to_id=bearer_id and rel='keeper'));
  end if;
  staff:=seed.is_staff() and (carer or not exists(select 1 from public.config where id='staffHands'
    and doc->(case when is_watering then 'tree_water' else 'tree_edit' end)='false'::jsonb));
  if not coalesce(carer,false) and not staff then raise exception 'Not a chain carer' using errcode='42501'; end if;
  return jsonb_build_object('bearer',bearer,'person',person,'profile',profile,'carer',coalesce(carer,false),'isStaff',staff);
end;
$$;
revoke all on function seed.block_context(text,text,boolean) from public;

-- Only the API role receives this capability. It supplies a record already judged,
-- verified and sealed by shared domain code, never an unverified browser record.
create function seed.apply_block(bearer_kind text,bearer_id text,record jsonb,patch jsonb,next_height bigint) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare context jsonb; bearer jsonb; updated jsonb; item record; head text; current_height numeric;
begin
  context:=seed.block_context(bearer_kind,bearer_id,coalesce(record->>'care'='watering',false));bearer:=context->'bearer';
  head:=coalesce(nullif(bearer->>'latestHash',''),nullif(bearer->>'genesisHash',''),'0');
  begin current_height:=coalesce((bearer->>'blockHeight')::numeric,0);
  exception when others then raise exception 'Invalid chain height' using errcode='22023'; end;
  if record->>'previousHash' is distinct from head or next_height is null or next_height<>current_height+1
    or next_height not between 1 and 9007199254740991 then raise exception 'Chain head moved' using errcode='LS032'; end if;
  if jsonb_typeof(record) is distinct from 'object' or jsonb_typeof(patch) is distinct from 'object'
    or record->>'authorId' is distinct from seed.uid()
    or coalesce(record->>'id','') !~ '^[A-Za-z0-9_-]{1,128}$'
    or coalesce(record->>'lid','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or coalesce(record->>'hash','') !~ '^[a-f0-9]{64}$' or record->>'hashVersion' is distinct from 'lifeseed.block.v1'
    or record->>(case when bearer_kind='tree' then 'lifetreeId' else 'visionId' end) is distinct from bearer_id
    or exists(select 1 from jsonb_object_keys(patch) k where k not in ('latestGrowthUrl','lastCaredAt','watering.lastWateredAt',
      'watering.lastWateredBy','watering.lastWateredByName','watering.overdue','watering.nextDueAt'))
    or (bearer_kind='vision' and patch<>'{}'::jsonb) then raise exception 'Invalid block record' using errcode='22023'; end if;
  updated:=bearer || jsonb_build_object('latestHash',record->>'hash','blockHeight',next_height);
  for item in select key,value from jsonb_each(patch) loop
    if item.key like 'watering.%' then
      if jsonb_typeof(updated->'watering') is distinct from 'object' then updated:=jsonb_set(updated,'{watering}','{}'); end if;
      updated:=jsonb_set(updated,array['watering',substring(item.key from 10)],item.value,true);
    else updated:=jsonb_set(updated,array[item.key],item.value,true); end if;
  end loop;
  insert into public.pulses(id,doc) values(record->>'id',record);
  if bearer_kind='tree' then update public.lifetrees set doc=updated where id=bearer_id;
  else update public.visions set doc=updated where id=bearer_id; end if;
  return jsonb_build_object('pulseId',record->>'id','hash',record->>'hash','blockHeight',next_height);
end;
$$;
revoke all on function seed.apply_block(text,text,jsonb,jsonb,bigint) from public;
