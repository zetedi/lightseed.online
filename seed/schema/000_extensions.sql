-- The Seed's first stones. pgcrypto supplies gen_random_uuid() for hands that need it;
-- the beings' true names (lids) arrive minted by the app (UUIDv7), never by the soil.
create extension if not exists pgcrypto;

-- The asking hand. Until an auth organ (GoTrue / any JWT issuer) joins the compose, the
-- uid rides a session setting: `SET LOCAL seed.uid = '<uid>'`. RLS policies read ONLY
-- this function, so swapping the identity source later touches one place.
create schema if not exists seed;
create or replace function seed.uid() returns text
language sql stable as $$
  select nullif(current_setting('seed.uid', true), '')
$$;
