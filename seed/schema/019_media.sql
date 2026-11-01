-- Local object manifests are installation storage state, not imported authority.
create table seed.media_objects(path text primary key, doc jsonb not null);
alter table seed.media_objects enable row level security;
create function seed.media_path_valid(object_path text) returns boolean
language sql immutable set search_path=pg_catalog as $$
  select object_path is not null and length(object_path) between 1 and 1024
    and object_path ~ '^[A-Za-z0-9_.~/-]+$' and cardinality(string_to_array(object_path,'/'))>=2
    and not exists(select 1 from unnest(string_to_array(object_path,'/')) segment where segment in ('','.','..') or length(segment)>255);
$$;
revoke all on function seed.media_path_valid(text) from public;
create function seed.media_write_allowed(object_path text) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select seed.uid() is not null and seed.media_path_valid(object_path)
    and split_part(object_path,'/',1) not in ('thumbs','previews','originals')
    and object_path ~ '\.(jpg|jpeg|png|webp)$' and (
      seed.is_staff()
      or (split_part(object_path,'/',1)='users' and split_part(object_path,'/',2)=seed.uid() and cardinality(string_to_array(object_path,'/'))>=3)
      or (split_part(object_path,'/',1)='beings' and cardinality(string_to_array(object_path,'/'))>=3 and exists(
        select 1 from public.persons p join public.users u on u.id=p.id where p.id=seed.uid()
          and p.doc->>'uid'=p.id and p.doc->>'lid'=split_part(object_path,'/',2) and u.doc->>'lid'=p.doc->>'lid'))
      or (split_part(object_path,'/',1)='communities' and cardinality(string_to_array(object_path,'/'))>=3 and exists(
        select 1 from public.communities c where c.id=split_part(object_path,'/',2) and (c.doc->>'anchorUid'=seed.uid()
          or exists(select 1 from public.links l where l.from_id=seed.uid() and l.rel='keeper' and l.to_id=c.id))))
      or split_part(object_path,'/',1)='collabs');
$$;
revoke all on function seed.media_write_allowed(text) from public;
create function seed.media_get(object_path text) returns jsonb
language sql stable security definer set search_path=pg_catalog as $$
  select doc from seed.media_objects where path=object_path and seed.media_path_valid(object_path);
$$;
revoke all on function seed.media_get(text) from public;
create function seed.media_publish(object_path text, manifest jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare item record; expected text[]:=array['primary','small','large'];
begin
  if not coalesce(seed.media_write_allowed(object_path),false) then raise exception 'Forbidden' using errcode='42501'; end if;
  if jsonb_typeof(manifest) is distinct from 'object' or (select count(*) from jsonb_object_keys(manifest))<>3
    or exists(select 1 from jsonb_object_keys(manifest) k where not(k=any(expected))) then raise exception 'Invalid media manifest' using errcode='22023'; end if;
  for item in select * from jsonb_each(manifest) loop
    if jsonb_typeof(item.value) is distinct from 'object'
      or (select count(*) from jsonb_object_keys(item.value))<>3
      or exists(select 1 from jsonb_object_keys(item.value) k where k not in ('hash','type','size'))
      or jsonb_typeof(item.value->'hash') is distinct from 'string' or item.value->>'hash' !~ '^[a-f0-9]{64}$'
      or coalesce(item.value->>'type','') not in ('image/jpeg','image/png','image/webp')
      or jsonb_typeof(item.value->'size') is distinct from 'number' then raise exception 'Invalid media manifest' using errcode='22023'; end if;
    if (item.value->>'size')::numeric not between 1 and 12582912 or (item.value->>'size')::numeric<>trunc((item.value->>'size')::numeric)
      or (item.key<>'primary' and item.value->>'type'<>'image/webp') then raise exception 'Invalid media manifest' using errcode='22023'; end if;
  end loop;
  -- Existing paths are immutable: a signed chain's image must never silently change.
  insert into seed.media_objects(path,doc) values(object_path,manifest || jsonb_build_object('createdAt',now(),'createdBy',seed.uid()));
  return manifest;
exception when unique_violation then raise exception 'Media path already exists' using errcode='LS024';
end;
$$;
revoke all on function seed.media_publish(text,jsonb) from public;
