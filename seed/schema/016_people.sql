-- Public names come from the already-public person record, never private users.
-- Keep the runtime's direct table access closed; this endpoint projects identity/name only.
create function seed.people(person_id text, name_query text, after_id text, page_size integer) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare result jsonb; cursor_id text; total integer;
begin
  if page_size is null or page_size not between 1 and 100 or (person_id is not null and (name_query is not null or after_id is not null))
    or (name_query is not null and (length(name_query) not between 1 and 60 or btrim(name_query)='' or name_query ~ '[[:cntrl:]]')) then
    raise exception 'Invalid query' using errcode='22023'; end if;
  if person_id is not null then
    select jsonb_build_object('uid',id,'lid',doc->>'lid','displayName',doc->>'displayName') into result from public.persons where id=person_id;
    return jsonb_build_object('person',result);
  end if;
  with page as (
    select id,doc from public.persons where (name_query is null or strpos(lower(coalesce(doc->>'displayName','')),lower(name_query))>0)
      and (after_id is null or id>after_id) order by id limit page_size+1
  ), numbered as (select *,row_number() over(order by id) n from page)
  select coalesce(jsonb_agg(jsonb_build_object('uid',id,'lid',doc->>'lid','displayName',doc->>'displayName') order by id)
    filter(where n<=page_size),'[]'::jsonb),max(id) filter(where n=page_size),count(*) into result,cursor_id,total from numbered;
  return jsonb_build_object('people',result,'next',case when total>page_size then cursor_id else null end);
end;
$$;
revoke all on function seed.people(text,text,text,integer) from public;
