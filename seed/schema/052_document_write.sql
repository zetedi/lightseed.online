-- THE DOOR ITSELF (ring 2026-11-02): one dispatcher over the rules, one GET under the `get` law,
-- one LIST under the row-level policies, one WRITE that locks the row, applies the patch, asks
-- the rule and stores — and the one atomic gesture the rules prove as a pair, love. These four
-- are the only entry points the runtime role may execute; every table stays closed to its DML.
create function seed.doc_rule(collection text, action text, id text, parent text, old_doc jsonb, new_doc jsonb, changed text[], moment timestamptz) returns boolean
language plpgsql stable security definer set search_path=pg_catalog as $$
begin
  case collection
    when 'users' then return seed.rule_users(action,id,parent,old_doc,new_doc,changed,moment);
    when 'persons' then return seed.rule_persons(action,id,parent,old_doc,new_doc,changed,moment);
    when 'admins' then return seed.rule_admins(action,id,parent,old_doc,new_doc,changed,moment);
    when 'config' then return seed.rule_config(action,id,parent,old_doc,new_doc,changed,moment);
    when 'initiates' then return seed.rule_initiates(action,id,parent,old_doc,new_doc,changed,moment);
    when 'lifetrees' then return seed.rule_lifetrees(action,id,parent,old_doc,new_doc,changed,moment);
    when 'visions' then return seed.rule_visions(action,id,parent,old_doc,new_doc,changed,moment);
    when 'pulses' then return seed.rule_pulses(action,id,parent,old_doc,new_doc,changed,moment);
    when 'light_houses' then return seed.rule_light_houses(action,id,parent,old_doc,new_doc,changed,moment);
    when 'communities' then return seed.rule_communities(action,id,parent,old_doc,new_doc,changed,moment);
    when 'alignments' then return seed.rule_alignments(action,id,parent,old_doc,new_doc,changed,moment);
    when 'covenants' then return seed.rule_covenants(action,id,parent,old_doc,new_doc,changed,moment);
    when 'covenant_signatures' then return seed.rule_covenant_signatures(action,id,parent,old_doc,new_doc,changed,moment);
    when 'pulse_signatures' then return seed.rule_pulse_signatures(action,id,parent,old_doc,new_doc,changed,moment);
    when 'pulse_witnesses' then return seed.rule_pulse_witnesses(action,id,parent,old_doc,new_doc,changed,moment);
    when 'lifetree_loves','vision_loves','pulse_loves','community_loves','light_house_loves' then return seed.rule_loves(action,id,parent,old_doc,new_doc,changed,moment);
    when 'lifetree_occupancy' then return seed.rule_lifetree_occupancy(action,id,parent,old_doc,new_doc,changed,moment);
    when 'bed_holds' then return seed.rule_bed_holds(action,id,parent,old_doc,new_doc,changed,moment);
    when 'stays' then return seed.rule_stays(action,id,parent,old_doc,new_doc,changed,moment);
    when 'supports' then return seed.rule_supports(action,id,parent,old_doc,new_doc,changed,moment);
    when 'rays' then return seed.rule_rays(action,id,parent,old_doc,new_doc,changed,moment);
    when 'glow' then return seed.rule_glow(action,id,parent,old_doc,new_doc,changed,moment);
    when 'gifts' then return seed.rule_gifts(action,id,parent,old_doc,new_doc,changed,moment);
    when 'spends' then return seed.rule_spends(action,id,parent,old_doc,new_doc,changed,moment);
    when 'network_invites' then return seed.rule_network_invites(action,id,parent,old_doc,new_doc,changed,moment);
    when 'community_tree_invites' then return seed.rule_community_tree_invites(action,id,parent,old_doc,new_doc,changed,moment);
    when 'community_keeper_invites' then return seed.rule_community_keeper_invites(action,id,parent,old_doc,new_doc,changed,moment);
    when 'invite_requests' then return seed.rule_invite_requests(action,id,parent,old_doc,new_doc,changed,moment);
    when 'collabs' then return seed.rule_collabs(action,id,parent,old_doc,new_doc,changed,moment);
    when 'intelligences' then return seed.rule_intelligences(action,id,parent,old_doc,new_doc,changed,moment);
    when 'personas' then return seed.rule_personas(action,id,parent,old_doc,new_doc,changed,moment);
    when 'memories' then return seed.rule_memories(action,id,parent,old_doc,new_doc,changed,moment);
    when 'subscriptions' then return seed.rule_subscriptions(action,id,parent,old_doc,new_doc,changed,moment);
    when 'person_keys','person_key_events' then return seed.rule_person_keys(action,id,parent,old_doc,new_doc,changed,moment);
    when 'push_subscriptions' then return seed.rule_push_subscriptions(action,id,parent,old_doc,new_doc,changed,moment);
    else return false;
  end case;
end;
$$;
revoke all on function seed.doc_rule(text,text,text,text,jsonb,jsonb,text[],timestamptz) from public;

-- ONE DOCUMENT by its door, under the `get` law. Missing and unreadable answer the same silence.
create function seed.doc_get(collection text, parent text, id text) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare t record; found jsonb;
begin
  select * into t from seed.doc_table(collection);
  if t.relation is null or (t.parent_column is null)<>(parent is null) or id is null or length(id) not between 1 and 512 or id ~ '[[:cntrl:]]'
    then raise exception 'Invalid document address' using errcode='22023'; end if;
  execute format('select doc from %s where %I=$1', t.relation, t.id_column)
    || case when t.parent_column is not null then format(' and %I=$2', t.parent_column) else ' and $2 is null' end
    || case when t.fixed_kind is not null then format(' and parent_kind=%L', t.fixed_kind) else '' end
    into found using id, parent;
  if found is null or not coalesce(seed.doc_rule(collection,'get',id,parent,found,null,null,now()),false) then return null; end if;
  return found || jsonb_build_object('id',id);
end;
$$;
revoke all on function seed.doc_get(text,text,text) from public;

-- A PAGE of a collection, as the asking role may see it (security invoker: the row-level
-- policies filter). Equality, array-contains and `in` filters on the registry's fields only
-- (domain/seedDocs names them; the API refuses the rest); newest-first or id order, with the
-- same cursors the pulse and vision pages carry.
create function seed.doc_list(collection text, parent text, equals jsonb, contains jsonb, within jsonb, newest boolean, after jsonb, page_limit integer) returns jsonb
language plpgsql stable set search_path=pg_catalog as $$
declare t record; conditions text:=' where true'; ordering text; query text; page jsonb; total integer; last jsonb; item record;
begin
  select * into t from seed.doc_table(collection);
  if t.relation is null or (t.parent_column is null)<>(parent is null) or page_limit is null or page_limit not between 1 and 100
    then raise exception 'Invalid document query' using errcode='22023'; end if;
  if t.parent_column is not null then conditions:=conditions || format(' and %I=%L', t.parent_column, parent); end if;
  if t.fixed_kind is not null then conditions:=conditions || format(' and parent_kind=%L', t.fixed_kind); end if;
  for item in select key,val from jsonb_each(coalesce(equals,'{}'::jsonb)) as e(key,val) loop
    if item.key !~ '^[A-Za-z][A-Za-z0-9_]{0,63}$' or jsonb_typeof(item.val)<>'string' then raise exception 'Invalid document filter' using errcode='22023'; end if;
    conditions:=conditions || format(' and doc->>%L=%L', item.key, item.val#>>'{}');
  end loop;
  for item in select key,val from jsonb_each(coalesce(contains,'{}'::jsonb)) as e(key,val) loop
    if item.key !~ '^[A-Za-z][A-Za-z0-9_]{0,63}$' or jsonb_typeof(item.val)<>'string' then raise exception 'Invalid document filter' using errcode='22023'; end if;
    conditions:=conditions || format(' and doc->%L @> %L::jsonb', item.key, jsonb_build_array(item.val)::text);
  end loop;
  for item in select key,val from jsonb_each(coalesce(within,'{}'::jsonb)) as e(key,val) loop
    if item.key !~ '^[A-Za-z][A-Za-z0-9_]{0,63}$' or jsonb_typeof(item.val)<>'array' or jsonb_array_length(item.val) not between 1 and 10
      or exists(select 1 from jsonb_array_elements(item.val) v where jsonb_typeof(v)<>'string') then raise exception 'Invalid document filter' using errcode='22023'; end if;
    conditions:=conditions || format(' and doc->>%L = any(%L::text[])', item.key, (select array_agg(v#>>'{}') from jsonb_array_elements(item.val) v));
  end loop;
  if newest then
    if after is not null then
      if jsonb_typeof(after->'moment')<>'string' or jsonb_typeof(after->'id')<>'string' then raise exception 'Invalid cursor' using errcode='22023'; end if;
      conditions:=conditions || format(' and (seed.vision_moment(doc), %I collate "C") < (%L::timestamptz, %L collate "C")', t.id_column, after->>'moment', after->>'id');
    end if;
    ordering:=format(' order by seed.vision_moment(doc) desc, %I collate "C" desc', t.id_column);
  else
    if after is not null then
      if jsonb_typeof(after)<>'string' then raise exception 'Invalid cursor' using errcode='22023'; end if;
      conditions:=conditions || format(' and %I > %L', t.id_column, after#>>'{}');
    end if;
    ordering:=format(' order by %I', t.id_column);
  end if;
  query:=format('select jsonb_build_object(''id'',%I,''doc'',doc,''moment'',to_char(seed.vision_moment(doc) at time zone ''UTC'',''YYYY-MM-DD"T"HH24:MI:SS.US"Z"'')) as row from %s', t.id_column, t.relation)
    || conditions || ordering || format(' limit %s', page_limit+1);
  execute 'select coalesce(jsonb_agg(q.row),''[]''::jsonb) from (' || query || ') q' into page;
  total:=jsonb_array_length(page);
  last:=page->(least(total,page_limit)-1);
  return jsonb_build_object(
    'items',coalesce((select jsonb_agg((r->'doc') || jsonb_build_object('id',r->>'id')) from (select value as r from jsonb_array_elements(page) with ordinality as e(value,n) where n<=page_limit) rows),'[]'::jsonb),
    'next',case when total>page_limit then (case when newest then jsonb_build_array(last->>'moment',last->>'id') else last->'id' end) else 'null'::jsonb end);
end;
$$;
revoke all on function seed.doc_list(text,text,jsonb,jsonb,jsonb,boolean,jsonb,integer) from public;

-- A WRITE as a claim: lock the row, shape the document that would stand, ask the law, store.
-- `expect` holds fields the caller read before writing: a changed one refuses (the transaction
-- a Firestore client would have retried). The community cap is serialized like founding.
create function seed.doc_write(command jsonb, new_id text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare t record; action text:=command->>'action'; collection text:=command->>'collection'; parent text:=command->>'parent';
  id text:=command->>'id'; data jsonb:=command->'data'; patch jsonb:=command->'patch'; expect jsonb:=command->'expect';
  merge boolean:=coalesce(seed.doc_bool(command->'merge',false),false); moment timestamptz:=now();
  old_doc jsonb; new_doc jsonb; changed text[]; effective text; item record; where_sql text;
begin
  if jsonb_typeof(command) is distinct from 'object' or octet_length(command::text)>262144
    or coalesce(action,'') not in ('create','set','update','delete') then raise exception 'Invalid document command' using errcode='22023'; end if;
  select * into t from seed.doc_table(collection);
  if t.relation is null or (t.parent_column is null)<>(parent is null)
    or (parent is not null and (length(parent) not between 1 and 512 or parent ~ '[[:cntrl:]]'))
    or (id is not null and (length(id) not between 1 and 512 or id ~ '[[:cntrl:]]'))
    or (id is null and action<>'create') then raise exception 'Invalid document address' using errcode='22023'; end if;
  if action in ('create','set') and (jsonb_typeof(data) is distinct from 'object' or data ? 'id') then raise exception 'Invalid document' using errcode='22023'; end if;
  if action='update' and (jsonb_typeof(patch) is distinct from 'object' or patch='{}'::jsonb) then raise exception 'Invalid patch' using errcode='22023'; end if;
  if expect is not null and jsonb_typeof(expect) is distinct from 'object' then raise exception 'Invalid expectation' using errcode='22023'; end if;
  if id is null then
    if new_id is null or new_id !~ '^[A-Za-z0-9_-]{1,128}$' then raise exception 'Invalid document id' using errcode='22023'; end if;
    id:=new_id;
  end if;
  if collection='communities' and action in ('create','set') then perform pg_advisory_xact_lock(hashtextextended('community:capacity',0)); end if;
  where_sql:=format(' where %I=$1', t.id_column)
    || case when t.parent_column is not null then format(' and %I=$2', t.parent_column) else ' and $2 is null' end
    || case when t.fixed_kind is not null then format(' and parent_kind=%L', t.fixed_kind) else '' end;
  execute format('select doc from %s', t.relation) || where_sql || ' for update' into old_doc using id, parent;
  if expect is not null then
    for item in select key,val from jsonb_each(expect) as e(key,val) loop
      if (old_doc->item.key) is distinct from item.val then raise exception 'Document changed' using errcode='LS042'; end if;
    end loop;
  end if;
  case action
    when 'create' then
      if old_doc is not null then raise exception 'Document exists' using errcode='LS041'; end if;
      new_doc:=seed.doc_resolve(data,moment); effective:='create';
    when 'set' then
      if old_doc is null then new_doc:=seed.doc_resolve(data,moment); effective:='create';
      else new_doc:=case when merge then seed.doc_patch(old_doc,data,moment,false) else seed.doc_resolve(data,moment) end; effective:='update'; end if;
    when 'update' then
      if old_doc is null then raise exception 'Document missing' using errcode='LS040'; end if;
      new_doc:=seed.doc_patch(old_doc,patch,moment,true); effective:='update';
    when 'delete' then
      if old_doc is null then return jsonb_build_object('id',id,'doc',null); end if;
      new_doc:=null; effective:='delete';
  end case;
  if effective='update' then changed:=seed.doc_changed(old_doc,new_doc); end if;
  if not coalesce(seed.doc_rule(collection,effective,id,parent,old_doc,new_doc,changed,moment),false) then
    raise exception 'Forbidden' using errcode='42501'; end if;
  if effective='create' then
    if t.fixed_kind is not null then
      execute format('insert into %s(parent_kind,%I,%I,doc) values(%L,$1,$2,$3)', t.relation, t.parent_column, t.id_column, t.fixed_kind) using parent, id, new_doc;
    elsif t.parent_column is not null then
      execute format('insert into %s(%I,%I,doc) values($1,$2,$3)', t.relation, t.parent_column, t.id_column) using parent, id, new_doc;
    else
      execute format('insert into %s(%I,doc) values($1,$2)', t.relation, t.id_column) using id, new_doc;
    end if;
  elsif effective='update' then
    execute format('update %s set doc=$3', t.relation) || where_sql using id, parent, new_doc;
  else
    execute format('delete from %s', t.relation) || where_sql using id, parent;
  end if;
  return jsonb_build_object('id',id,'doc',case when new_doc is null then null else new_doc || jsonb_build_object('id',id) end);
end;
$$;
revoke all on function seed.doc_write(jsonb,text) from public;

-- LOVE IS ONE ATOMIC GESTURE: the private slot and the public tally move together, exactly once.
-- A pulse carries the legacy validationScore mirror beside loveCount; both move as one.
create function seed.love_toggle(kind text, target text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); relation text; collection text; being jsonb; loved boolean; count numeric; moment timestamptz:=now();
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if target is null or length(target) not between 1 and 512 or target ~ '[[:cntrl:]]' then raise exception 'Invalid being' using errcode='22023'; end if;
  case kind
    when 'lifetrees' then relation:='public.lifetrees'; collection:='lifetrees';
    when 'visions' then relation:='public.visions'; collection:='visions';
    when 'pulses' then relation:='public.pulses'; collection:='pulses';
    when 'communities' then relation:='public.communities'; collection:='communities';
    when 'lightHouses' then relation:='public.light_houses'; collection:='light_houses';
    else raise exception 'Invalid being' using errcode='22023';
  end case;
  execute format('select doc from %s where id=$1 for update', relation) into being using target;
  if being is null or not coalesce(seed.doc_rule(collection,'get',target,null,being,null,null,moment),false) then
    raise exception 'Love target missing' using errcode='LS043'; end if;
  perform 1 from public.loves where parent_kind=kind and parent_id=target and uid=actor for update;
  loved:=found;
  count:=seed.doc_num(being->'loveCount',0);
  if kind='pulses' and count<=0 then count:=seed.doc_num(being->'validationScore',0); end if;
  if loved then
    delete from public.loves where parent_kind=kind and parent_id=target and uid=actor;
    count:=greatest(0,count-1);
  else
    insert into public.loves(parent_kind,parent_id,uid,doc) values(kind,target,actor,jsonb_build_object('uid',actor,'createdAt',seed.doc_stamp(moment)));
    count:=count+1;
  end if;
  being:=being || jsonb_build_object('loveCount',count,'updatedAt',seed.doc_stamp(moment))
    || case when kind='pulses' then jsonb_build_object('validationScore',count) else '{}'::jsonb end;
  execute format('update %s set doc=$2 where id=$1', relation) using target, being;
  return jsonb_build_object('loved',not loved,'loveCount',count);
end;
$$;
revoke all on function seed.love_toggle(text,text) from public;
