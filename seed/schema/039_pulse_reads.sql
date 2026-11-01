-- Match strict identity equality: malformed imported numeric config UIDs are not
-- staff identities merely because their JSON text happens to match a local UID.
create or replace function seed.is_staff() returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select seed.uid() is not null and (exists(select 1 from public.admins where id=seed.uid())
    or exists(select 1 from public.config where id='superadmin' and jsonb_typeof(doc->'uid')='string' and doc->>'uid'=seed.uid()));
$$;

create function seed.pulse_tree_circle(tree_id text) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select seed.uid() is not null and tree_id is not null and tree_id<>'' and (
    exists(select 1 from public.links where from_id=seed.uid() and to_id=tree_id and rel in ('keeper','steward','observer'))
    or exists(select 1 from public.lifetrees t where t.id=tree_id and (
      (jsonb_typeof(t.doc->'anchorUid')='string' and t.doc->>'anchorUid'=seed.uid())
      or (t.doc->>'treeType'='SECRET' and exists(select 1 from public.secret_links where from_id=seed.uid() and to_id=tree_id and rel='keeper')))));
$$;
revoke all on function seed.pulse_tree_circle(text) from public;

create function seed.pulse_community_member(community_id text) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select seed.uid() is not null and community_id is not null and community_id<>'' and (
    exists(select 1 from public.links where from_id=seed.uid() and to_id=community_id and rel='member')
    or exists(select 1 from public.communities where id=community_id and jsonb_typeof(doc->'anchorUid')='string' and doc->>'anchorUid'=seed.uid()));
$$;
revoke all on function seed.pulse_community_member(text) from public;

create function seed.pulse_addressed(pulse jsonb) returns boolean
language sql immutable set search_path=pg_catalog as $$
  select coalesce(pulse->>'type'='reach' and ((pulse ? 'recipientUid' and pulse->'recipientUid'<>'null'::jsonb)
    or (pulse ? 'participantUids' and pulse->'participantUids'<>'null'::jsonb)),false);
$$;
revoke all on function seed.pulse_addressed(jsonb) from public;

create function seed.can_read_pulse(pulse jsonb) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select coalesce(case when seed.pulse_addressed(pulse) then seed.uid() is not null and (
    seed.is_staff() or (jsonb_typeof(pulse->'authorId')='string' and pulse->>'authorId'=seed.uid())
    or (jsonb_typeof(pulse->'recipientUid')='string' and pulse->>'recipientUid'=seed.uid())
    or (jsonb_typeof(pulse->'participantUids')='array' and pulse->'participantUids' @> jsonb_build_array(seed.uid())))
  else not(pulse ? 'visibility') or pulse->>'visibility'='public' or (seed.uid() is not null and (
    seed.is_staff() or (jsonb_typeof(pulse->'authorId')='string' and pulse->>'authorId'=seed.uid())
    or pulse->>'visibility'='node'
    or (pulse->>'visibility'='community' and jsonb_typeof(pulse->'communityId')='string' and seed.pulse_community_member(pulse->>'communityId'))
    or (pulse->>'visibility'='circle' and (
      (jsonb_typeof(pulse->'treeId')='string' and seed.pulse_tree_circle(pulse->>'treeId'))
      or (jsonb_typeof(pulse->'lifetreeId')='string' and seed.pulse_tree_circle(pulse->>'lifetreeId')))))) end,false);
$$;
revoke all on function seed.can_read_pulse(jsonb) from public;
create policy pulses_visible on public.pulses for select using(seed.can_read_pulse(doc));
-- Reuse the native-ISO/epoch ordering contract already used for vision history.
create index pulses_feed on public.pulses(seed.vision_moment(doc) desc,id collate "C" desc);
create index pulses_tree on public.pulses((doc->>'lifetreeId'),id);
create index pulses_vision on public.pulses((doc->>'visionId'),id);
create index pulses_author on public.pulses((doc->>'authorId'),id);
create index pulses_recipient on public.pulses((doc->>'recipientUid'),id);
create index pulses_participants on public.pulses using gin((doc->'participantUids'));
