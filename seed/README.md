# The Seed

The PostgreSQL foundation for a self-hosted Lightseed node. This does **not** yet run
the application independently: authentication, the app's data access, storage and server
actions still depend on Firebase. The design and release contract live in
[Architecture → Independent node](../root/ARCHITECTURE.md#independent-node);
the delivery sequence is in [Roadmap](../root/ROADMAP.md#independent-node-2026-10-20).

> The database port's first breath (ring 2026-08-31). The client-direct-with-law model —
> the app reads with its own sight, the datastore enforces — survives the crossing:
> Firestore security rules become Postgres RLS policies, translated collection by
> collection with the tests leading.

## Run

```bash
cd seed
cp .env.example .env
# Set SEED_DB_PASSWORD in .env to a unique generated password.
docker compose up -d --wait   # Postgres 16; wait until the database accepts connections
cd ..
npm run seed:migrate          # first installation and subsequent upgrades
cd seed
docker compose exec db psql -U lightseed lightseed   # walk in
```

Data lives in `seed/data/` (a mounted volume). Both `data/` and `backups/` are
gitignored — the soil is not the seed.
The development SQL port binds only to `127.0.0.1`, not the VPS's public interface.
Setting a new password in `.env` does not change a database initialized with an old
password; rotate that database role explicitly.

## Schema upgrades

From the repository root, `npm run seed:migrate` runs the reviewed SQL files in
`seed/schema/` through the database container's `psql`. It needs the repository's npm
dependencies installed. The files are ordered by their three-digit version prefix;
each applied filename and SHA-256 checksum is recorded in `seed.schema_migrations`.
Never edit an applied file: add the next numbered migration instead.

The runner locks out concurrent migrators and applies the pending batch in one
transaction. A SQL failure rolls back the batch. Changed/missing applied files and
gaps in history are refused. Migration files are trusted source code: use ordinary
transactional SQL, without transaction-control commands or psql commands. Operations
that cannot run in a transaction (such as `CREATE INDEX CONCURRENTLY`) need a separate,
reviewed operational procedure.

**Existing installations:** databases created by the old first-boot scripts have no
migration ledger. The runner refuses to adopt them automatically. Back up and inspect
their actual schema before a deliberate baseline; do not delete the data directory or
stamp unverified migration history. This runner supports fresh databases and databases
already managed by its ledger.

`npm run --silent seed:migrate -- --sql` prints the generated script for inspection. For a local
PostgreSQL installation, `npm run seed:migrate -- --local` uses the ordinary `PGHOST`,
`PGPORT`, `PGDATABASE`, and `PGUSER` connection settings. `SEED_PSQL` may name an absolute
psql executable; credentials should be supplied through PostgreSQL's normal protected
credential mechanism, not committed files.

`npm run test:seed` creates and destroys its own temporary PostgreSQL cluster, with no
TCP listener. Put PostgreSQL tools on PATH or set `SEED_PG_BIN` to their directory.
This tests actual schema application, idempotence, concurrent runs, failure rollback,
history drift and the command-line runner. It also tests non-owner access, private
seat isolation, permanent links and transaction-local identity cleanup. It does not
yet test full RLS parity.

## Back up / restore

```bash
./backup.sh                   # completed pg_dump into seed/backups/
docker compose exec -T db psql -U lightseed lightseed < backups/<file>.sql   # restore
```

The node's **export ceremony** (in-app, staff admin card) remains the human-readable
soul-backup: records as JSON, chains with seals verbatim. `pg_dump` is the body;
the export is the story.
Backups use owner-only file permissions and receive their final name only after
`pg_dump` succeeds. No backup is automatically deleted; review retention after testing
a restore. These dumps contain database data only, not future media/auth volumes.

## Merge preparation

`src/domain/bundleMerge.ts` prepares an additive merge proposal from a verified,
custodian-signed bundle and a complete destination snapshot. Identical records are
skipped; differing records, LID collisions and unbound identities block the proposal.
Local configuration and staff grants require separate local decisions. Derived
indexes are listed for rebuilding. UID changes and chain-head conflicts are reported,
never silently rewritten. The snapshot digest is a precondition for a future executor.

This is a pure planning function, not an importer or authorization check. It does not
enroll accounts, transfer media, execute writes or validate every record's business
rules. Those steps remain required for a working merge.

An offline command runs the same planner with real Ed25519 verification:

```bash
npm run node:merge:plan -- source-bundle.json destination-docs.json trusted-anchor.json identities.json report.json
```

Run it from the repository root. The source is a signed `NodeBundle` (the browser's
current export ZIP is **not** this format). The destination is a complete JSON array
of `{ "path": "collection/id", "data": {} }` records. The trusted anchor contains
`fingerprint` and `publicKeyB64`, resolved outside the source bundle; the fingerprint
is SHA-256 of that base64 SPKI public-key string. `identities.json` is an array of
`{ "sourceUid": "...", "targetUid": "...", "personLid": "..." }` bindings. Use `[]`
when there are no identities to bind. An identity must already be anchored in the
destination; this command cannot establish account ownership.

The report includes private record candidates, is created with owner-only permissions
and never overwrites a file. Exit status is 0 for no planning conflicts, 2 for a blocked
proposal, 1 for an input/tool error. A clear proposal is not an authorization or an
executed import. Inputs are limited to 64 MiB per file.

## Prepare independent node configuration

Copy `seed/node.example.json` to your own configuration file. Replace the placeholder
with a new UUID v7 for this node (retain that identity across restarts and upgrades),
then fill in your domains, repository and contacts. The example deliberately fails
validation until its identity is supplied; do not reuse another node's identity.
The primary face's door must match the node domain. Additional faces may declare
their own domains, but two faces cannot claim the same host.

From the repository root:

```sh
npm run seed:configure -- /path/to/independent-node.json /path/to/new-output-directory
```

The output directory must not exist. The command validates before writing and
creates owner-only `node.json`, `lightseed.json` (the public envelope) and `hosts.json`.
Only the public envelope is intended for eventual publication at
`/.well-known/lightseed.json`; keep the complete charter private. Database passwords,
mail credentials and signing keys belong in installation secrets, never this file.
An empty push public key describes a node whose push service is not configured yet.

This prepares configuration only. It does not provision DNS, mail, identity, storage
or the application. Do not set `NODE_CHARTER` to a version-2 charter for the current
Firebase build: that path deliberately refuses it. The independent app build and
full service implementation remain pending.

## What stands now

- `docker-compose.yml` — Postgres 16 with healthcheck; `npm run seed:migrate` manages schema installation and upgrades.
- `schema/001_collections.sql` — one JSONB table per collection the travel plan
  (`src/domain/bundle.ts` TRAVEL_PLAN) names as travelling; excluded collections have
  **no table by law** (secrets, queues, transient tokens stay behind).
  `tests/seedSchema.test.ts` keeps schema and plan mirrored — a collection added to one
  without the other fails the gate.
- `schema/002_links.sql` — the LIN as real columns. The deterministic-id law
  (`from__rel__to`) is a **generated column + primary key**: the forgery class the
  Firestore rules fight with id-binding dies here at the table definition. RLS is enabled
  with initial policies, tightened by `003_access_baseline.sql` below.
- `schema/003_access_baseline.sql` — enables RLS on every existing collection and
  removes PUBLIC table privileges. Unported collections deny non-owner access by
  default. Public links remain readable; only one's own `joined` insert is permitted.
  Self-service guardian insertion is blocked until the private/secret-tree visibility
  gate is ported. Own-hand withdrawal preserves all eight permanent relation kinds.
  Secret seats remain readable only by their own holder and are not client-writable.

## Create the restricted API database account

After `npm run seed:migrate`, run this from the repository root:

```sh
npm run seed:provision -- seed/runtime.env
```

The command creates a fresh, randomly named LOGIN role with a generated password.
It grants only `SELECT/INSERT/DELETE` on public links and `SELECT` on secret links;
RLS still decides which rows and operations the caller is allowed. No document-table,
schema-editing, owner, membership or RLS-bypass privileges are granted. It refuses
to provision if any application table lacks RLS. No broad default grants are installed
for future tables; each new operation needs its own reviewed grant and policy.

The password is stored in the owner-only output file, never printed or passed in a
command argument. PostgreSQL receives a SCRAM verifier. `seed/runtime.env` is ignored
by Git. Keep this file private and backed up separately from the public charter.
It contains `PGUSER` and `PGPASSWORD`; host, database and TLS settings belong to the
eventual API installation. This is a server credential, not a browser or user login.
The database dump does not include cluster roles or their passwords; preserve these
separately. Restoring a dump with grants into another cluster requires recreating the
referenced roles or deliberately restoring without those grants and provisioning new
accounts. Full identity/media/role restore is still part of the pending release proof.

Existing output files and role names are refused. Credentials are saved before the
database transaction and retained if provisioning fails: a lost connection can make
the commit outcome uncertain. Check whether that role exists before retrying. A new
output path creates a new account; it does not revoke or rotate an earlier account.
Use a dedicated node database/cluster with the repository's schema and no additional
PUBLIC grants. Authentication and the API process are still pending.

For a locally installed PostgreSQL, `--local` uses standard administrative `PG*`
connection settings and optional `SEED_PSQL` for the executable:

```sh
npm run seed:provision -- --local /private/path/runtime.env
```

Application database connections must use a non-owner role without superuser,
`BYPASSRLS`, owner membership, schema creation or `TRUNCATE` privileges. RLS does not
protect against those privileges. Do not connect an API using the Compose database
owner. SQL connections and the ability
to set `seed.uid` must remain inside a trusted server: the setting itself does not
authenticate anybody. New tables also need RLS and explicit permission tests in their
own migrations; this migration protects tables that exist when it runs.

## What does not stand yet (named, not hidden)

- **Auth**: `seed.uid()` reads a session setting (`SET LOCAL seed.uid = '<uid>'`) — the
  seam where GoTrue/Supabase Auth (or any JWT issuer) will plug in. No identity provider
  ships in this compose yet.
- **The full law**: all current collections have RLS, but only initial link policies
  grant access. The remaining ~190 rules translate collection by collection, the
  rules tests leading as the spec. Default denial is a safety baseline, not feature parity.
- **The API surface**: the app still speaks Firestore. The graph Store port now has
  one selection point (`src/services/store.ts`), and callers no longer import its
  Firestore adapter directly. Documents, sessions, media, subscriptions and server
  operations still need independent implementations before the client can run here.
- **Storage, realtime, functions**: the Supabase-shaped organs (storage on a volume,
  realtime channels, edge functions for the callables) join the compose as they are ported.
- **The crossing itself**: export from Firebase → import here → uid re-anchoring
  (the bundle's census); lids are the true names and survive unchanged.
