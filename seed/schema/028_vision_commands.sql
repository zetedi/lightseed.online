-- Explicit prose mutations cannot rewrite attribution, grounding or chain history.
create function seed.vision_command(command jsonb, new_lid text, node_domain text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); action text:=command->>'action'; target text:=command->>'id';
  vision jsonb; moment bigint; preimage text; genesis text;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if jsonb_typeof(command) is distinct from 'object' or coalesce(action,'') not in ('create','edit')
    or octet_length(command::text)>262144
    or exists(select 1 from jsonb_object_keys(command) k where k not in ('action','id','title','body','visibility'))
    or jsonb_typeof(command->'title') is distinct from 'string' or length(command->>'title') not between 1 and 240
    or btrim(command->>'title')='' or command->>'title' ~ '[[:cntrl:]]'
    or jsonb_typeof(command->'body') is distinct from 'string' or length(command->>'body')>64000
    or coalesce(command->>'visibility','') not in ('public','node','private')
    then raise exception 'Invalid vision' using errcode='22023'; end if;
  if action='edit' then
    if jsonb_typeof(command->'id') is distinct from 'string' or length(target) not between 1 and 512 or target ~ '[[:cntrl:]]'
      then raise exception 'Invalid vision' using errcode='22023'; end if;
    select doc into vision from public.visions where id=target for update;
    if not found or not coalesce(seed.can_read_vision(vision),false) then raise exception 'Vision missing' using errcode='LS025'; end if;
    -- Null/malformed authors must never turn SQL's three-valued logic into permission.
    if not seed.is_staff() and (jsonb_typeof(vision->'authorId') is distinct from 'string' or vision->>'authorId' is distinct from actor) then
      raise exception 'Forbidden' using errcode='42501'; end if;
    vision:=vision || (command-'action'-'id') || jsonb_build_object('updatedAt',now());
    update public.visions set doc=vision where id=target;
  else
    if command ? 'id' or node_domain is null or node_domain='' or new_lid is null or new_lid !~
      '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then raise exception 'Invalid vision' using errcode='22023'; end if;
    target:=new_lid;
    moment:=floor(extract(epoch from clock_timestamp())*1000);
    -- Same standalone-vision v0 birth as the existing app, retained for verification.
    preimage:='{"msg":"Birth"}0' || moment::text;
    genesis:=encode(public.digest(convert_to(preimage,'UTF8'),'sha256'),'hex');
    vision:=(command-'action') || jsonb_build_object('lid',target,'authorId',actor,'domain',node_domain,
      'createdAt',to_timestamp(moment/1000.0),'genesisHash',genesis,'latestHash',genesis,'blockHeight',0,
      'genesisPreimage',preimage,'genesisAtMs',moment);
    insert into public.visions(id,doc) values(target,vision);
  end if;
  return jsonb_build_object('vision',vision || jsonb_build_object('id',target));
end;
$$;
revoke all on function seed.vision_command(jsonb,text,text) from public;
