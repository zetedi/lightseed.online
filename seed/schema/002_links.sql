-- THE LIN AS REAL COLUMNS — the graph is the soul, so it crosses first and crosses whole.
--
-- The deterministic-id law (from__rel__to) that firestore.rules enforces with id-binding
-- ("authority resolves by path, so an unbound id would be forgeable") becomes SCHEMA here:
-- the id is a GENERATED column and the triple is the PRIMARY KEY. The whole forgery class
-- dies at the table definition — no policy needs to remember it.
create table if not exists links (
  from_id    text not null,
  rel        text not null,
  to_id      text not null,
  id         text generated always as (from_id || '__' || rel || '__' || to_id) stored unique,
  lid        text not null,
  doc        jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (from_id, rel, to_id)
);
create index if not exists links_to_rel   on links (to_id, rel);
create index if not exists links_rel_only on links (rel);

-- ROW-LEVEL SECURITY — the rules' successor, translated law by law with the rules tests
-- as the spec. THE FIRST BREATH ports only the self-evident clauses; every remaining
-- clause of the /links law (keeper doors, tree carers, interbeing, covenant rosters…)
-- arrives with its own test, never silently. seed.uid() is the one identity seam.
alter table links enable row level security;

-- The LIN is world-readable, exactly as `allow read: if true`.
drop policy if exists links_world_read on links;
create policy links_world_read on links for select using (true);

-- Self-serve edges: one's OWN hand may follow (guardian) and join a vision (joined) —
-- the `from == request.auth.uid && rel in ['guardian','joined']` clause.
drop policy if exists links_self_serve_insert on links;
create policy links_self_serve_insert on links for insert
  with check (from_id = seed.uid() and rel in ('guardian', 'joined'));

-- One's own link is one's own to lay down — EXCEPT the append-only provenance marks and
-- the interbeing attestations whose withdrawal law is the community's, not the uid's
-- (mirror of the delete clause's exclusion list).
drop policy if exists links_own_withdraw on links;
create policy links_own_withdraw on links for delete
  using (
    from_id = seed.uid()
    and rel not in ('invited_by', 'welcomed_by', 'party',
                    'collaborates_with', 'recognises', 'shares_resources_with')
  );

-- No client hand updates a link, ever (`allow update: if false`) — enforced by the
-- ABSENCE of any update policy while RLS is enabled.
