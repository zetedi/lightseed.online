-- Birth proofs stay outside mutable, publicly readable listings. No runtime table
-- access is granted; future export must preserve the original privacy boundary.
create table seed.offering_birth_proofs(offering_id text primary key,author_id text not null,visibility text not null,
  preimage text not null,minted_at bigint not null,hash text not null);
alter table seed.offering_birth_proofs enable row level security;

create function seed.offering_birth_context(command jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); profile jsonb; source jsonb; receiver jsonb; bed jsonb; images jsonb:='[]';
  source_id text:=command->>'fromTreeId'; target_id text:=command->>'toId'; target_kind text:=command->>'toKind';
  bed_id text:=command->>'bedId'; item jsonb; object_path text; tree_row record; allowed boolean;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if jsonb_typeof(command) is distinct from 'object' or command->>'action' is distinct from 'create'
    or command->>'kind' not in ('bed','service','code','product') or command->>'kind' is null
    or command->>'visibility' not in ('public','node','private') or command->>'visibility' is null
    or jsonb_typeof(command->'paths') is distinct from 'array' or octet_length(command::text)>262144
    or exists(select 1 from jsonb_object_keys(command) k where k not in ('action','kind','title','body','appreciation','url','bedId','toKind','toId','fromTreeId','visibility','paths')) then
    raise exception 'Invalid offering draft' using errcode='22023'; end if;
  if (command ? 'toKind' or command ? 'toId' or command ? 'fromTreeId') and
    (coalesce(target_kind,'') not in ('tree','vision') or coalesce(target_id,'')='' or coalesce(source_id,'')='') then
    raise exception 'Complete offering destination required' using errcode='22023'; end if;
  if bed_id is not null and command->>'kind'<>'bed' then raise exception 'Invalid bed offering' using errcode='22023'; end if;
  select doc into profile from public.users where id=actor for share;
  if profile is null or jsonb_typeof(profile->'uid') is distinct from 'string' or profile->>'uid' is distinct from actor then
    raise exception 'Profile required' using errcode='LS001'; end if;
  perform 1 from public.admins where id=actor for share;
  perform 1 from public.config where id='superadmin' for share;
  perform 1 from public.lifetrees where id in (source_id,bed_id) or (target_kind='tree' and id=target_id) order by id collate "C" for share;
  select doc into source from public.lifetrees where id=source_id;
  select doc into bed from public.lifetrees where id=bed_id;
  if target_kind='tree' then select doc into receiver from public.lifetrees where id=target_id;
  elsif target_kind='vision' then select doc into receiver from public.visions where id=target_id for share; end if;
  perform 1 from public.links where from_id=actor and to_id in (source_id,bed_id,target_id) and rel in ('keeper','steward','guardian','observer') order by id collate "C" for share;
  perform 1 from public.secret_links where from_id=actor and to_id in (source_id,bed_id,target_id) and rel='keeper' order by id collate "C" for share;
  for tree_row in select t.id,t.doc from public.lifetrees t where t.id in (source_id,bed_id) loop
    allowed:=seed.is_staff() or (jsonb_typeof(tree_row.doc->'anchorUid')='string' and tree_row.doc->>'anchorUid'=actor)
      or exists(select 1 from public.links where from_id=actor and to_id=tree_row.id and rel in ('keeper','steward'))
      or (tree_row.doc->>'treeType'='SECRET' and exists(select 1 from public.secret_links where from_id=actor and to_id=tree_row.id and rel='keeper'));
    if not coalesce(allowed,false) then raise exception 'Not a source carer' using errcode='42501'; end if;
  end loop;
  if (source_id is not null and source is null) or (bed_id is not null and (bed is null or bed->>'treeType' is distinct from 'BED'))
    or (target_kind is not null and (receiver is null or not coalesce(case when target_kind='tree' then seed.can_read_tree(target_id,receiver) else seed.can_read_vision(receiver) end,false))) then
    raise exception 'Offering reference unavailable' using errcode='LS034'; end if;
  -- Do not publish private bearer names through a newly created public listing.
  if command->>'visibility'<>'private' and (source->>'visibility'='private' or source->>'treeType'='SECRET'
    or receiver->>'visibility'='private' or receiver->>'treeType'='SECRET' or bed->>'visibility'='private' or bed->>'treeType'='SECRET') then
    raise exception 'Private offering required' using errcode='22023'; end if;
  if jsonb_array_length(command->'paths')>100 or (select count(*) from jsonb_array_elements(command->'paths'))<>
    (select count(distinct value) from jsonb_array_elements(command->'paths')) then raise exception 'Invalid pictures' using errcode='22023'; end if;
  for item in select value from jsonb_array_elements(command->'paths') loop
    object_path:=item#>>'{}';
    if jsonb_typeof(item) is distinct from 'string' or not seed.media_path_valid(object_path)
      or not exists(select 1 from seed.media_objects where path=object_path) then raise exception 'Published picture required' using errcode='22023'; end if;
    images:=images || jsonb_build_array('/v1/media?path=' || object_path);
  end loop;
  return jsonb_build_object('profile',profile,'source',source,'receiver',receiver,'bed',bed,'images',images);
end;
$$;
revoke all on function seed.offering_birth_context(jsonb) from public;

create function seed.apply_offering_birth(command jsonb,record jsonb,proof jsonb,notice jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare context jsonb; recipient text; moment bigint;
begin
  context:=seed.offering_birth_context(command);
  if jsonb_typeof(record) is distinct from 'object' or record->>'authorId' is distinct from seed.uid()
    or record->>'type' is distinct from 'offering' or record->>'previousHash' is distinct from 'OFFERING'
    or record->>'offeringKind' is distinct from command->>'kind' or record->>'visibility' is distinct from command->>'visibility'
    or record->>'offeredToKind' is distinct from command->>'toKind' or record->>'offeredToId' is distinct from command->>'toId'
    or record->>'offeringFromTreeId' is distinct from command->>'fromTreeId' or record->>'offeringBedId' is distinct from command->>'bedId'
    or record->'offeringActive' is distinct from 'true'::jsonb or (command ? 'toKind' and record->>'offeringStatus' is distinct from 'open')
    or coalesce(record->>'id','') !~ '^[A-Za-z0-9_-]{1,128}$'
    or coalesce(record->>'lid','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or record ? 'birthPreimage' or record ? 'offeringSuspendedLight' or record ? 'lifetreeId' or record ? 'visionId'
    or jsonb_typeof(proof) is distinct from 'object' or proof->>'authorId' is distinct from seed.uid()
    or proof->>'visibility' is distinct from command->>'visibility' or jsonb_typeof(proof->'preimage') is distinct from 'string'
    or record->>'hash' is distinct from encode(public.digest(convert_to(proof->>'preimage','UTF8'),'sha256'),'hex') then
    raise exception 'Invalid offering birth' using errcode='22023'; end if;
  moment:=(proof->>'mintedAt')::bigint;
  recipient:=case when command->>'toKind'='tree' then context->'receiver'->>'anchorUid' else context->'receiver'->>'authorId' end;
  if recipient is not null and recipient<>'' and recipient<>seed.uid() and command ? 'fromTreeId' then
    if jsonb_typeof(notice) is distinct from 'object' or notice->>'type' is distinct from 'reach'
      or notice->>'visibility' is distinct from 'private' or notice->>'authorId' is distinct from seed.uid()
      or notice->>'recipientUid' is distinct from recipient or notice->>'lifetreeId' is distinct from command->>'fromTreeId'
      or notice->>'previousHash' is distinct from 'OFFER_NOTICE'
      or notice->'participantUids' is distinct from jsonb_build_array(seed.uid(),recipient)
      or coalesce(notice->>'id','') !~ '^[A-Za-z0-9_-]{1,128}$'
      or coalesce(notice->>'lid','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
      raise exception 'Private recipient notice required' using errcode='22023'; end if;
  elsif notice is distinct from 'null'::jsonb and notice is not null then raise exception 'Unexpected notice' using errcode='22023'; end if;
  insert into public.pulses(id,doc) values(record->>'id',record);
  insert into seed.offering_birth_proofs values(record->>'id',seed.uid(),proof->>'visibility',proof->>'preimage',moment,record->>'hash');
  if notice is not null and notice<>'null'::jsonb then insert into public.pulses(id,doc) values(notice->>'id',notice); end if;
  return jsonb_build_object('offering',record);
end;
$$;
revoke all on function seed.apply_offering_birth(jsonb,jsonb,jsonb,jsonb) from public;

-- An addressed private offering is readable by its current recipient carers,
-- without giving them access to the author's private profile or birth proof.
create function seed.offering_recipient(pulse jsonb) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select seed.uid() is not null and pulse->>'type'='offering' and case when pulse->>'offeredToKind'='vision' then
    exists(select 1 from public.visions v where v.id=pulse->>'offeredToId' and jsonb_typeof(v.doc->'authorId')='string' and v.doc->>'authorId'=seed.uid())
  when pulse->>'offeredToKind'='tree' then exists(select 1 from public.lifetrees t where t.id=pulse->>'offeredToId' and (
    (jsonb_typeof(t.doc->'anchorUid')='string' and t.doc->>'anchorUid'=seed.uid())
    or exists(select 1 from public.links where from_id=seed.uid() and to_id=t.id and rel in ('keeper','steward'))
    or (t.doc->>'treeType'='SECRET' and exists(select 1 from public.secret_links where from_id=seed.uid() and to_id=t.id and rel='keeper')))) else false end;
$$;
revoke all on function seed.offering_recipient(jsonb) from public;
create policy offering_recipient_reads on public.pulses for select using(seed.offering_recipient(doc));
