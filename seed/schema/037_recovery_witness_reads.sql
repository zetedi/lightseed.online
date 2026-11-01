-- A bounded view of recorded proofs, not an assertion of current eligibility or quorum.
-- Activation still rechecks current identity, eligibility and every selected signature.
create function seed.recovery_witnesses(subject text,event_id text,after_id text,page_limit integer) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare rows jsonb; next_id text;
begin
  if seed.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if subject is null or length(subject) not between 1 and 128 or subject ~ '[[:cntrl:]]'
    or event_id is null or event_id !~ '^[A-Za-z0-9_-]{1,128}$'
    or page_limit is null or page_limit not between 1 and 100
    or (after_id is not null and (length(after_id) not between 1 and 512 or after_id ~ '[[:cntrl:]]')) then
    raise exception 'Invalid witness query' using errcode='22023'; end if;
  with page as (
    select id,doc from public.person_key_recovery_witnesses
    where person_id=subject and recovery_id=event_id
      and exists(select 1 from public.person_key_recoveries where person_id=subject and id=event_id)
      and (after_id is null or id collate "C">after_id collate "C")
    order by id collate "C" limit page_limit+1
  ), numbered as (select id,doc,row_number() over(order by id collate "C") as n from page)
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'version',doc->'version',
      'witnessUid',doc->'witnessUid','epochId',doc->'epochId','pubkey',doc->'pubkey',
      'keyFingerprint',doc->'keyFingerprint','sig',doc->'sig','recordedAt',doc->'recordedAt')
      order by id collate "C") filter(where n<=page_limit),'[]'::jsonb),
    case when count(*)>page_limit then max(id) filter(where n=page_limit) else null end into rows,next_id from numbered;
  return jsonb_build_object('items',rows,'next',next_id);
end;
$$;
revoke all on function seed.recovery_witnesses(text,text,text,integer) from public;
