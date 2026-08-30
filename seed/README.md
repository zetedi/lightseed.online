# The Seed

A whole lightseed node, self-hosted: one `docker compose up` and the organism has its own
soil — Postgres, with the LIN as real tables and Row-Level Security as the rules' successor.

> The database port's first breath (ring 2026-08-31). The client-direct-with-law model —
> the app reads with its own sight, the datastore enforces — survives the crossing:
> Firestore security rules become Postgres RLS policies, translated collection by
> collection with the tests leading.

## Run

```bash
cd seed
docker compose up -d          # Postgres 16, schema applied on first boot
docker compose exec db psql -U lightseed lightseed   # walk in
```

Data lives in `seed/data/` (a mounted volume). Both `data/` and `backups/` are
gitignored — the soil is not the seed.

## Back up / restore

```bash
./backup.sh                   # timestamped pg_dump into seed/backups/, prunes after 30
docker compose exec -T db psql -U lightseed lightseed < backups/<file>.sql   # restore
```

The node's **export ceremony** (in-app, staff admin card) remains the human-readable
soul-backup: records as JSON, chains with seals verbatim. `pg_dump` is the body;
the export is the story.

## What stands now

- `docker-compose.yml` — Postgres 16 with healthcheck, schema auto-applied at first boot.
- `schema/001_collections.sql` — one JSONB table per collection the travel plan
  (`src/domain/bundle.ts` TRAVEL_PLAN) names as travelling; excluded collections have
  **no table by law** (secrets, queues, transient tokens stay behind).
  `tests/seedSchema.test.ts` keeps schema and plan mirrored — a collection added to one
  without the other fails the gate.
- `schema/002_links.sql` — the LIN as real columns. The deterministic-id law
  (`from__rel__to`) is a **generated column + primary key**: the forgery class the
  Firestore rules fight with id-binding dies here at the table definition. RLS is enabled
  with the first policies (world-readable; self-serve guardian/joined; own-hand withdrawal
  honouring the append-only rels).

## What does not stand yet (named, not hidden)

- **Auth**: `seed.uid()` reads a session setting (`SET LOCAL seed.uid = '<uid>'`) — the
  seam where GoTrue/Supabase Auth (or any JWT issuer) will plug in. No identity provider
  ships in this compose yet.
- **The full law**: only the links table carries RLS so far. The remaining ~190 rules
  translate collection by collection, the rules tests leading as the spec.
- **The API surface**: the app still speaks Firestore. The Store port
  (`src/adapters/firestore.ts` — "swap this file to swap the backend") grows to cover the
  services before the client can stand on this soil.
- **Storage, realtime, functions**: the Supabase-shaped organs (storage on a volume,
  realtime channels, edge functions for the callables) join the compose as they are ported.
- **The crossing itself**: export from Firebase → import here → uid re-anchoring
  (the bundle's census); lids are the true names and survive unchanged.
