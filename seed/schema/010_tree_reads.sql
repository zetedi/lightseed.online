-- Staff comes from locally governed records, never an OIDC role/admin claim.
create function seed.is_staff() returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select seed.uid() is not null and (exists(select 1 from public.admins where id=seed.uid())
    or exists(select 1 from public.config where id='superadmin' and doc->>'uid'=seed.uid()));
$$;
revoke all on function seed.is_staff() from public;

-- Receives the actual row from RLS. This function returns a boolean only; callers
-- cannot fetch other users' identity/config records through it.
create function seed.can_read_tree(tree_id text, tree jsonb) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select case when tree->>'treeType'='SECRET' then
    seed.uid() is not null and (seed.is_staff() or tree->>'anchorUid'=seed.uid()
      or exists(select 1 from public.secret_links where from_id=seed.uid() and rel='keeper' and to_id=tree_id)
      or exists(select 1 from public.links where from_id=seed.uid() and rel='keeper' and to_id=tree_id))
  else
    (not (tree ? 'visibility')) or tree->>'visibility'='public'
    or (seed.uid() is not null and (tree->>'visibility'='node' or tree->>'anchorUid'=seed.uid() or seed.is_staff()
      or exists(select 1 from public.links where from_id=seed.uid() and rel in ('keeper','steward','guardian','observer') and to_id=tree_id)))
  end;
$$;
revoke all on function seed.can_read_tree(text,jsonb) from public;
create policy lifetrees_visible on public.lifetrees for select using(seed.can_read_tree(id,doc));
create index lifetrees_domain_id on public.lifetrees((doc->>'domain'),id);
create index lifetrees_anchor_id on public.lifetrees((doc->>'anchorUid'),id);

-- The secret circle reads its own ledger. Non-secret trees never use this ledger
-- to acquire authority. The existing holder-only policy remains independently valid.
create function seed.keeps_secret_tree(tree_id text) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select seed.uid() is not null and exists(select 1 from public.lifetrees t where t.id=tree_id and t.doc->>'treeType'='SECRET'
    and (t.doc->>'anchorUid'=seed.uid() or seed.is_staff()
      or exists(select 1 from public.secret_links where from_id=seed.uid() and rel='keeper' and to_id=tree_id)
      or exists(select 1 from public.links where from_id=seed.uid() and rel='keeper' and to_id=tree_id)));
$$;
revoke all on function seed.keeps_secret_tree(text) from public;
create policy secret_links_circle_read on public.secret_links for select using(seed.keeps_secret_tree(to_id));
