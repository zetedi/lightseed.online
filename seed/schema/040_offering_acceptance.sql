-- Trusted API capability: facts are locked until the paired append completes.
create function seed.offering_context(offering_id text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); offer jsonb; source jsonb; receiver jsonb; profile jsonb;
  source_id text; target_id text; target_kind text; author text; source_standing boolean; target_standing boolean;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if offering_id is null or length(offering_id) not between 1 and 512 or offering_id ~ '[[:cntrl:]]' then
    raise exception 'Invalid offering' using errcode='22023'; end if;
  select doc into profile from public.users where id=actor for share;
  select doc into offer from public.pulses where id=offering_id for update;
  if offer is null then raise exception 'Offering unavailable' using errcode='LS034'; end if;
  if jsonb_typeof(offer->'authorId') is distinct from 'string'
    or jsonb_typeof(offer->'offeringFromTreeId') is distinct from 'string'
    or jsonb_typeof(offer->'offeredToId') is distinct from 'string'
    or offer->>'offeredToKind' not in ('tree','vision') or offer->>'offeredToKind' is null then
    raise exception 'Invalid offering' using errcode='22023'; end if;
  author:=offer->>'authorId';source_id:=offer->>'offeringFromTreeId';target_id:=offer->>'offeredToId';target_kind:=offer->>'offeredToKind';
  -- Every paired operation takes tree rows in the same order, then vision rows.
  perform 1 from public.lifetrees where id=source_id or (target_kind='tree' and id=target_id) order by id collate "C" for update;
  select doc into source from public.lifetrees where id=source_id;
  if target_kind='tree' then select doc into receiver from public.lifetrees where id=target_id;
  else select doc into receiver from public.visions where id=target_id for update; end if;
  perform 1 from public.links where from_id in (actor,author) and to_id in (source_id,target_id)
    and rel in ('keeper','steward') order by id collate "C" for share;
  perform 1 from public.secret_links where from_id in (actor,author) and to_id in (source_id,target_id)
    and rel='keeper' order by id collate "C" for share;
  source_standing:=coalesce(jsonb_typeof(source->'anchorUid')='string' and source->>'anchorUid'=author,false)
    or exists(select 1 from public.links where from_id=author and to_id=source_id and rel in ('keeper','steward'))
    or (coalesce(source->>'treeType'='SECRET',false) and exists(select 1 from public.secret_links where from_id=author and to_id=source_id and rel='keeper'));
  if target_kind='vision' then target_standing:=coalesce(jsonb_typeof(receiver->'authorId')='string' and receiver->>'authorId'=actor,false);
  else target_standing:=coalesce(jsonb_typeof(receiver->'anchorUid')='string' and receiver->>'anchorUid'=actor,false)
    or exists(select 1 from public.links where from_id=actor and to_id=target_id and rel in ('keeper','steward'))
    or (coalesce(receiver->>'treeType'='SECRET',false) and exists(select 1 from public.secret_links where from_id=actor and to_id=target_id and rel='keeper'));
  end if;
  -- Deny before returning hidden offering facts to an unauthorized operation.
  if not target_standing then raise exception 'Not an offering recipient' using errcode='42501'; end if;
  return jsonb_build_object('offeringId',offering_id,'offering',offer,'source',source,'receiver',receiver,
    'sourceStanding',source_standing,'receiverStanding',target_standing,'profile',profile);
end;
$$;
revoke all on function seed.offering_context(text) from public;

create function seed.apply_offering_acceptance(offering_id text,from_record jsonb,to_record jsonb,from_height bigint,to_height bigint) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare context jsonb; offer jsonb; source jsonb; receiver jsonb; source_id text; target_id text; target_kind text;
  side jsonb; record jsonb; expected_author text; expected_bearer text; expected_kind text; expected_height bigint; stored_height numeric; idx integer;
begin
  context:=seed.offering_context(offering_id);offer:=context->'offering';source:=context->'source';receiver:=context->'receiver';
  source_id:=offer->>'offeringFromTreeId';target_id:=offer->>'offeredToId';target_kind:=offer->>'offeredToKind';
  if offer->>'type' is distinct from 'offering' or offer->>'offeringStatus' in ('accepted','withdrawn','declined')
    or offer->'offeringActive'='false'::jsonb or offer->>'authorId'=seed.uid()
    or context->'sourceStanding' is distinct from 'true'::jsonb or source='null'::jsonb or receiver='null'::jsonb
    or (target_kind='tree' and source_id=target_id) then raise exception 'Offering cannot be accepted' using errcode='LS035'; end if;
  if from_record->>'id' is not distinct from to_record->>'id' then raise exception 'Twin IDs must differ' using errcode='22023'; end if;
  for idx in 1..2 loop
    if idx=1 then side:=source;record:=from_record;expected_author:=offer->>'authorId';expected_bearer:=source_id;expected_kind:='tree';expected_height:=from_height;
    else side:=receiver;record:=to_record;expected_author:=seed.uid();expected_bearer:=target_id;expected_kind:=target_kind;expected_height:=to_height; end if;
    begin stored_height:=coalesce((side->>'blockHeight')::numeric,0);
    exception when others then raise exception 'Invalid chain height' using errcode='22023'; end;
    if expected_height is null or expected_height<>stored_height+1 or expected_height not between 1 and 9007199254740991
      or record->>'previousHash' is distinct from coalesce(nullif(side->>'latestHash',''),nullif(side->>'genesisHash',''),'0') then
      raise exception 'Chain head moved' using errcode='LS032'; end if;
    if jsonb_typeof(record) is distinct from 'object' or record->>'type' is distinct from 'standard'
      or record->>'authorId' is distinct from expected_author or record->>'offeringId' is distinct from offering_id
      or record->>(case when expected_kind='tree' then 'lifetreeId' else 'visionId' end) is distinct from expected_bearer
      or record->>'offeringRole' is distinct from (case when idx=1 then 'from' else 'to' end)
      or record->>'offeringTwinOf' is distinct from (case when idx=1 then target_id else source_id end)
      or record->>'offeringTwinKind' is distinct from (case when idx=1 then target_kind else 'tree' end)
      or coalesce(record->>'id','') !~ '^[A-Za-z0-9_-]{1,128}$'
      or coalesce(record->>'lid','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or coalesce(record->>'hash','') !~ '^[a-f0-9]{64}$' or record->>'hashVersion' is distinct from 'lifeseed.block.v1' then
      raise exception 'Invalid offering record' using errcode='22023'; end if;
  end loop;
  insert into public.pulses(id,doc) values(from_record->>'id',from_record),(to_record->>'id',to_record);
  update public.lifetrees set doc=doc || jsonb_build_object('latestHash',from_record->>'hash','blockHeight',from_height) where id=source_id;
  if target_kind='tree' then update public.lifetrees set doc=doc || jsonb_build_object('latestHash',to_record->>'hash','blockHeight',to_height) where id=target_id;
  else update public.visions set doc=doc || jsonb_build_object('latestHash',to_record->>'hash','blockHeight',to_height) where id=target_id; end if;
  update public.pulses set doc=doc || jsonb_build_object('offeringStatus','accepted','offeringAnsweredBy',seed.uid(),
    'offeringAnsweredAt',clock_timestamp(),'updatedAt',clock_timestamp(),
    'offeringAcceptedPulseIds',jsonb_build_object('from',from_record->>'id','to',to_record->>'id')) where id=offering_id;
  return jsonb_build_object('fromPulseId',from_record->>'id','toPulseId',to_record->>'id');
end;
$$;
revoke all on function seed.apply_offering_acceptance(text,jsonb,jsonb,bigint,bigint) from public;
