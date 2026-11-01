-- Mutable listing fields are separate from its immutable birth proof and twins.
create function seed.offering_lifecycle(command jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); action text:=command->>'action'; offer jsonb; own boolean; staff boolean;
  target_id text; receiver jsonb; item jsonb; object_path text; images jsonb:='[]'; private_reference boolean;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if jsonb_typeof(command) is distinct from 'object' or coalesce(action,'') not in ('edit','set_active','withdraw','decline')
    or jsonb_typeof(command->'id') is distinct from 'string' or length(command->>'id') not between 1 and 512
    or command->>'id' ~ '[[:cntrl:]]' or octet_length(command::text)>262144 then
    raise exception 'Invalid offering command' using errcode='22023'; end if;
  select doc into offer from public.pulses where id=command->>'id' for update;
  if offer is null or offer->>'type' is distinct from 'offering' then raise exception 'Offering unavailable' using errcode='LS034'; end if;
  own:=coalesce(jsonb_typeof(offer->'authorId')='string' and offer->>'authorId'=actor,false);
  perform 1 from public.admins where id=actor for share;
  perform 1 from public.config where id='superadmin' for share;
  staff:=seed.is_staff();
  if action='edit' then
    if not own and not staff then raise exception 'Not the author' using errcode='42501'; end if;
    if offer->>'offeringStatus'='accepted' then raise exception 'Accepted words stand' using errcode='LS035'; end if;
    if exists(select 1 from jsonb_object_keys(command) k where k not in ('action','id','title','body','appreciation','url','visibility','paths'))
      or jsonb_typeof(command->'title') is distinct from 'string' or length(command->>'title') not between 1 and 240
      or btrim(command->>'title')='' or command->>'title' ~ '[[:cntrl:]]'
      or jsonb_typeof(command->'body') is distinct from 'string' or length(command->>'body')>64000
      or jsonb_typeof(command->'appreciation') is distinct from 'number' or (command->>'appreciation')::numeric<1
      or (command->>'appreciation')::numeric>9007199254740991 or trunc((command->>'appreciation')::numeric)<>(command->>'appreciation')::numeric
      or coalesce(command->>'visibility','') not in ('public','node','private') or jsonb_typeof(command->'url') is distinct from 'string'
      or length(command->>'url')>300 or (command->>'url'<>'' and command->>'url' !~* '^https?://[^[:space:]]+$')
      or (offer->>'offeringKind'='code' and command->>'url'='') then raise exception 'Invalid offering content' using errcode='22023'; end if;
    perform 1 from public.lifetrees where id in (offer->>'offeringFromTreeId',offer->>'offeringBedId')
      or (offer->>'offeredToKind'='tree' and id=offer->>'offeredToId') order by id collate "C" for share;
    if offer->>'offeredToKind'='vision' then perform 1 from public.visions where id=offer->>'offeredToId' for share; end if;
    private_reference:=exists(select 1 from public.lifetrees t where
      (t.id in (offer->>'offeringFromTreeId',offer->>'offeringBedId') or (offer->>'offeredToKind'='tree' and t.id=offer->>'offeredToId'))
      and (t.doc->>'visibility'='private' or t.doc->>'treeType'='SECRET'))
      or (offer->>'offeredToKind'='vision' and exists(select 1 from public.visions v where v.id=offer->>'offeredToId' and v.doc->>'visibility'='private'));
    if command->>'visibility'<>'private' and coalesce(private_reference,false) then raise exception 'Private offering required' using errcode='22023'; end if;
    if command ? 'paths' then
      if jsonb_typeof(command->'paths') is distinct from 'array' then raise exception 'Invalid pictures' using errcode='22023'; end if;
      if jsonb_array_length(command->'paths')>100 or (select count(*) from jsonb_array_elements(command->'paths'))<>
        (select count(distinct value) from jsonb_array_elements(command->'paths')) then raise exception 'Invalid pictures' using errcode='22023'; end if;
      for item in select value from jsonb_array_elements(command->'paths') loop
        object_path:=item#>>'{}';
        if jsonb_typeof(item) is distinct from 'string' or not seed.media_path_valid(object_path)
          or not exists(select 1 from seed.media_objects where path=object_path) then raise exception 'Published picture required' using errcode='22023'; end if;
        images:=images || jsonb_build_array('/v1/media?path=' || object_path);
      end loop;
      offer:=offer || jsonb_build_object('imageUrls',images,'imageUrl',coalesce(images->>0,''));
    end if;
    offer:=offer || jsonb_build_object('title',command->>'title','body',command->>'body','content',command->>'body',
      'offeringAppreciationLight',command->'appreciation','offeringUrl',command->>'url','visibility',command->>'visibility');
  elsif action='set_active' then
    if not own then raise exception 'Not the author' using errcode='42501'; end if;
    if exists(select 1 from jsonb_object_keys(command) k where k not in ('action','id','active'))
      or jsonb_typeof(command->'active') is distinct from 'boolean' then raise exception 'Invalid active switch' using errcode='22023'; end if;
    offer:=offer || jsonb_build_object('offeringActive',command->'active');
  else
    if exists(select 1 from jsonb_object_keys(command) k where k not in ('action','id')) then raise exception 'Invalid answer' using errcode='22023'; end if;
    if coalesce(offer->>'offeringStatus','open')<>'open' or coalesce(offer->>'offeredToKind','') not in ('tree','vision') then
      raise exception 'Offering already answered' using errcode='LS035'; end if;
    if action='withdraw' then
      if not own then raise exception 'Not the author' using errcode='42501'; end if;
      offer:=offer || jsonb_build_object('offeringStatus','withdrawn','offeringAnsweredAt',clock_timestamp());
    else
      if own then raise exception 'Author cannot decline' using errcode='42501'; end if;
      target_id:=offer->>'offeredToId';
      if offer->>'offeredToKind'='tree' then select doc into receiver from public.lifetrees where id=target_id for share;
      else select doc into receiver from public.visions where id=target_id for share; end if;
      perform 1 from public.links where from_id=actor and to_id=target_id and rel in ('keeper','steward') order by id collate "C" for share;
      perform 1 from public.secret_links where from_id=actor and to_id=target_id and rel='keeper' for share;
      if receiver is null or (not staff and not coalesce(seed.offering_recipient(offer),false)) then raise exception 'Not the recipient' using errcode='42501'; end if;
      offer:=offer || jsonb_build_object('offeringStatus','declined','offeringAnsweredBy',actor,'offeringAnsweredAt',clock_timestamp());
    end if;
  end if;
  offer:=offer || jsonb_build_object('updatedAt',clock_timestamp());
  update public.pulses set doc=offer where id=command->>'id';
  return jsonb_build_object('offering',offer || jsonb_build_object('id',command->>'id'));
end;
$$;
revoke all on function seed.offering_lifecycle(jsonb) from public;
