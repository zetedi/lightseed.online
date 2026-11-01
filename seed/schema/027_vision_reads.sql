create function seed.can_read_vision(vision jsonb) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select not(vision ? 'visibility') or vision->>'visibility'='public'
    or (seed.uid() is not null and (vision->>'visibility'='node'
      or (jsonb_typeof(vision->'authorId')='string' and vision->>'authorId'=seed.uid()) or seed.is_staff()));
$$;
revoke all on function seed.can_read_vision(jsonb) from public;
create policy visions_visible on public.visions for select using(seed.can_read_vision(doc));

-- Existing JSON exports may omit or damage the creation stamp. They sort at epoch,
-- matching the application's absent-stamp fallback, without aborting an entire feed.
create function seed.vision_moment(vision jsonb) returns timestamptz
language plpgsql immutable set search_path=pg_catalog as $$
declare stamp text:=vision->>'createdAt'; parsed timestamptz;
begin
  if jsonb_typeof(vision->'createdAt')='string' and length(stamp)<=40
    and stamp ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,6})?(Z|[+-][0-9]{2}:[0-9]{2})$' then
    parsed:=stamp::timestamptz;
    if extract(year from parsed at time zone 'UTC') between 1 and 9999 then return parsed; end if;
  end if;
  return '1970-01-01T00:00:00Z'::timestamptz;
exception when others then return '1970-01-01T00:00:00Z'::timestamptz;
end;
$$;
revoke all on function seed.vision_moment(jsonb) from public;
create index visions_feed on public.visions(seed.vision_moment(doc) desc,id collate "C" desc);
create index visions_author on public.visions((doc->>'authorId'),id);
