-- THE CROSSING'S LEDGER (ring 2026-11-02): every bundle this node took in, by its manifest hash —
-- the custodian's fingerprint, the source node, the moment, what arrived. A bundle met twice is no
-- second crossing (its records are already here, unchanged); the ledger says when it first came.
-- Written by the installation's hand alone (seed:import runs as the migration owner): the runtime
-- role has no grant here, and no row of it travels (it is this node's memory, not the bundle's).
create table seed.crossings (
  manifest_hash text primary key,
  doc jsonb not null,
  applied_at timestamptz not null default now()
);
alter table seed.crossings enable row level security;
revoke all on seed.crossings from public;
