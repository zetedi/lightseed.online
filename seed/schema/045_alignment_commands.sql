-- Negotiation is visible to its recorded participants and governed staff.
-- A public tree/pulse is not consent to publish someone's negotiation notes.
create function seed.can_read_alignment(proposal jsonb) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select seed.uid() is not null and (seed.is_staff()
    or (jsonb_typeof(proposal->'initiatorUid')='string' and proposal->>'initiatorUid'=seed.uid())
    or (jsonb_typeof(proposal->'targetUid')='string' and proposal->>'targetUid'=seed.uid()));
$$;
revoke all on function seed.can_read_alignment(jsonb) from public;
create policy alignment_participants on public.alignments for select using(seed.can_read_alignment(doc));
create index alignments_feed on public.alignments(seed.vision_moment(doc) desc,id collate "C" desc);

create function seed.alignment_command(command jsonb,new_id text,new_lid text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); action text:=command->>'action'; proposal jsonb; matched jsonb; own_pulse jsonb;
  source jsonb; target jsonb; source_id text; target_id text; recipient text; source_carer boolean; target_carer boolean; note text;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if jsonb_typeof(command) is distinct from 'object' then raise exception 'Invalid command' using errcode='22023'; end if;
  if action in ('note','reject') then
    if command - array['action','id','text'] <> '{}'::jsonb or jsonb_typeof(command->'id') is distinct from 'string' then
      raise exception 'Invalid command' using errcode='22023'; end if;
    select doc into proposal from public.alignments where id=command->>'id' for update;
    if proposal is null or not seed.can_read_alignment(proposal) then raise exception 'Alignment unavailable' using errcode='LS036'; end if;
    if proposal->>'status' is distinct from 'PENDING' then raise exception 'Alignment already answered' using errcode='LS037'; end if;
    if action='reject' then
      if command ? 'text' then raise exception 'Invalid command' using errcode='22023'; end if;
      if jsonb_typeof(proposal->'targetUid') is distinct from 'string' or proposal->>'targetUid'<>actor then
        raise exception 'Not the alignment recipient' using errcode='42501'; end if;
      proposal:=proposal || jsonb_build_object('status','REJECTED','rejectedAt',clock_timestamp());
    else
      if not ((jsonb_typeof(proposal->'initiatorUid')='string' and proposal->>'initiatorUid'=actor)
        or (jsonb_typeof(proposal->'targetUid')='string' and proposal->>'targetUid'=actor)) then
        raise exception 'Not an alignment participant' using errcode='42501'; end if;
      note:=btrim(command->>'text');
      if jsonb_typeof(command->'text') is distinct from 'string' or coalesce(length(note),0) not between 1 and 2000 then
        raise exception 'Invalid note' using errcode='22023'; end if;
      if proposal ? 'messages' and jsonb_typeof(proposal->'messages') is distinct from 'array' then
        raise exception 'Invalid note history' using errcode='22023'; end if;
      proposal:=proposal || jsonb_build_object('messages',coalesce(proposal->'messages','[]'::jsonb) || jsonb_build_array(jsonb_build_object('by',actor,'text',note,'at',clock_timestamp())));
    end if;
    update public.alignments set doc=proposal where id=command->>'id';
    return jsonb_build_object('alignment',proposal || jsonb_build_object('id',command->>'id'));
  end if;
  if action is distinct from 'propose' or command - array['action','fromTreeId','targetPulseId','initiatorPulseId'] <> '{}'::jsonb
    or jsonb_typeof(command->'fromTreeId') is distinct from 'string' or coalesce(length(command->>'fromTreeId'),0) not between 1 and 512
    or jsonb_typeof(command->'targetPulseId') is distinct from 'string' or coalesce(length(command->>'targetPulseId'),0) not between 1 and 512
    or jsonb_typeof(command->'initiatorPulseId') is distinct from 'string' or coalesce(length(command->>'initiatorPulseId'),0) not between 1 and 512
    or coalesce(new_id,'') !~ '^[A-Za-z0-9_-]{1,128}$'
    or coalesce(new_lid,'') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception 'Invalid proposal' using errcode='22023'; end if;
  -- The matched pulse's author is the recipient, including delegated stewards.
  select doc into matched from public.pulses where id=command->>'targetPulseId' for share;
  if matched is null or not (seed.can_read_pulse(matched)
    or seed.offering_twin_party(command->>'targetPulseId',matched) or seed.offering_recipient(matched)
    or seed.alignment_twin_party(command->>'targetPulseId',matched))
    or not seed.offering_twin_access(command->>'targetPulseId',matched)
    or not seed.alignment_twin_access(command->>'targetPulseId',matched)
    or jsonb_typeof(matched->'authorId') is distinct from 'string' or coalesce(matched->>'authorId','')=''
    or jsonb_typeof(matched->'lifetreeId') is distinct from 'string' or coalesce(matched->>'lifetreeId','')='' then
    raise exception 'Matched pulse unavailable' using errcode='LS036'; end if;
  source_id:=command->>'fromTreeId';target_id:=matched->>'lifetreeId';recipient:=matched->>'authorId';
  if source_id=target_id then raise exception 'Alignment needs two trees' using errcode='LS037'; end if;
  perform 1 from public.lifetrees where id in (source_id,target_id) order by id collate "C" for share;
  select doc into source from public.lifetrees where id=source_id;
  select doc into target from public.lifetrees where id=target_id;
  if source is null or target is null or not seed.can_read_tree(target_id,target) then
    raise exception 'Alignment tree unavailable' using errcode='LS036'; end if;
  perform 1 from public.links where from_id in (actor,recipient) and to_id in (source_id,target_id)
    and rel in ('keeper','steward') order by id collate "C" for share;
  perform 1 from public.secret_links where from_id in (actor,recipient) and to_id in (source_id,target_id)
    and rel='keeper' order by id collate "C" for share;
  source_carer:=coalesce(jsonb_typeof(source->'anchorUid')='string' and source->>'anchorUid'=actor,false)
    or exists(select 1 from public.links where from_id=actor and to_id=source_id and rel in ('keeper','steward'))
    or (coalesce(source->>'treeType'='SECRET',false) and exists(select 1 from public.secret_links where from_id=actor and to_id=source_id and rel='keeper'));
  target_carer:=coalesce(jsonb_typeof(target->'anchorUid')='string' and target->>'anchorUid'=recipient,false)
    or exists(select 1 from public.links where from_id=recipient and to_id=target_id and rel in ('keeper','steward'))
    or (coalesce(target->>'treeType'='SECRET',false) and exists(select 1 from public.secret_links where from_id=recipient and to_id=target_id and rel='keeper'));
  if not source_carer or not target_carer then raise exception 'Not a current tree carer' using errcode='42501'; end if;
  if command->>'initiatorPulseId'<>'PENDING_CREATION' then
    select doc into own_pulse from public.pulses where id=command->>'initiatorPulseId' for share;
    if own_pulse is null or jsonb_typeof(own_pulse->'authorId') is distinct from 'string' or own_pulse->>'authorId'<>actor
      or jsonb_typeof(own_pulse->'lifetreeId') is distinct from 'string' or own_pulse->>'lifetreeId'<>source_id then
      raise exception 'Initiator pulse unavailable' using errcode='LS036'; end if;
  end if;
  proposal:=jsonb_build_object('lid',new_lid,'status','PENDING','initiatorUid',actor,'initiatorTreeId',source_id,
    'initiatorPulseId',command->>'initiatorPulseId','targetUid',recipient,'targetTreeId',target_id,
    'targetPulseId',command->>'targetPulseId','createdAt',clock_timestamp());
  insert into public.alignments(id,doc) values(new_id,proposal);
  return jsonb_build_object('alignment',proposal || jsonb_build_object('id',new_id));
end;
$$;
revoke all on function seed.alignment_command(jsonb,text,text) from public;
