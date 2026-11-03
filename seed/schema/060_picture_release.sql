-- THE RELEASE OF A PICTURE (ring 2026-11-03): the origin's functions/releasePicture on this soil. A
-- replaced logo, a removed hero, a dropped gallery image, a person's site logo or hero: the picture
-- leaves the node with its variants — only from the APPEARANCE seats the law names (domain/pictureRelease,
-- the one source the origin's functions mirror), only by a hand that holds the seat (the community's
-- anchor or a keeper, the person themself, staff), only once the holder's document no longer shows it;
-- a chain-bound picture is never released. The API reads the FACTS under locks (seed.picture_context),
-- asks the law whether the holder still shows the path, and takes the manifest (seed.picture_release).
-- The FILES are content-addressed (seed/api/media.mjs: one file per SHA-256, shared by every manifest
-- naming the same bytes), so a release never unlinks: it marks each hash an ORPHAN, and the sweep —
-- right after the release, and the clock's nightly 'sweep' for what a crash or a disk left behind —
-- frees a file only when no manifest names its hash any more, under the hash's advisory lock. A
-- publish takes the same lock (seed.media_publish; seed.media_lock before the API checks the files
-- still stand), so a publish and a sweep of the same bytes never cross.

-- ── THE ORPHANS ──────────────────────────────────────────────────────────────────────────────
create table seed.media_orphans(
  hash text primary key check (hash ~ '^[a-f0-9]{64}$'),
  orphaned_at timestamptz not null default now());
alter table seed.media_orphans enable row level security;
revoke all on seed.media_orphans from public;
-- The manifests by the hashes they name: the sweep's question, answered by index.
create index media_objects_primary_hash on seed.media_objects((doc->'primary'->>'hash'));
create index media_objects_small_hash on seed.media_objects((doc->'small'->>'hash'));
create index media_objects_large_hash on seed.media_objects((doc->'large'->>'hash'));

-- Is the hash named by any manifest still?
create function seed.media_named(hash_value text) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select exists(select 1 from seed.media_objects where doc->'primary'->>'hash'=hash_value)
    or exists(select 1 from seed.media_objects where doc->'small'->>'hash'=hash_value)
    or exists(select 1 from seed.media_objects where doc->'large'->>'hash'=hash_value);
$$;
revoke all on function seed.media_named(text) from public;

-- The hashes' locks for this transaction, taken in one order: a publish and a sweep of the same
-- bytes take turns, and the API checks a manifest's files still stand only once it holds them.
create function seed.media_lock(hashes text[]) returns void
language plpgsql security definer set search_path=pg_catalog as $$
declare ordered text[]; h text;
begin
  if hashes is null or cardinality(hashes)>8 or exists(select 1 from unnest(hashes) x where x is null or x !~ '^[a-f0-9]{64}$') then
    raise exception 'Invalid media lock' using errcode='22023'; end if;
  select array_agg(distinct x order by x) into ordered from unnest(hashes) x;
  foreach h in array coalesce(ordered,'{}'::text[]) loop
    perform pg_advisory_xact_lock(hashtextextended('media:'||h,0));
  end loop;
end;
$$;
revoke all on function seed.media_lock(text[]) from public;

-- The publish of 019, now taking the locks of the hashes it names before the insert.
create or replace function seed.media_publish(object_path text, manifest jsonb) returns jsonb
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
  perform seed.media_lock(array(select value->>'hash' from jsonb_each(manifest)));
  -- Existing paths are immutable: a signed chain's image must never silently change.
  insert into seed.media_objects(path,doc) values(object_path,manifest || jsonb_build_object('createdAt',now(),'createdBy',seed.uid()));
  return manifest;
exception when unique_violation then raise exception 'Media path already exists' using errcode='LS024';
end;
$$;

-- ── THE RELEASE ──────────────────────────────────────────────────────────────────────────────
-- The holder's document and the actor's standing for it, under the holder's lock: a community's
-- anchor or a keeper, the person themself, or staff. The holder the law named must be the path's own.
create function seed.picture_holder(object_path text, holder_kind text, holder_id text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); holder jsonb; may boolean:=false;
begin
  if actor is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if not coalesce(seed.media_path_valid(object_path),false) or holder_kind is null or holder_kind not in ('community','user')
    or holder_id is null or holder_id='' or length(holder_id)>512 or holder_id ~ '[[:space:][:cntrl:]]'
    or split_part(object_path,'/',1)<>(case holder_kind when 'community' then 'communities' else 'users' end)
    or split_part(object_path,'/',2)<>holder_id then raise exception 'Invalid command' using errcode='22023'; end if;
  if holder_kind='community' then
    select doc into holder from public.communities where id=holder_id for update;
    may:=coalesce(holder->>'anchorUid'=actor,false)
      or exists(select 1 from public.links where from_id=actor and rel='keeper' and to_id=holder_id)
      or seed.is_staff();
  else
    select doc into holder from public.users where id=holder_id for update;
    may:=holder_id=actor or seed.is_staff();
  end if;
  return jsonb_build_object('holder',holder,'may',may);
end;
$$;
revoke all on function seed.picture_holder(text,text,text) from public;

-- The facts for the law: the standing, the holder's document, and whether the manifest stands (under its lock).
create function seed.picture_context(object_path text, holder_kind text, holder_id text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare standing jsonb; manifest jsonb;
begin
  standing:=seed.picture_holder(object_path,holder_kind,holder_id);
  select doc into manifest from seed.media_objects where path=object_path for update;
  return standing || jsonb_build_object('exists',manifest is not null);
end;
$$;
revoke all on function seed.picture_context(text,text,text) from public;

-- The release: the standing re-proved, the manifest taken, each hash it named marked an orphan — the
-- sweep decides what the files become. Answers the hashes.
create function seed.picture_release(object_path text, holder_kind text, holder_id text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare standing jsonb; manifest jsonb; hashes text[];
begin
  standing:=seed.picture_holder(object_path,holder_kind,holder_id);
  if not coalesce((standing->>'may')::boolean,false) then raise exception 'Forbidden' using errcode='42501'; end if;
  delete from seed.media_objects where path=object_path returning doc into manifest;
  if manifest is null then raise exception 'Picture missing' using errcode='LS060'; end if;
  select array_agg(distinct value->>'hash' order by value->>'hash') into hashes
    from jsonb_each(manifest) where key in ('primary','small','large') and jsonb_typeof(value->'hash')='string';
  insert into seed.media_orphans(hash) select unnest(hashes) on conflict (hash) do nothing;
  return to_jsonb(coalesce(hashes,'{}'::text[]));
end;
$$;
revoke all on function seed.picture_release(text,text,text) from public;

-- ── THE SWEEP ────────────────────────────────────────────────────────────────────────────────
-- The orphans standing, oldest first, for the sweep to take one by one.
create function seed.media_orphans_due(limit_count integer) returns jsonb
language sql stable security definer set search_path=pg_catalog as $$
  select coalesce(jsonb_agg(o.hash order by o.orphaned_at, o.hash),'[]'::jsonb)
  from (select hash, orphaned_at from seed.media_orphans order by orphaned_at, hash limit greatest(1,least(coalesce(limit_count,1),1000))) o;
$$;
revoke all on function seed.media_orphans_due(integer) from public;

-- One orphan judged under its lock: 'kept' when a manifest names the hash again (the mark lifted),
-- 'free' when its file may go — the caller unlinks it in THIS transaction and settles — 'gone' when
-- no mark stands any more.
create function seed.media_orphan_take(hash_value text) returns text
language plpgsql security definer set search_path=pg_catalog as $$
begin
  if hash_value is null or hash_value !~ '^[a-f0-9]{64}$' then raise exception 'Invalid media hash' using errcode='22023'; end if;
  perform seed.media_lock(array[hash_value]);
  if not exists(select 1 from seed.media_orphans where hash=hash_value) then return 'gone'; end if;
  if seed.media_named(hash_value) then delete from seed.media_orphans where hash=hash_value; return 'kept'; end if;
  return 'free';
end;
$$;
revoke all on function seed.media_orphan_take(text) from public;

-- The mark lifted once the file is gone.
create function seed.media_orphan_settle(hash_value text) returns void
language sql security definer set search_path=pg_catalog as $$
  delete from seed.media_orphans where hash=hash_value;
$$;
revoke all on function seed.media_orphan_settle(text) from public;

-- ── THE CLOCK'S SWEEP ────────────────────────────────────────────────────────────────────────
-- A third job in the ledger of 058: the orphans freed every night, for what a release's own sweep
-- could not finish (a disk's refusal, a crash between the mark and the file).
alter table seed.clock drop constraint clock_job_check;
alter table seed.clock add constraint clock_job_check check (job in ('thirst','leaves','sweep'));
insert into seed.clock(job,due_at) values ('sweep',now());
