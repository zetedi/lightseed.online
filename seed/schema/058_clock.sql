-- THE CLOCK (ring 2026-11-03): the independent node's own rhythm — the soil's half of the origin's
-- two scheduled hands (functions/light.ts checkWateringSchedules, functions/lifetrees.ts
-- mintStayLeaves) and the planting caps' backstop (functions/lifetrees.ts onLifetreeCreated). The
-- origin leans on Cloud Scheduler and document triggers; here seed.clock is a ledger of jobs with a
-- due moment and a lease: the API process (seed/api/clock.mjs) takes what is due every minute, runs
-- it on the facts these doors read, and settles the next due moment the law (domain/clock) computes
-- in the installation's zone. A job runs once even across several API processes (the lease); a job
-- the node slept through runs at the next tick, once. None of this travels; none of it is a being;
-- no HTTP request reaches these doors — the runtime role executes them for the clock alone.

-- ── THE LEDGER ───────────────────────────────────────────────────────────────────────────────
create table seed.clock(
  job text primary key check (job in ('thirst','leaves')),
  due_at timestamptz not null,
  lease_until timestamptz,
  ran_at timestamptz,
  outcome text,
  report jsonb);
alter table seed.clock enable row level security;
revoke all on seed.clock from public;
-- Both jobs are due at once on a fresh node: the morning the origin's scheduler would have given it.
insert into seed.clock(job,due_at) values ('thirst',now()),('leaves',now());

-- The due jobs, leased to this run; a job another process holds is left alone.
create function seed.clock_take(moment timestamptz, lease_ms integer) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare result jsonb;
begin
  if moment is null or lease_ms is null or lease_ms<1000 or lease_ms>86400000 then raise exception 'Invalid clock lease' using errcode='22023'; end if;
  with due as (select job from seed.clock where due_at<=moment and (lease_until is null or lease_until<moment) order by due_at for update skip locked),
    leased as (update seed.clock c set lease_until=moment+make_interval(secs=>lease_ms/1000.0) from due where c.job=due.job returning c.job, c.due_at)
  select coalesce(jsonb_agg(jsonb_build_object('job',job,'dueAt',seed.doc_stamp(due_at)) order by due_at),'[]'::jsonb) into result from leased;
  return result;
end;
$$;
revoke all on function seed.clock_take(timestamptz,integer) from public;

-- A run's end: the lease released, the next due moment set, the outcome and the report kept.
create function seed.clock_settle(job_name text, next_due timestamptz, outcome_text text, report_doc jsonb) returns void
language sql security definer set search_path=pg_catalog as $$
  update seed.clock set lease_until=null, due_at=next_due, ran_at=now(), outcome=outcome_text, report=report_doc where job=job_name and next_due is not null;
$$;
revoke all on function seed.clock_settle(text,timestamptz,text,jsonb) from public;

-- ── THE THIRST (checkWateringSchedules) ──────────────────────────────────────────────────────
-- The scheduled trees with their circles — keeper and guardian seats in both ledgers — for the law.
create function seed.thirst_trees() returns jsonb
language sql stable security definer set search_path=pg_catalog as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.doc->'name','imageUrl',t.doc->'imageUrl','domain',t.doc->'domain',
      'anchorUid',t.doc->'anchorUid','createdAt',t.doc->'createdAt','watering',t.doc->'watering',
      'circleUids',coalesce((select jsonb_agg(distinct u.uid) from (select from_id as uid from public.links where to_id=t.id and rel in ('keeper','guardian')
        union select from_id from public.secret_links where to_id=t.id and rel in ('keeper','guardian')) u),'[]'::jsonb)) order by t.id),'[]'::jsonb)
  from public.lifetrees t where t.doc->'watering'->>'mode'='scheduled';
$$;
revoke all on function seed.thirst_trees() from public;

-- The thirst's touch on one tree: the watering flags, and the ask — the standing one rewritten while
-- it still stands (the hand that raised it refreshing its words, as the rule lets a careAlert's author),
-- else a new one raised with the moment the soil keeps and, where the mail organ is grown, left in
-- the outbox for the courier (the trigger of 056 speaks only for a session's own write).
create function seed.thirst_apply(tree_id text, patch jsonb, standing_id text, ask jsonb, notify boolean) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare tree jsonb; updated jsonb; item record; rewritten boolean:=false; raised text; moment timestamptz:=now();
begin
  select doc into tree from public.lifetrees where id=tree_id for update;
  if tree is null then return null; end if;
  if jsonb_typeof(patch) is distinct from 'object'
    or exists(select 1 from jsonb_object_keys(patch) k where k not in ('watering.overdue','watering.lastAlertAt','watering.alertThreadId'))
    then raise exception 'Invalid thirst patch' using errcode='22023'; end if;
  if standing_id is not null and ask is not null then
    update public.pulses set doc=doc||jsonb_build_object('body',ask->'body','content',ask->'content','createdAt',seed.doc_stamp(moment))
      where id=standing_id and doc->>'careAlert'='watering' and doc->>'lifetreeId'=tree_id;
    rewritten:=found;
  end if;
  if not rewritten and ask is not null then
    if jsonb_typeof(ask) is distinct from 'object' or ask->>'type' is distinct from 'reach' or ask->>'careAlert' is distinct from 'watering'
      or ask->>'lifetreeId' is distinct from tree_id or ask->>'authorId' is distinct from tree->>'anchorUid' or ask->>'previousHash' is distinct from 'WATER_ALERT'
      or coalesce(ask->>'id','') !~ '^[A-Za-z0-9_-]{1,128}$'
      or coalesce(ask->>'lid','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then raise exception 'Invalid thirst ask' using errcode='22023'; end if;
    insert into public.pulses(id,doc) values(ask->>'id',ask||jsonb_build_object('createdAt',seed.doc_stamp(moment)));
    raised:=ask->>'id';
    patch:=patch||jsonb_build_object('watering.alertPulseId',raised);
    if notify then insert into seed.outbox(kind,ref) values('reach',raised); end if;
  end if;
  updated:=tree;
  if jsonb_typeof(updated->'watering') is distinct from 'object' then updated:=jsonb_set(updated,'{watering}','{}'::jsonb); end if;
  for item in select key,value from jsonb_each(patch) loop
    updated:=jsonb_set(updated,array['watering',substring(item.key from 10)],item.value,true);
  end loop;
  update public.lifetrees set doc=updated where id=tree_id;
  return jsonb_build_object('rewritten',rewritten,'raised',raised);
end;
$$;
revoke all on function seed.thirst_apply(text,jsonb,text,jsonb,boolean) from public;

-- ── THE LEAVES (mintStayLeaves) ──────────────────────────────────────────────────────────────
-- The completed stays not yet leafed, each with its bed as it stands, for the law to seal.
create function seed.stay_leaves_due(today text) returns jsonb
language sql stable security definer set search_path=pg_catalog as $$
  select case when today !~ '^\d{4}-\d{2}-\d{2}$' then '[]'::jsonb else
    coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'stay',s.doc,'bed',b.doc) order by s.id)
      from public.stays s join public.lifetrees b on b.id=s.doc->>'bedId'
      where s.doc->>'status'='accepted' and coalesce(s.doc->>'leafed','false')<>'true' and s.doc->>'toDate'<today),'[]'::jsonb) end;
$$;
revoke all on function seed.stay_leaves_due(text) from public;

-- One completed stay becomes a leaf on its bed's chain — the mint, the bed's new head and the stay's
-- `leafed` mark in one transaction under the stay's and the bed's locks; a head that moved since the
-- record was sealed refuses (LS032, as the block mint does) and the next tick seals anew.
create function seed.stay_leaf_apply(stay_id text, record jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare stay jsonb; bed jsonb; head text; height numeric;
begin
  select doc into stay from public.stays where id=stay_id for update;
  if stay is null or stay->>'status' is distinct from 'accepted' or coalesce(stay->>'leafed','false')='true' then return null; end if;
  select doc into bed from public.lifetrees where id=stay->>'bedId' for update;
  if bed is null then return null; end if;
  head:=coalesce(nullif(bed->>'latestHash',''),nullif(bed->>'genesisHash',''),'0');
  begin height:=coalesce((bed->>'blockHeight')::numeric,0);
  exception when others then raise exception 'Invalid chain height' using errcode='22023'; end;
  if jsonb_typeof(record) is distinct from 'object' then raise exception 'Invalid leaf record' using errcode='22023'; end if;
  if record->>'previousHash' is distinct from head then raise exception 'Chain head moved' using errcode='LS032'; end if;
  if record->>'type' is distinct from 'stay' or record->>'stayId' is distinct from stay_id or record->>'visibility' is distinct from 'node'
    or record->>'lifetreeId' is distinct from stay->>'bedId' or record->>'authorId' is distinct from stay->>'uid'
    or coalesce(record->>'id','') !~ '^[A-Za-z0-9_-]{1,128}$'
    or coalesce(record->>'lid','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    or coalesce(record->>'hash','') !~ '^[a-f0-9]{64}$' or record->>'hashVersion' is distinct from 'lifeseed.block.v1'
    or exists(select 1 from public.pulses where id=record->>'id')
    then raise exception 'Invalid leaf record' using errcode='22023'; end if;
  insert into public.pulses(id,doc) values(record->>'id',record||jsonb_build_object('createdAt',seed.doc_stamp(now())));
  update public.lifetrees set doc=doc||jsonb_build_object('latestHash',record->>'hash','blockHeight',(height+1)::bigint) where id=stay->>'bedId';
  update public.stays set doc=doc||jsonb_build_object('leafed',true) where id=stay_id;
  return jsonb_build_object('pulseId',record->>'id','hash',record->>'hash','blockHeight',(height+1)::bigint);
end;
$$;
revoke all on function seed.stay_leaf_apply(text,jsonb) from public;

-- ── THE PLANTING CAPS' BACKSTOP (onLifetreeCreated) ──────────────────────────────────────────
-- The plant command (011) counts a keeper's trees under its lock; the document door's create did
-- not — so the soil itself now refuses a tree over its keeper's ceiling at the insert (193 lifetrees,
-- 132 guarded, 12 secret; config/limits respected; beds keep their own ceilings in the rule). The
-- origin uproots the newborn after the fact; here it is never born. Staff plant freely, and a row
-- no session wrote (the crossing's import, the owner's repairs) is not a planting.
create function seed.tree_caps_on_insert() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); anchor text; kind text; cap numeric; configured text; countable integer;
begin
  if actor is null or seed.is_staff() then return new; end if;
  anchor:=new.doc->>'anchorUid';
  if anchor is null or anchor='' then return new; end if;
  kind:=case when new.doc->>'treeType' in ('SECRET','BED') then new.doc->>'treeType'
    when new.doc->>'treeType'='GUARDED' or (nullif(new.doc->>'treeType','') is null and new.doc->>'isNature'='true') then 'GUARDED' else 'LIFETREE' end;
  if kind='BED' then return new; end if;
  cap:=case kind when 'SECRET' then 12 when 'GUARDED' then 132 else 193 end;
  if kind<>'SECRET' then
    select doc->>(case kind when 'GUARDED' then 'maxGuardedTrees' else 'maxLifetrees' end) into configured from public.config where id='limits';
    if configured ~ '^[0-9]+(\.[0-9]+)?$' and configured::numeric>=1 then cap:=floor(configured::numeric); end if;
  end if;
  select count(*) into countable from public.lifetrees where doc->>'anchorUid'=anchor and id<>new.id and
    (case when doc->>'treeType' in ('SECRET','BED') then doc->>'treeType'
      when doc->>'treeType'='GUARDED' or (nullif(doc->>'treeType','') is null and doc->>'isNature'='true') then 'GUARDED' else 'LIFETREE' end)=kind;
  if countable>=cap then raise exception 'Tree limit reached' using errcode='LS015'; end if;
  return new;
end;
$$;
revoke all on function seed.tree_caps_on_insert() from public;
create trigger lifetrees_caps before insert on public.lifetrees for each row execute function seed.tree_caps_on_insert();
