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
Install the API driver first with `npm ci --prefix seed --ignore-scripts`.
This tests actual schema application, idempotence, concurrent runs, failure rollback,
history drift and the command-line runner. It also tests non-owner access, private
seat isolation, permanent links and transaction-local identity cleanup. It does not
yet test full RLS parity. The suite also exercises the HTTP API, restricted-account
startup checks, session cleanup after failures and concurrent pooled requests.

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
PUBLIC grants. End-user authentication remains pending.

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

## Run the initial API

After migrating and provisioning `seed/runtime.env`, start the API profile:

```sh
cd seed
docker compose --profile api up -d --build --wait
```

The API image contains Node, the PostgreSQL driver and a JWT verifier, with no Firebase SDK or
Firebase connection. It runs as a non-root user with a read-only filesystem. Its
port binds only to loopback (`127.0.0.1:8081`); a production TLS reverse proxy and
full application sign-in are still pending. The database-only start command remains
available without this profile. API startup requires the provisioned credentials
and refuses owner, elevated, inherited-role or unsafe-schema access.

Implemented routes:

- `GET /healthz`: process liveness; does not claim database availability.
- `GET /readyz`: database connectivity and restricted-account checks.
- `GET /v1/links?to=ID` or `?from=ID`: public links only. Optional `rel`, `limit`
  (1–100; default 50) and `after` (the previous response's `next` cursor) filter/page
  results. Results contain `links` and `next`; fields identifying a link come from
  SQL columns, not conflicting JSON metadata. Pages are live reads, not snapshots.

- `GET /v1/communities`: public community documents, with `limit` (1–100,
  default 50) and `after` pagination; returns `communities` and `next`.
- `GET /v1/communities?id=ID`: one public community, returning `community`, or
  HTTP 404 with `community: null`. Lookup cannot be combined with pagination.
  IDs come from SQL, overriding conflicting JSON metadata. Invite/closed doors
  restrict joining, not public reading, matching the existing application rules.
  The independent preview now connects basic creation, editing and membership;
  the full community feature set is still being ported.
  Migration `005_community_reads.sql` and a newly provisioned runtime role are
  required; readiness checks this read grant. Existing roles are not broadened.

- `GET /v1/me`: the verified local UID, requiring authentication.
- `GET /v1/me/secret-links`: the caller's own private keeper seats, with `limit` and
  `after` pagination. No other holder's seats or full private circle are exposed.

Only profile saves are writable; other unported private routes and writes remain unavailable. Without authentication
configuration, all authorization headers are rejected. User-ID headers never set
the database identity.
Every database operation runs in a transaction, with transaction-local identity
and session cleanup before returning the connection to the pool. Failures roll back
and discard the connection. Public reads remain anonymous; private-seat reads bind the verified local identity.
Errors expose no SQL or connection details. This is an integration milestone, not
the full independent-node release; the existing browser still uses Firebase.

For local development, install with `npm ci --prefix seed --ignore-scripts`, set
`PGHOST`, `PGPORT` and `PGDATABASE` to the local database, then use Node 22 or newer:

```sh
node --env-file=seed/runtime.env seed/api/main.mjs
```

Local execution also defaults to loopback. `SEED_API_PORT` changes the listening
port; `SEED_API_HOST` is intended for container binding. Do not expose this initial
API directly on a public VPS interface. Image build and startup have now been tested
with Docker against a fresh PostgreSQL 16 database.

## Authentication trust configuration

The API verifies access tokens; it does not yet issue them or provide browser login,
registration, email verification, password reset or sign-out. An identity provider
must issue the following contract; this is not automatic compatibility with every
OIDC provider. The optional Keycloak installation below supplies a tested provider.

Set `SEED_AUTH_CONFIG` to a server-only JSON file containing:

```json
{
  "version": 1,
  "issuer": "https://identity.your-node.example",
  "audience": "your-node-api",
  "jwks": { "keys": [{
    "kty": "RSA", "kid": "your-key-id",
    "n": "REPLACE_WITH_PUBLIC_RSA_MODULUS", "e": "AQAB"
  }] },
  "bindings": [{ "subject": "provider-account-subject", "uid": "existing-local-uid" }]
}
```

This is a template, not a usable key. Use the provider's RSA public JWK (at least
2048 bits); never put a private key here. The issuer must use HTTPS. The API only
trusts these local keys: it never follows token-provided discovery/key URLs.
The default token profile requires RS256, the matching `kid`, `typ: at+jwt`, exact issuer and
single audience, `sub`, `iat`, `exp`, and the space-separated scope `lightseed:api`.
Lifetime and age are limited to 15 minutes, with five seconds of clock tolerance;
future `nbf` is enforced when present. ID tokens are not accepted as access tokens.

Bindings are explicit custody decisions: prove ownership before mapping a provider
subject to a local UID. Email matches, token UID/role claims and matching text IDs
are not identity proof. This file does not create accounts, assign staff power or
perform import merging. Restart the API after changing bindings or public keys;
removing a binding then denies its tokens. Provider logout alone does not invalidate
an already issued token: token-level revocation is not implemented.

For Docker, use a local Compose override (keep it outside Git):

```yaml
services:
  api:
    environment:
      SEED_AUTH_CONFIG: /run/lightseed-auth.json
    volumes:
      - type: bind
        source: /absolute/private/path/auth.json
        target: /run/lightseed-auth.json
        read_only: true
```

Keep the source file restricted to the operator and readable by container UID 1000.
Start with both Compose files and the `api` profile. The config is never copied into
an image or served to browsers. Missing configuration leaves public-only mode;
configured but invalid/unreadable trust fails startup. Use HTTPS at the reverse
proxy and send tokens only in `Authorization: Bearer …`, never URL parameters.

## Community founding and membership

Migration `006_community_commands.sql` adds atomic community commands. Migrate and
provision a new runtime account before replacing the API credentials. Set
`SEED_NODE_ORIGIN=https://your-node.example` in `seed/.env` for the trusted birthplace
stamp; a missing origin leaves reads and existing-community commands available but
refuses founding. Invalid configured origins fail startup.

`POST /v1/communities/command` requires a verified account with a saved local profile.
It accepts one JSON command (maximum 2 KiB):

- `create`: `name` (1–120 characters), `domain` (hostname), `door` (`open`, `invite`,
  `closed`). The server creates the LID, anchor UID, timestamps and birthplace.
- `edit`: the same fields plus `id`. Only the anchor or a keeper-link holder may edit.
  Other fields, including signing/history/authority fields, are preserved.
- `join`, `request`, `cancel`, `leave`: `id`; the actor is always the verified account.
- `accept`, `decline`, `remove`: `id` and `member`; a keeper or steward answers.

Founding serializes the configured community capacity check (default 144), excludes
actual tree-keeping circles from the count, and raises the founder's invite allowance
to at least 144 in the same transaction. Callers cannot claim a tree-circle exemption.
Membership operations serialize with door changes, are safe to repeat, and remove
steward power on departure. Anchors and keeper peers must resign before leaving;
keeper succession is available through the commands below. Unexpected failures roll back all changes.
Community rows remain unwritable directly by runtime roles, and generic link deletion
cannot bypass community membership/keeper protections.

Authenticated community lookup additionally returns `access` flags for the caller
(keeper, steward, joined, requested). The preview uses these to offer edits, joining,
requests and door management; the database independently enforces every command.
Invitations now have the separate token contract below. Complete settings, keepership
and the full application remain work in progress.

## Community role controls and trees

After migrations 009–013, provision a new runtime role and replace API credentials.
Community commands also accept `grant_steward` and `revoke_steward` with `id` and
`member`, or `resign_keeper` with `id`. Keepers delegate to members; a steward can
withdraw their own delegation. Resignation is always the caller's own: an anchor
passes to the oldest keeper link, breaking ties by UID, and refuses to leave alone.
The ACL mirror is derived from surviving links. Rooted keeper requests and invitations are available.
Use `request_keeper`/`cancel_keeper_request` for the caller’s own request, or
`accept_keeper_request`/`decline_keeper_request` with a member UID as a sitting keeper.
Acceptance requires an existing request and a qualifying anchored or co-kept tree;
beds and secret trees do not qualify. Membership, keepership and the ACL mirror
commit together, and failed acceptance preserves the request.

`GET /v1/trees` lists only readable records with `limit`/`after`, and optional `domain`,
`anchor`, `kind` (`LIFETREE`, `GUARDED`, `BED`, `SECRET`) filters. `GET /v1/trees?id=ID`
reads one record; hidden and missing trees both return HTTP 404 with `tree: null`.
Authenticated detail adds `access.editable`. RLS enforces visibility independently of
filters or headers. Legacy unstamped trees are available by ID but not anonymously
listed. Secret trees stay private even if an imported record claims public visibility.

`POST /v1/trees/command` accepts JSON up to 256 KiB:

- `plant`: `name`, `body`, `treeType` (`LIFETREE`, `GUARDED`, `SECRET`) and `visibility`
  (`public`, `node`, `private`); secrets require private. Optional `latitude` and
  `longitude` must be a valid pair, with optional `locationName`.
- `edit`: `id`, `name`, `body` and optional location fields. It cannot change the kind,
  visibility, anchor, LID, chain head or validation. Keepers/stewards and the enabled
  staff edit hand may edit; a hidden tree is indistinguishable from a missing one.

Planting requires a saved profile and configured `SEED_NODE_ORIGIN`. The server creates
identities, timestamps, genesis hashes and domain. Per-anchor quotas are transactional;
ordinary lifetrees and guarded trees use configured limits (193/132 defaults), secrets
use 12. The Root Vision shares its lifetree's birth moment and visibility with a distinct
genesis, while guarded trees receive the planter's guardian link. Secrets create no
Root Vision, public link or community. Failure rolls back the entire birth.
The preview exposes these flows; bed planting, photos/media, tree invitations, visibility
changes and chain appends are still being ported.

## Community invitations

Migration `007_community_invitations.sql` adds invitation lookup, keeper-only paginated
lists, minting, revocation and acceptance. Runtime roles need replacement provisioning.

- `GET /v1/community-invites?id=TOKEN` is public for someone holding the token.
- `GET /v1/community-invites?community=ID` requires a keeper or steward, with optional
  `limit` (1–100) and `after`. It returns `invites` and `next`.
- `POST /v1/community-invites/command` accepts `mint` with `communityId`, optional
  `label` (up to 120 characters) and `expiresAt` (UTC ISO timestamp or null);
  `revoke` or `accept` with `id`. The server supplies creator, token and timestamps.

Tokens contain 192 random bits. Revocation is irreversible; repeated revocation keeps
the original timestamp. Acceptance locks the community, checks its door and invitation,
then writes membership and append-only `invited_by`/`welcomed_by` history together.
Rejoining does not replace earlier provenance. A failed provenance write rolls back
membership. Runtime roles cannot directly read or mutate the invitation table.
The preview supports invitation creation, listing, revocation and a `/?invite=TOKEN`
door; the pending token survives sign-in in tab session storage. No mail is sent by
creating an invitation; the keeper shares its link.

## Optional local account enrollment

Migration `008_identity_bindings.sql` stores authentication bindings separately from
portable person LIDs. Provision a replacement runtime role after migrating.
The trusted API configuration may include `"enrollment": "open"` (default `"closed"`).
Only a correctly signed, purpose-bound access token reaches enrollment. An unknown
issuer subject receives a new local UID; it does not adopt an existing email/account,
portable LID, membership, validation or staff role. Saving the profile remains explicit.
The same issuer/subject keeps one UID under concurrent sign-ins and after restart.

Closing enrollment refuses new subjects while retaining existing self-enrolled logins.
`"disabledSubjects": ["issuer-subject"]` refuses those subjects on every request after
API restart. Removing an explicit reviewed binding still revokes that binding; changing
its UID conflicts with the durable record and is refused rather than relinking identity.
Backing up the database includes these local bindings; portable data merge must not
turn a foreign authentication binding into local account authority.

To open Keycloak registration on a new realm, add `--open-registration` to
`seed:identity:configure` and set matching API enrollment policy. Configure the issuer's
SMTP for verification and recovery. Reimport does not update an already-created realm;
change its registration setting through its administrator interface. Enrollment policy
is installation-level for now; automatic synchronization with a host community's closed
door and the complete account-management UI remain unfinished.

## Local profiles for bound accounts

After migration `004_profiles.sql`, authenticated accounts already present in the
reviewed subject-to-UID binding file can create their local person/profile records.
This does not enroll unknown issuer subjects, link existing accounts automatically,
create signing keys or grant membership/staff/keeper authority.

- `GET /v1/me/profile` returns `{ "profile": null }` before creation, otherwise the
  caller's `uid`, portable `lid`, and `displayName` only.
- `POST /v1/me/profile` accepts only `{ "displayName": "Your name" }` with JSON content
  type and a 2 KiB body limit. The shared person-name law normalizes whitespace and
  enforces the 60-character limit. Identity, signing and permission fields are refused.

The server generates a UUIDv7 LID on first save. Concurrent saves keep one identity;
subsequent renames preserve the LID, signing state, history and unrelated profile
fields. Person and private user display names are saved in one transaction. Existing
person UID/LID inconsistencies return a conflict requiring review, not silent repair.
The migration refuses duplicate existing person LIDs. This protects the persons
collection; a complete cross-collection LID index is still pending.

The API role has no direct read/write access to `users` or `persons`. It receives
execute permission on two narrow `SECURITY DEFINER` functions, each with a fixed
search path, qualified tables, and caller identity from the trusted transaction.
The write function serializes each account's updates and exposes no general JSON
write. Public execution is revoked; RLS remains enabled on the underlying tables.
This is a deliberate privileged operation, not an assertion that generic profile
RLS or all current profile settings have been ported.

**Upgrade existing test installations:** run `npm run seed:migrate`, then provision
a replacement runtime credential file using `seed:provision` and switch the API to
it. Existing roles are not silently broadened. API readiness now requires the profile
function grants, so an old credential file fails startup until replaced. Preserve
old credentials privately until the replacement is confirmed, then retire the old
role through the database operator. No live credentials are changed by these tools.

The independent React preview now loads and saves the bound account's display name.
It is still not the complete application. Public self-registration is disabled by default and may be explicitly enabled together
with the API enrollment policy described above.

## Self-hosted OpenID Connect provider

`seed/identity/compose.yml` runs Keycloak 26.8.1 with its own PostgreSQL database and
persistent volume. It has no application database credentials. It can issue identity
for this node without Firebase or another Lightseed node being online. OpenID login
identifies an issuer/subject pair; it does not replace a portable LID, signing-key
lineage, membership or keeper authority. Other nodes can trust it later through
explicit agreements; federation/account linking is not implemented by this setup.

Prepare a new realm for the exact application origin:

```sh
npm run seed:identity:configure -- https://app.your-node.example /private/lightseed-realm.json
```

Copy `seed/identity/.env.example` to a private `seed/identity/.env`, supply separate
random database and bootstrap-admin credentials, the HTTPS identity origin and the
absolute realm file path. Make the realm file readable by container UID 1000; the
file contains configuration only, not initial passwords or signing keys. Then:

```sh
docker compose --env-file seed/identity/.env -f seed/identity/compose.yml up -d
```

The identity HTTP port binds to loopback (8082 by default). Set up HTTPS at your
reverse proxy, keep this port inaccessible externally, and overwrite incoming
`X-Forwarded-*` headers. Use the exact configured HTTPS origin; discovery lives at
`https://identity.your-node.example/realms/lightseed/.well-known/openid-configuration`.
The identity admin console is separate from Lightseed staff permissions. Replace
the temporary bootstrap administrator with a permanent operator account and remove
the bootstrap credentials from the environment after setup, following Keycloak's
administration guidance. No production hostname, DNS or TLS is configured here.

The imported realm enables authorization-code flow with mandatory S256 PKCE for
`lightseed-web`, with only `https://app.your-node.example/auth/callback` allowed as
a redirect and the application origin as its web origin. Password grant, implicit
flow and service accounts are disabled. API access tokens last five minutes.
The default `lightseed:api` scope maps the subject and adds the `lightseed-api` audience to access tokens
only. The default `lightseed:name` scope (2026-11-01) puts the person's name and username in the
ID token alone — the application's first sign-in writes its first profile from it; the API never
reads a name from a token. Refresh tokens rotate; browser session idle/max limits apply. This initial
realm disables self-registration by default. The generator’s `--open-registration`
option enables it; configure matching API enrollment and email delivery.

In Keycloak, create a test/operator account and configure SMTP before relying on
email verification or password recovery. The realm import runs only when the realm
does not exist; changing the generated JSON does not update an existing realm.
Review later changes in the admin console or through a deliberate migration.

To connect the API, use the authentication trust file described above with:

- `issuer`: the exact HTTPS origin plus `/realms/lightseed`.
- `audience`: `lightseed-api`.
- `tokenProfile`: `keycloak`; `clientId`: `lightseed-web`.
- `jwks.keys`: the issuer's RS256 signing public keys, retaining only
  `kty`, `kid`, `n`, `e`, `alg`, `use` (omit certificate metadata).
- `bindings`: explicitly reviewed Keycloak user IDs as subjects, mapped to local UIDs.

Keycloak's access token has header type `JWT`, payload type `Bearer`, and `azp`
identifying the allowed client. The explicit profile verifies all three alongside
signature, issuer, audience, lifetime and API scope. An ID token still cannot access
the API; the generic RFC 9068 profile continues to require `at+jwt`. Public keys
remain pinned: review/copy replacement keys and restart the API during key rotation.

`npm run test:seed:identity` uses disposable accounts and containers to exercise a
real code+PKCE login, discovery, API verification, ID-token refusal, refresh and logout,
and issuer key persistence. It requires Docker and `npm ci --prefix seed --ignore-scripts`.
It never reads installation credentials. The separate React sign-in entry below uses this flow; the full existing application
has not yet been connected.
Provider logout stops refresh, but existing API access tokens remain usable until
expiry (or explicit binding removal and API restart).

Back up the identity database separately with `pg_dump` from `identity-db`; its
accounts, credentials, realm configuration and signing keys are essential to recovery.
Keep that dump private and preserve the stable HTTPS issuer address. The application
backup does not include this database. Do not delete `identity_data` during upgrades.
A full identity-database restore drill remains to be added.

Sources: [Keycloak containers](https://www.keycloak.org/server/containers),
[hostname/proxy configuration](https://www.keycloak.org/server/hostname),
[realm import](https://www.keycloak.org/server/importExport),
[OpenID Connect](https://www.keycloak.org/securing-apps/oidc-layers).

## Independent React sign-in entry

The separate `seed/web` entry builds without importing the Firebase application:

```sh
SEED_WEB_ORIGIN=https://app.your-node.example \
SEED_IDENTITY_ISSUER=https://identity.your-node.example/realms/lightseed \
npm run seed:web:build
```

The output is `seed/web-dist`. These two settings are public, not credentials.
The build fails if its module graph imports Firebase; it does not copy the existing
public directory, service worker, Firebase charter or hosting config. It requires
an exact HTTPS application origin and fixed HTTPS issuer, and the browser refuses
to run this session on a different origin.

Serve those files at that application origin through your HTTPS reverse proxy.
Route `/auth/callback` to `index.html` and proxy `/v1/*` to the independent API
(`127.0.0.1:8081` by default). Serve the HTML without caching; do not log callback
query strings. Assets use content hashes. This same-origin API setup needs no
cross-origin API credential policy. The provider's generated client must name the
same application origin and callback, and the API must have its reviewed subject
bindings and Keycloak trust configuration.

The page is explicitly a sign-in preview, not the finished node interface. It has
sign-in, authenticated status, a local display-name form and sign-out. `oidc-client-ts` performs code+PKCE,
state and nonce validation and automatic refresh. Only pending sign-in state lives
in session storage; access and refresh tokens stay in memory. Reloading the page
returns to signed-out UI; choosing sign-in can reuse the provider's SSO session.
Tokens are never sent through URLs or included in React snapshots. The callback
URL is removed from browser history before processing, and the page sends no referrer.

`services/independent/session.ts` confirms local identity through `/v1/me` and
provides authenticated same-origin reads. Failed binding, expired sessions and
renewal failure do not expose an authenticated account. Delayed identity/private
responses cannot overwrite a newer account or sign-out. Remote sign-out failure
clears local credentials and is reported. An expired provider session is not the
same as instant revocation of an already issued API token.

Tests cover session races, stale private responses, callback rejection, duplicate
initialization, token destinations and configuration. The real issuer test now also
executes the browser library's PKCE/state/callback exchange and verifies its access
token at the API. That is a protocol integration test, not an automated full-browser
journey. The existing React application and its Firebase sessions are unchanged;
complete application feature wiring and browser journey verification
remain to be completed.

## Build the application itself for the independent node

Since 2026-11-01 the ORIGINAL application (not only the preview above) builds for this soil:

```sh
SEED_WEB_ORIGIN=https://app.your-node.example \
SEED_IDENTITY_ISSUER=https://identity.your-node.example/realms/lightseed \
npm run build:independent
```

The output is `dist-independent/`. The build resolves the whole service layer (`@backend`) to
`src/services/independent`, builds no SSO door, and fails if any Firebase module reaches the
bundle. Serve it exactly as the preview: the HTML at the application origin, `/auth/callback`
to `index.html`, `/v1/*` proxied to the API. What the node has not grown yet refuses by name
when asked ("This node has not grown that yet"); `seed/PARITY.md` counts those hands.

## Serve the node behind TLS (the edge)

`seed/Caddyfile` and the `edge` profile put one TLS reverse proxy in front of the node: the
built application at `SEED_APP_HOST` (every door — `/b/<lid>`, `/i/<id>`, `/auth/callback`,
`/events` … — serves the shell), `/v1/*` to the API on the same origin, and the identity
issuer at `SEED_IDENTITY_HOST`. The issuer's compose joins only the shared `lightseed_edge`
network, never the application database's.

```sh
# seed/.env: SEED_APP_HOST, SEED_IDENTITY_HOST, SEED_TLS=acme, SEED_ACME_EMAIL, SEED_NODE_ORIGIN, SEED_FACE_DOORS (optional)
SEED_WEB_ORIGIN=https://$SEED_APP_HOST SEED_IDENTITY_ISSUER=https://$SEED_IDENTITY_HOST/realms/lightseed npm run build:independent
cd seed && docker compose --profile api --profile edge up -d --build --wait
docker compose --env-file identity/.env -f identity/compose.yml up -d   # after the edge created the network
```

On a VPS the certificates come from ACME: `SEED_ACME_EMAIL` must be set, ports 80/443 open,
and both hosts must resolve to the machine. For a local walk set `SEED_TLS=internal`,
hosts under `.localhost` (`seed.localhost`, `identity.localhost` — Chrome resolves them to
loopback) and ports such as `SEED_EDGE_HTTPS_PORT=8443`; Caddy is then its own certificate
authority. Trust its root (`docker compose cp proxy:/data/caddy/pki/authorities/local/root.crt .`)
or bypass the warning per host. Under Docker Desktop (macOS) give the database a NAMED volume
in a local override instead of the `./data` bind mount, which breaks `initdb` on ownership. The
API is reached by the browser only through the edge; its own port stays on loopback.

## Reproduce the Docker proof

With Docker running and the repository's npm dependencies installed:

```sh
npm run test:seed:docker
```

This uses the real Compose file and CLI tools with an isolated, random project name,
a disposable named volume, generated credentials, and an automatically assigned
loopback HTTP port. It never mounts `seed/data`, reads installation credentials, or
opens a database port. Use a Compose version supporting the `!override`/`!reset` tags
(tested locally with Compose 5.4).

It builds the image; installs and reruns migrations; provisions the restricted account;
tests signed-token authentication, own-seat isolation, HTTP pagination and refusal
of unported/private/write/forged-identity requests; verifies
non-root, read-only and Firebase-free runtime; refuses an owner login; stops the
database and verifies readiness failure without losing liveness; restarts both services
and checks recovery/data survival; and restores a dump into a separate empty database.
Cleanup removes only the test project's containers, volume and local API image. If
cleanup fails, the command reports the project and private temporary directory for
inspection. Ordinary Docker base-image/build caches may remain.

The restore check uses `--no-owner --no-acl` and verifies data, not full deployment
recovery. Identity-provider state, roles/grants, media and credentials still need
their own restore workflow. This test is an API milestone, not full feature parity.

## What does not stand yet (named, not hidden)

- **Auth lifecycle**: signed access tokens now bind to transaction-local identity,
  but account linking/recovery, per-token revocation and full application session
  integration remain unfinished. An optional Keycloak provider now exists.
- **The full law**: all current collections have RLS, but only explicitly ported profile, community, tree and link operations
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


### Shared keepership offers

After migration 013 and replacement runtime provisioning, `/v1/communities/command`
accepts `offer_keeper` with community `id` and recipient `member`, then
`accept_keeper_offer` or `decline_keeper_offer` with community `id` and `inviteId`.
Only a sitting keeper offers; only the recipient accepts. The sender or recipient
may decline a pending offer. Acceptance checks rooted standing again and commits
keeper/member links, permanent welcome provenance and the accepted mark together.
Existing welcome provenance is preserved. Repeated pending offers from the same
sender reuse the offer; accepted/declined offers cannot reopen.

Signed-in `/v1/keeper-invites?mine=true` derives the recipient from the verified
session. `?community=ID` lists a community's pending offers. Both support bounded
`limit` and `after` pagination. Signed-in collection visibility matches the existing
Firebase rule; direct writes remain denied. The preview offers keepership from its
member list and shows personal and community invitation lists.


### Tree keeper succession

Migration 014 adds `POST /v1/trees/command` with
`{"action":"resign_keeper","id":"TREE_ID"}`. The session identifies the departing
keeper; callers cannot name another person or choose the successor. The anchor
passes to the oldest remaining keeper seat, with UID as a deterministic tie break.
A secret tree considers both its private seats and legacy public keeper links,
counting duplicate seats once and removing all departing/promoted duplicates.
Non-secret trees ignore private seats. The last keeper cannot resign; staff alone
cannot resign or appoint keepers. Failed transfer rolls back completely.

Provision replacement runtime credentials after migrating. Generic keeper-link
withdrawal is denied so it cannot bypass the transaction. The preview shows the
resign control only for a keeper, independently of edit access. This does not yet
implement tree invitations or signed succession blocks.


### Tree invitations and circle admission

Migration 015 adds `/v1/tree-invites/command`. `mint` takes `treeId`, `role`, and
`open`: an open invitation omits `member`; a named invitation requires it. Optional
`message` and ISO `expiresAt` are bounded. Keepers/staff offer any allowed role;
stewards offer only guardian/observer roles. Secret trees allow only keeper seats.
`claim`, `accept`, `decline` and `revoke` take only `id`; the session supplies the actor.

An open token is 192 random bits. `/v1/tree-invites?id=TOKEN` permits a held-token
lookup while open, pending and unexpired; revoked, expired or claimed capabilities
are no longer public. Authenticated `?mine=true` and `?tree=ID` lists use bounded
`after`/`limit` pagination and per-row authority; an open token does not expose a
public invitation ledger. Direct collection access remains denied.

Claim and acceptance are separate: claim reserves one recipient, acceptance checks
qualification again. Guardians must anchor a living lifetree. The validation dial
counts accepted guardian links; ordinary guardian acceptance creates no community.
Other roles on a non-secret tree create/reuse its circle and membership atomically.
Secret trees write keeper seats to the private ledger and create no public circle.
Failed acceptance preserves the pending invitation and rolls back all side effects.
Welcome provenance preserves its first mark. Revocation/decline cannot reopen an offer.

The independent preview supplies personal invitations, tree invitation management,
and `?treeInvite=TOKEN` links retained through sign-in. Provision a replacement API
role after migrating. The HTTP/database journeys are tested; real-browser verification
and the complete original application's integration remain outstanding.


### Public person names

Migration 016 adds `/v1/people?id=UID` and paginated `/v1/people?q=NAME` (optional
`after` and `limit`, maximum 100). Names come from the public person collection;
search is case-insensitive literal substring matching, not SQL/wildcard input.
Results contain only `uid`, `lid` and `displayName`, with UID bound to the SQL row ID.
Private `users` records and unrelated person metadata are never returned. Direct
runtime access to both tables remains denied. The preview's tree and community
keeper invitation forms now select people by name. This is not a complete public
profile or portable-identity resolver. Replace runtime credentials after migration.


### Forming a community from a tree circle

Migration 017 adds `{"action":"form_circle","id":"CIRCLE_ID","name":"Name"}`
to `/v1/communities/command`; `name` may be omitted to keep the circle's name.
A circle keeper or a keeper of its root tree may form it exactly once. The root
must exist and cannot be secret. Formation preserves the anchor, LID, links, domain
and chain state, sets public visibility, and records `formedAt`/`formedBy` from the
transaction. The normalized root-tree domain supplies `bornOn`, not an address claim.
The preview shows this control using the API's `canFormCircle` access flag.

The API retries database-only transactions at most twice when PostgreSQL explicitly
aborts them with a serialization failure or deadlock. Each attempt restores the
verified identity in a fresh transaction. Connection loss, application refusals and
uncertain commit outcomes are not retried. Runtime provisioning needs replacement
after migration 017, as for the preceding command grants.


### Public/private person identity consistency

Migration 018 replaces the profile-save function while preserving its grants.
New accounts store the same UID and portable LID in `persons` and private `users`.
Saving an existing consistent person fills a missing private mirror. Conflicting
UIDs/LIDs, or an imported private LID with no person record, refuse the write with
`identity_needs_review`; the operation does not invent a new identity or change the
name first. Signing state and unrelated imported fields remain unchanged. Existing
records are not rewritten in bulk: incomplete imports require deliberate reconciliation.


### Local image storage (migration 019)

The API accepts JPEG, PNG and WebP uploads up to 12 MiB at `POST /v1/media/upload`.
Use a verified bearer token, the image MIME type, and `X-Lightseed-Media-Path` with
an immutable path such as `users/<local-uid>/<unique-name>.png`. Own user/person
paths and community anchor/keeper paths follow canonical identity and links;
shared collaboration paths allow signed-in writers. Staff authority is local database
state. Reserved derivative paths and traversal are refused.

The API re-encodes images (maximum 1600 px), strips metadata and creates 480/1200 px
WebP variants before publishing the manifest. Decoding is bounded to 80 million
pixels and two concurrent encoders. Existing paths cannot be overwritten. The
response includes primary and variant URLs. Reads are **public**, including images
whose referring tree is private, matching the existing Firebase storage contract.
Do not present these image URLs as private resources.

`SEED_MEDIA_DIR` must be absolute; Compose configures `/app/media` on `media_data`.
The process verifies each stored object's size and SHA-256 before serving it and
refuses symbolic links. Without a media directory, media routes return 503.
Back up this volume together with the database; a database dump alone cannot restore
pictures. Full coordinated backup/restore is not implemented yet. Failed publication
can leave unreferenced blobs; release, reference tracking and garbage collection are
pending. The independent browser session provides binary upload transport, but the
original application's attachment flows are not yet connected.


### Tree picture arrangement (migration 020)

`set_pictures` on `/v1/trees/command` accepts a tree ID and an ordered `paths` list
of up to 100 distinct published images. Tree edit authority is rechecked under a
row lock. The server derives `imageUrls` and its first-image `imageUrl`; callers
cannot supply arbitrary URLs or authority. Empty lists remove the display pictures.
Signed growth fields and chain history are preserved. Removal detaches a picture;
it does not erase the stored bytes. The preview lets editors upload, arrange and
save these pictures. Imported external URLs remain intact and cannot yet be edited
through this panel. Other profile/community attachment flows remain pending.


### Personal appearance pictures (migration 021)

`POST /v1/me/profile` also accepts `{action: "set_picture", slot, path}` with
`slot` equal to `siteLogoUrl` or `siteHeroUrl`. `path` names an already published
local image; explicit `null` clears the slot. The verified caller is the account
being changed. A saved profile with consistent public/private UID and LID is
required; conflicting imported identities refuse the write. Other private settings
and signing data remain unchanged. Own-profile reads project these two settings;
public person-name lookup does not expose private appearance settings.

The preview can upload, replace and detach a personal logo or banner. Image bytes
remain publicly readable and are not deleted when detached. This does not yet
implement identity-provider avatars, appearance palettes/inheritance, public profile
pages, or the original application's complete appearance UI.


### Complete graph read shapes

Public `/v1/links` accepts `from`, `to`, or a standalone `rel` filter. Queries stay
bounded and use the same deterministic link-ID cursor. `/v1/me/secret-links` binds
its source to the verified caller. `/v1/secret-circle-links?to=<tree>` requires an
authenticated reader authorized by `seed.keeps_secret_tree`; it never grants
circle access merely because a caller supplies a UID or holds an unrelated edge.
Missing and inaccessible circles both return 403. RLS still filters returned rows.

`src/adapters/independent.ts` implements all five graph read operations with full
pagination and backend-neutral timestamps. It rejects malformed pages, repeated
cursors and identity changes across a multi-page request. It composes with the
existing graph service, including secret/public seat deduplication. This is a read
adapter, not the complete Store: graph writes require their remaining relationship
commands, and the main application still selects the Firestore adapter.


### Graph care writes (migration 022)

`POST /v1/links/command` accepts `{action, from, rel, to}`. The verified session,
not `from`, supplies authority. `link` permits one's own `joined` edge or a guardian
edge on an existing non-private, non-secret tree. Repeated creation preserves the
original LID and timestamp. No weight, provenance, timestamp or role-grant fields
are accepted. Keeper/member grants and invitation provenance retain their separate
transactional commands.

`unlink` permits one's own joined/guardian/observer/tree-steward edges. A tree's
keeper can also release a guardian. Community stewardship cannot be removed by this
route; its membership command remains authoritative. Tree rows are locked while
checking permissions and applying changes. The preview exposes following and
self-withdrawal. Remaining relationship types and staff-specific minting permissions
still require their own implementation before the full Store write adapter can ship.


### Community attestations (migration 023)

The link-command endpoint also accepts `collaborates_with`, `recognises`,
`shares_resources_with` and `accepts_coin_of` between two distinct existing
communities. The source community's anchor or canonical keeper can create or
withdraw only that direction. Stewards and forged keeper mirrors confer no right.
Local staff minting follows the `link_mint` switch; staff deletion remains the
existing repair permission. Duplicate creation retains its original LID and time.

Both communities are locked in deterministic order. The reverse statement is
independent and survives withdrawal of the first; reciprocity is derived by the
existing domain function, never stored as a status or used for authority. The
preview displays each direction and lets source keepers add or withdraw it.


### Trees in community gardens (migration 024)

The graph command supports `grows_in` from an existing tree to an existing community.
A tree's anchor, keeper or steward may place it in an open-door garden. A community's
anchor, keeper or door steward may welcome it regardless of the door. Local staff
placement respects `garden_stand`. Secret trees cannot be placed, including by staff.
The tree's carers or the community's door-keepers can withdraw the link; staff retain
withdrawal for repair. The tree and then community are locked during the decision.

Placement preserves the original tree document, domain, ownership, chain and privacy.
A garden link does not grant access to a private tree, or membership in the community.
Duplicate placement retains its original link identity and timestamp. The tree preview
provides placement/withdrawal controls; main-application forest integration remains.


`GET /v1/trees?garden=<community>` lists linked guest trees with normal pagination
and row-level privacy filtering. Beds and secret trees are excluded even if imported
links incorrectly place them in a garden. Legacy public trees without an explicit
visibility field can appear through this explicit public reference, as in the existing
per-ID garden reader; they remain excluded from unscoped anonymous discovery.
The community preview displays this guest forest without granting any new tree access.


### Tree keepership requests (migration 025)

Tree commands now support `request_keeper` and `cancel_keeper_request` for the
verified caller, and `decline_keeper_request` / `answer_keeper_request` with a
named `member`. An answer also specifies a keeper/steward/guardian/observer `role`.
It creates a pending invitation and removes the request atomically. The invitation
command retains all role restrictions; accepting remains a separate recipient action.
A failed invitation leaves the request intact. Asking creates no keeper seat or
private-tree access. Repeated requests retain their original identity and timestamp.

Secret-tree requests are stored in `secret_links`, readable only by their author and
that tree's authorized circle; reaffirming one's request removes a legacy public copy.
Other tree requests retain the existing public ledger behavior. A requester may ask
about a known private tree ID without gaining the right to read that tree. Keepers
and local staff may decline; stewards may answer only with roles they can invite.
The preview exposes asking, withdrawing, declining and offering a role.


### Tree participation markers (migration 026)

The graph command accepts `participant` from a tree to a target entity ID. The
source tree's anchor or canonical keeper may add/withdraw its marker; a steward
cannot enlist it. Local staff creation follows `link_mint`, while staff withdrawal
retains repair authority. Secret trees cannot be enlisted. Creation is idempotent
and preserves the original LID and time. This marker grants neither target access
nor membership, and does not modify the source tree or its chain.

`GET /v1/trees?participating=<entity>` returns a bounded participant list through
normal tree RLS, excluding beds and secret trees. Explicit participant references
can resolve legacy public trees, as in the existing per-ID participant reader.
The target ID remains opaque, matching the current graph rule; this is not target
existence validation, an admission ticket or an atomic event-capacity reservation.
Full event/vision lifecycle and their original UI integration remain pending.


### Vision reads (migration 027)

`GET /v1/visions` supports bounded newest-first listing and filters for domain,
author, root tree (`tree`) and joined-link source (`joined`). `id` selects one vision.
Visibility matches the existing vision rules: public, signed-in node, own author,
or local staff. Tree circle membership and joined links never unlock a private
vision. Legacy visions without visibility are directly readable by ID; broad lists
include them only for their author or staff.

Cursors preserve six fractional timestamp digits and break ties by ID, preventing
closely timed visions from disappearing between pages. Valid ISO creation stamps
are normalized for ordering; missing, malformed or unrecognized timestamp encodings
sort at epoch. Imported timestamp-object normalization remains part of import work.
The preview lists and reads visions and supports joining/leaving through the existing
graph command. Complete vision appearance, contributions, release,
public rendering and original-app integration remain to be ported.

### Vision creation and editing (migration 028)

`POST /v1/visions/command` accepts `create` or `edit`, title, body and visibility;
`edit` also requires the vision ID. The server stamps author, node domain, UUIDv7
identity and reproducible v0 genesis at birth. Edits lock the record and preserve
identity, attribution, grounding, pictures and chain fields. Only the author or
local staff can edit; hidden and missing targets share one response. The preview
supports creation and author edits. Provision replacement runtime credentials after
migration. Community grounding resolution, pictures, contributions and release
remain separate work; this does not yet replace the original app's vision service.

### Vision pictures (migration 029)

The vision command also accepts `set_pictures` with an ID and up to 100 distinct
published local media paths. Author/staff authorization is checked under a row
lock; missing images reject the entire update. The server derives the ordered
`imageUrls` and first `imageUrl` while preserving all chain and attribution fields.
An empty list clears the pictures without deleting media bytes. The preview shares
the tree picture uploader/editor and displays vision pictures. Pictures remain
public even on private visions; imported external references cannot yet be edited
in the preview. Run migrations and provision replacement runtime credentials.

### Vision release (migration 030)

`POST /v1/visions/command` with `action: "release"` and `id` removes an author's
vision (local staff may also release it). Hidden/missing records return the same
404. Incoming public links are removed only when the caller meets the existing
withdrawal policy; other people's joins and participation links can remain.
The record and permitted cleanup commit atomically. Contribution pulses, signatures,
outgoing links, private ledgers and media bytes are untouched. The preview requires
an explicit release confirmation. This does not implement contribution minting or
media garbage collection. Migrate and provision replacement runtime credentials.

### Public signing-key anchoring (migration 031)

`POST /v1/signing/command` accepts only `action: "anchor"` and `publicKeyB64`
(canonical Ed25519 SPKI). The authenticated local UID chooses the person; a consistent
saved profile is required. First publication atomically appends its fingerprinted
lineage record and server-timed anchor event. Existing legacy keys may be anchored
only with the same key. Retries preserve dates, current epochs and frozen state;
a different key or inconsistent imported history requires review. A missing lineage
record may be repaired only against a consistent existing epoch.

`GET /v1/signing-identity?id=UID` exposes only public signing identity fields, never
private profile data. Private keys and recovery phrases are not accepted by the API.
The session adapter exposes the command, but browser key custody, freeze, cross-signed
rotation, witnessed recovery and history pagination remain unfinished. These routes
alone do not enable signed contributions. Migrate and provision a replacement runtime
account; existing accounts do not automatically receive the new function grants.

### Signing-key freeze and public history (migration 032)

`POST /v1/signing/command` also accepts `action: "freeze"`, the observed `epochId`
and `fingerprint`, and optional integer `suspectedSinceMs`. Account authentication
is sufficient to stop a lost/compromised key. The command locks the identity,
refuses stale epochs, appends one server-timed freeze event and preserves key material
and prior history. Repeating a consistent freeze is a no-op. The optional compromise
time must fall between anchoring and receipt; it is stored as `claimedSuspectedSince`,
not as the witnessed `suspectedSince` used to dispute earlier signatures.

`GET /v1/signing-history?id=UID&kind=events|keys` returns public lineage pages with
`items` and `next`, using `after` and `limit` (1–100). It does not expose recovery
proposals or witnesses. Consumers verifying signatures must collect the required
history and recheck the current identity rather than treating one page as complete.
The preview shows key status and an explicit freeze confirmation. Browser key creation,
rotation and witnessed recovery remain unfinished. Migrate and replace runtime grants.

### Cross-signed key rotation (migration 033)

`POST /v1/signing/command` accepts `action: "rotate"`, `eventId`, stable `lid`,
`fromPubkey`, `toPubkey`, both fingerprints (`fromFingerprint`, `toFingerprint`) and
`oldSig`/`newSig`. Both Ed25519 keys must sign the existing fixed-field key-rotation
preimage bound to the authenticated UID. The API checks canonical encoding,
fingerprints and both signatures before invoking the restricted SQL apply function.
That function trusts the API's proof verification, as it trusts its authenticated UID;
database runtime credentials must never be distributed to browsers or end users.

The transaction locks the person and refuses a stale or frozen outgoing epoch, missing
lineage, reused incoming key or event ID. It appends the new key and rotation event,
retains all old history and switches the current epoch atomically. Concurrent requests
cannot both replace the same key. The session adapter can submit the command; browser
key custody/rotation UI and witnessed recovery remain unfinished. Run migrations and
provision replacement runtime grants before using this endpoint.

### Recovery proposals (migration 034)

Authenticated `GET /v1/me/signing-recovery` returns the frozen identity's authoritative
recovery claim (`uid`, `lid`, `fromFingerprint`, `suspectedSinceMs`). The boundary is
validated against immutable epoch/freeze events and normalized to milliseconds for
the existing recovery preimage. Invalid or inconsistent imports require review.

`POST /v1/signing/command` accepts `action: "begin_recovery"`, `eventId`, `toPubkey`,
`toFingerprint` and `newSig`. The candidate key signs that recovery claim, including
its event and new fingerprint. Verification runs while the identity is locked; only
then may the restricted SQL apply function append an open proposal. A reused key or
event refuses. The current key stays frozen, and no new key epoch is activated.

Authenticated members can read one proposal with
`GET /v1/signing-recovery?id=UID&event=EVENT`; anonymous requests cannot. Witness
collection, quorum activation and browser key custody remain unfinished, so opening
a proposal alone cannot recover signing. Migrate and provision replacement grants.

### Recovery witness collection (migration 035)

`POST /v1/signing/command` accepts `action: "witness_recovery"`, `targetUid`,
`eventId`, `sig`, `pubkey`, `keyFingerprint` and `epochId`. The caller cannot witness
their own recovery. The API locks identities/proposal, checks the witness's current
active epoch and lineage, verifies the UID-bound witness signature and appends an
immutable witness record. Identical retries preserve the original receipt.

Eligibility requires a governed initiation or keepership of a validated rooted tree;
stewardship and staff status alone do not qualify. Initiation/tree/keeper facts are
locked through publication. BED and SECRET trees never confer witness authority.
This closes the existing Firebase eligibility helper's anchor-query omission, which
fails to exclude those kinds despite the project's rootsABeing law. No original
Firebase code or rules are changed here; that discrepancy remains for parity review.
Witness collection never activates the replacement key. Quorum activation, bounded
witness-list reads and browser custody/recovery UI remain unfinished. Migrate and
provision replacement runtime grants.

### Recovery quorum activation (migration 036)

`POST /v1/signing/command` accepts `action: "activate_recovery"` and `eventId`.
The signed-in target cannot supply witness counts, key material or dates. The API
locks the frozen identity and proposal, re-verifies the candidate signature, and
requires three distinct witness UIDs with valid signatures, current active anchored
keys and current initiation/rooted-tree eligibility. Changed, frozen, ineligible or
malformed witnesses do not count. This matches the existing account-based quorum;
it is not a proof that accounts represent three distinct physical people.

Selected witness/person records and eligibility facts stay locked through activation.
The restricted SQL apply function rechecks those selected IDs, appends the fresh key
and `recover` event, updates the current identity and marks the proposal activated in
one transaction. Old keys, freeze events and witness receipts remain. The witnessed
compromise boundary is now recorded as `suspectedSince`; no old event is rewritten.
Concurrent activation attempts cannot create multiple epochs. Browser custody and
recovery UI, bounded witness-list reads and original-app integration remain unfinished.
Migrate and provision replacement runtime grants.

### Device key custody in the preview

The preview can create a key, display its 24-word phrase, require backup confirmation,
and publish only the public key. Restoration checks that a phrase matches any current
published key. A frozen key stays frozen. Keys are non-extractable CryptoKey records
in origin-scoped IndexedDB, additionally separated by UID and stable person LID.
Seeds/phrases are not persisted or sent to the API. Local key possession is verified
with a disposable signed challenge before the device is shown as ready.

The key is durably stored before publication; an uncertain network result can be
retried without generating a replacement. Multiple unpublished candidates require an
explicit saved phrase to select one. Restoring can repair the device copy of that
same public key. Account changes and replaced person identities cancel pending work.
The preview also prepares replacement keys, requires their new phrase to be backed up,
and signs rotation with both keys. It stores the replacement and public retry receipt
before sending the command. Reload can resume the same candidate and event; a lost
success response is reconciled against the published key. Old keys are retained.
Frozen keys, changed accounts/person identities, conflicting replacements and damaged
candidate keys refuse rotation. Recovery candidate custody is described below; the
full original-app signing flow remains unfinished.

`node scripts/preview-seed-custody.mjs` starts a disposable loopback-only browser check
at a fresh port. Open its printed address and use its reload button to verify actual
IndexedDB persistence, private-key export refusal, signing, scope isolation and
idempotent saves and interrupted rotation resumed after reload. It uses synthetic keys, deletes its test database after passing,
and removes temporary files when stopped. This checks storage, not a full OIDC
create/restore journey against the Docker node.


### Recovery witness reads

Migration `037_recovery_witness_reads.sql` adds authenticated
`GET /v1/signing-recovery-witnesses?id=UID&event=EVENT&limit=50&after=ID`.
Pages contain `items` and `next`, ordered by bytewise witness ID, with limits 1–100.
Only recorded witness identity, epoch, public key/fingerprint, signature, version and
receipt time are exposed; extra imported fields are excluded. Missing proposals give
an empty page, and witnesses for another person or recovery cannot cross the filter.

These are historical receipts, not a count of eligible people or permission to
activate: multiple epochs may belong to one account, and keys or eligibility may
have changed. Activation still verifies three distinct current eligible accounts
and their signatures under locks. Apply migrations and provision replacement runtime
grants before running this API version.


### Recovery device custody in the preview

A frozen account can prepare a new key without possessing the compromised key. It
must save the new phrase before opening a recovery. The browser saves the candidate
and public signed proposal receipt before sending it, so reload retries the same
event. It checks the server's frozen context and verifies candidate proofs. Matching
already-recorded proposals reconcile lost responses; active replacement identities
reconcile activation responses. Account/person changes cancel pending actions.

A recovery code lets members review the target account, candidate fingerprint,
claimed compromise time and paginated recorded witnesses. Witnesses explicitly
confirm their review before signing with their current device key. The API still
checks eligibility and current epochs. Owners must possess the candidate locally
before activation, or restore its matching phrase; restoring does not activate it.
The API alone decides whether three currently eligible distinct accounts qualify.

`node scripts/preview-seed-recovery.mjs` exercises the actual preview controls with a
synthetic account, real IndexedDB and a simulated API. Its first proposal request
fails deliberately, allowing confirmation/reload/retry checks. Its witness list and
activation are simulated: it does not prove real quorum, OIDC or server permissions.
PostgreSQL/Docker suites cover server proof verification and eligibility separately.

The PostgreSQL suite additionally exercises the real session and device-custody
services through authenticated HTTP with a disposable signed-token issuer: first-key
publication, rotation, freeze, candidate proposal, initially ineligible then eligible
witnesses, and activation. Lost successful responses for rotation/proposal/activation
are reconciled without duplicate epochs. That test uses an in-memory key store;
actual IndexedDB persistence is covered by the separate browser checks above.


### Shared domain rules in the Docker runtime

`npm run seed:domain:build` compiles `src/domain/seedChainRuntime.ts` into the ignored
`seed/generated/chain.mjs` artifact. The Docker builder runs this compilation from
source and copies only the standalone output into the runtime; esbuild stays in the
builder. The compiler rejects dependencies outside `src/domain/` or unresolved
runtime imports, keeping SDKs, services and credential loaders outside this boundary.

The entry exports the existing birth/signature/hash/watering rules and touch-memory
helper without changing them. A separate Node-process test checks compiled behavior
against source behavior, including private-tree visibility, unauthorized mint refusal
and hash/signature bytes. This supplies the chain laws for the independent mint;
transactional minting and visible-history reads are described below; original-app integration remains.

The independent image runtime pins sharp 0.35.5, which includes the upstream librsvg
patch described in [GHSA-wq5f-xc86-pv6w](https://github.com/advisories/GHSA-wq5f-xc86-pv6w).
SVG decoding is also blocked before image inspection: this API accepts only JPEG,
PNG and WebP. Raster re-encoding and immutable media storage remain unchanged.


### Atomic tree and vision chain minting

Migration `038_block_mint.sql` adds authenticated `POST /v1/blocks/command` with
`{action:"mint", on:"tree"|"vision", id, block, signature?}`. The shared chain law
judges allowed content and visibility. The server reads chain ownership/keeper/steward
standing, named staff hands and the current signing identity under transaction locks.
A published active key requires its Ed25519 signature over normalized content and
the observed head; frozen keys refuse all minting. A partially imported published
identity refuses rather than silently producing an unsigned block. Accounts with no
published key retain the existing unsigned-birth behavior.

The server chooses the ID, LID, author, timestamp, domain fallback and canonical hash.
Appending the pulse and advancing the head happen in one transaction, together with
latest-growth, last-care and watering schedule updates. Prior touched fields are
remembered outside the hash for the existing unmint model; this endpoint does not
implement unmint. AI confirmation remains an asserted annotation, matching the
existing birth law; it grants no human-witness light.

Competing unsigned appends follow one serialized chain. A signed request for an old
head returns `block_head_moved`; clients must refresh and review/sign again. An
uncertain unsigned response must not be blindly retried, since it may have committed.
Only confirmed database deadlock/serialization rollbacks are automatically retried.
SQL apply capabilities are available only to the trusted API role, like signing-key
proof application; database runtime credentials are not browser credentials.

Apply migrations and provision replacement runtime grants. Browser signed minting,
offering/alignment twin mints and wider event/light consequences remain separate work.
Existing Firebase mint/unmint code is unchanged.


### Visible pulse history (migration 039)

`GET /v1/pulses?id=ID` reads one visible record; absent and inaccessible records both
return 404. Lists accept conjunctive `tree`, `vision`, `community`, `author`,
`recipient`, `participant`, `type` and `domain` filters, plus `limit` (1–100,
default 50) and the returned opaque `after` cursor. Unknown or repeated parameters
are refused. Newest-first pagination preserves timestamp microseconds and ID ties;
filters never grant access. Runtime SELECT is constrained by PostgreSQL RLS.

Public/node/community/circle rules use the authenticated identity and current links.
Addressed reaches require author, recipient, participant or staff authority even
when their imported visibility says public. Malformed participant fields cannot
open a private message. Legacy records without visibility remain readable directly
under the legacy policy, but do not enter anonymous broad discovery.

The separate tree/vision preview omits reaches and tree chats from its timeline and
can compare a stored record with its canonical content hash. This is not full-chain
or author-key-lineage verification: inaccessible predecessors may legitimately be
missing. `scripts/preview-seed-history.mjs` exercises pagination and intact/altered
hash feedback with synthetic transport; PostgreSQL and Docker tests separately prove
server access restrictions. Original-application subscriptions remain unfinished.


### Browser review and signed growth

`src/services/independent/blockMint.ts` reads the current profile, published identity
and bearer before preparing a signature with the origin/UID/LID-scoped device key.
The shared birth law normalizes the content; this client-side preparation grants no
authority. The node still rechecks permissions, signing state and head under locks.
Frozen, stale and absent device keys refuse preparation. Inputs and the review are
copied so subsequent form edits cannot alter the prepared request.

The preview exposes title/body growth and optional tree watering through an explicit
review and submit step. Each prepared attempt is consumed before submission, including
when the response is lost: it is never automatically retried or re-signed. The user
must inspect history before another attempt. Tests exercise signature compatibility,
immutable review content, account changes, cancellation and uncertain responses.
The real authenticated API integration test now exercises this service with a recovered
device key: accepted canonical growth, competing-head refusal, unauthorized authors
and a committed-but-lost response with no replay. `scripts/preview-seed-mint.mjs`
checks the actual form, IndexedDB key and WebCrypto signature in a browser using
synthetic transport, including success and uncertain-response feedback. These are
separate proofs; a complete OIDC-to-browser-to-PostgreSQL journey remains to be
verified. Other block forms and original-app integration are still outstanding.


### Offering acceptance and paired-record privacy

The independent domain bundle exports the existing `judgeOfferingAccept` and pure
`offeringTwinRecords`. The latter constructs reciprocal references and receives its
prose from the server adapter. `seed/api/offerings.mjs` prepares two canonical sealed
records from transaction facts, using separate predecessor heads and stable birth
IDs. These are server agreement seals, not participant signatures; no light moves.
Tests compare tree and vision record shapes with the existing Firebase implementation
and check both parties' standing, closed offerings, dead receivers and height limits.

Migration 040 now implements the locked context and atomic apply capability used by
`database.acceptOffering`. Tree rows lock in deterministic order, followed by the
vision row and both parties' authority links. The apply capability checks reciprocal
references, authors, heads and heights before appending both records and recording
the answer. Concurrent acceptance creates one pair; a failure writing the answer
rolls back both records and both heads. Runtime users have no direct pulse writes.

`POST /v1/offerings/command` accepts only `{action:"accept", id}` with a verified
session. The node derives both parties, bearer IDs and standing itself. The independent
session exposes `offeringCommand`. The preview lists visible offerings with pagination,
reloads a selected offering before review, and requires explicit confirmation before
acceptance. Account snapshots guard stale reviews; uncertain replies are not replayed.
Refreshing shows an already-recorded answer. Offering creation and editing are available through the API and preview forms described below.
Apply migrations and provision replacement runtime grants.

Migration 041 adds a restrictive read policy for paired offering records. Ordinary
readers need the record's visibility plus access to both named bearers; a private
tree requires circle standing, not guardianship alone. Missing bearers close this
ordinary-reader path. The recorded offerer and acceptor retain access to both twins,
including private records and after bearer removal, by the accepted offering's exact
stored twin IDs. A copied document ID cannot borrow that access. Staff retain their
existing authority. The stored content and seals stay unchanged.

This closes a discrepancy in the existing Firebase acceptance function, which copies
the offering visibility onto both records without checking disclosure of the named
counterpart. PostgreSQL and authenticated HTTP tests cover public labels with a
private vision, both private circles, guardian refusal, forged IDs and party access.


`scripts/preview-seed-offerings.mjs` checks the real acceptance component with synthetic
transport: review, success, lost response and refresh without duplicate submission.
This is separate from authenticated API/PostgreSQL authorization and transaction tests;
it does not prove a complete OIDC browser journey. The current preview offers review
to signed-in nonauthors; the server remains authoritative about recipient standing.


### Atomic offering creation (migration 042)

`seedOfferingCreation` validates drafts for beds, services, code and products, including
whole positive appreciation, detail URLs, complete source/receiver references and
bounded distinct picture paths. Attribution, answer fields, chain heads and seals
cannot arrive in a draft. `prepareOfferingBirth` uses the compiled existing offering
law and legacy standalone hash algorithm, deriving names from trusted context and
binding the record to the authenticated author and node domain.

The exact birth preimage is returned separately as `birthProof`, not on the public
mutable listing. Migration 042 stores it in `seed.offering_birth_proofs`, with RLS and no runtime table
read/write grants. Future export must preserve its birth privacy boundary: retelling
a private offering and later opening it must not expose old text through verification
metadata. No public proof-export endpoint exists yet.

`POST /v1/offerings/command` now accepts `action:"create"` with `kind`, `title`, `body`,
positive whole `appreciation`, optional `url`, `bedId`, `paths`, and `visibility`
(public/node/private, default public). A directed offering supplies all of `toKind`
(tree/vision), `toId` and `fromTreeId`. Client attribution, names, answers and seals
are refused. The node derives those from locked records and the verified caller.

Source and bed references require current carer or staff authority; a bed must be a
BED record. Recipients must exist and be readable by the author. Pictures must be
published local manifests. References to private/secret beings require a private
listing, preventing names from escaping through a public draft. Current receiver
carers can read an addressed private offering and find it in their offering list.

The listing, protected proof and private reach notice to the recorded receiving
keeper/author commit together. Failure inserting the notice rolls everything back.
A standalone listing or self-directed offering needs no notice. Creation never
advances a bearer chain. The notice is a stored private reach; mail/push delivery,
protected proof export remains unfinished. Listing lifecycle commands are described below.


### Offering lifecycle (migration 043)

The same offering command endpoint now accepts `edit`, `set_active`, `withdraw` and
`decline`. Edits take `id`, `title`, `body`, whole positive `appreciation`, `url`,
`visibility` and optional `paths`; omitting paths preserves existing pictures, while
an empty array clears them. Author or staff may edit until acceptance; kind, bed,
source, recipient, attribution, birth hash and protected proof never change. A code
offering still needs its URL. References to private beings cannot become public by
editing the listing.

Only the author may change `active`, including after an answer. Only the author can
withdraw an open addressed offer. Current recipient carers (or staff) can decline an
open offer, including while paused; the author cannot decline their own offer.
Withdraw/decline and acceptance serialize on the offering row, so one final answer
wins. No existing twin, head or protected proof is rewritten by these commands.

The preview has pause/reopen and confirmed withdrawal for authors, and decline in
the recipient review. Paused offerings disable acceptance but still permit decline.
The synthetic browser fixture checks those controls; PostgreSQL tests cover proof
preservation, authority changes and withdrawal/acceptance races, and Docker exercises
the HTTP lifecycle. Creation and edit forms are described below.


### Offering creation and edit forms

The preview supports service, bed, code and product drafts, optional bed references,
standalone listings and addressed tree/vision offers. Named selectors paginate through
visible beings; source/bed selectors use `/v1/trees?editable=true`, which filters by
current edit authority under RLS and admits authorized legacy keeper trees. That
filter never supplies identity or bypasses visibility. Choosing a private reference
makes the draft private before submission; the server rechecks current privacy.

Pictures can be uploaded, ordered and removed; they remain public media even for a
private offering. Prose edits preserve pictures when unchanged. Imported references
remain intact unless the user explicitly replaces all pictures. Editing reloads the
record first and cannot change its kind, bed, source or recipient. Accepted records
have no edit control. The browser fixture verifies named choices, private-reference
creation and later prose editing using synthetic transport; full OIDC/browser/API
journeys and imported-picture fine-grained editing remain outstanding.


### Alignment negotiation and acceptance (migrations 044–045)

`POST /v1/alignments/command` requires a verified session. Commands:

- `propose`: `fromTreeId`, `targetPulseId`, optional `initiatorPulseId` (defaults to
  the existing `PENDING_CREATION` sentinel). Target tree/account come from the matched
  pulse. Both current carers are checked; the match and target must be readable.
- `note`: `id`, trimmed `text` of 1–2000 characters. Either recorded participant may
  append while pending; the server supplies attribution/time. Prior notes stay intact.
- `reject`: `id`. Only the recorded recipient may answer, once, while pending.
- `accept`: `id`. The recipient and proposer must still carry their distinct trees.
  Paired sealed records, heads and answer commit atomically. No automatic retry,
  participant signature, appreciation or light transfer is implied.

`GET /v1/alignments` supports `id` alone, or `tree`, `participant=me`, `target=me`,
`status=PENDING|ACCEPTED|REJECTED`, `limit` (1–100) and the returned precise `after`
cursor. Row policies admit recorded participants and staff; anonymous lists are empty
and hidden direct records return 404. Staff read access does not grant consent to
accept/reject or author notes. `session.alignmentCommand` validates and sends once.

Paired records preserve existing content shape, but a public label cannot disclose a
private counterpart. Ordinary readers must see both trees; exact stored participants
retain their records even after a bearer disappears. These are intentional security
improvements over the original Firebase alignment path. Tests cover canonical seals,
current authority, private negotiation, reciprocal disclosure, duplicate acceptance,
rejection races and late-write rollback. The separate preview now supplies named tree/pulse choices, private notes, paginated
history and explicit acceptance/rejection reviews. Submissions guard account changes
and consume the review before sending; uncertain responses require refresh, never
automatic replay. `scripts/preview-seed-alignments.mjs` exercises the actual component
with synthetic transport, including a lost acceptance response. Original-app wiring
and complete OIDC browser journeys remain unfinished.


### Event duplication (migration 046)

`POST /v1/events/command` accepts `{action:"duplicate", id}`.
`session.eventCommand` validates and submits once. The server locks the source event,
profile and current authority: its author, a keeper of its existing community, or staff.
The copied fields match the existing event callable. A fresh author/LID replaces the
old identity; counters reset, and participation, signatures and formed-circle state
are omitted. Date span, pictures, links, place and visibility are preserved.

The copy, protected `seed.event_birth_proofs` entry and permanent `descends_from` link
commit atomically. Neither the source nor any tree head changes. The protected
preimage is not exposed on the mutable record or readable by the runtime database role.
Future exports must preserve its original privacy boundary. The lineage link follows
the existing world-readable graph contract; event content remains visibility-filtered.
Creation, editing, adoption and circle formation are described below. Unit, PostgreSQL and authenticated HTTP tests cover record shape,
current standing, private event reads and rollback when the lineage write fails.


### Event creation, editing and community adoption (migration 047)

`POST /v1/events/command` also accepts `create` and `edit` drafts. Both require `title`
and `body`; optional fields are `eventDate`, `eventEndDate`, `eventLocation`,
`eventMaxParticipants` (positive integer or null), `webLinks` (up to twelve URL/label
rows), `visibility` and ordered published-media `paths`. Editing additionally requires
`id`. Omitted picture paths preserve current/imported pictures; `[]` clears them.
Only published local media can be newly attached. Pictures retain the existing public
media contract even if the event text is private.

A standalone birth is available to a signed-in account with a local profile. A
`communityId` birth requires that community's current keeper or staff. Names, authorship,
place and seals come from locked records and node configuration. Node-scoped drafts
allow public/node/private; community-scoped drafts allow public/community/private.
Shared span/link laws reject invalid date ordering and normalize external links.
The event and its protected birth proof are one transaction.

An event's author, current community keeper or staff may edit its words. Hash, proof,
author, LID, original root and lineage stay unchanged. Chain-bearing or signed records
cannot be edited through the standalone event path. Adding `communityId` to an unplaced
event is a one-way adoption: the actor must keep that exact community and its domain
must equal the event's existing domain. Existing community placement cannot change;
authorship alone cannot adopt. The original birth proof remains protected even if a
later edit opens the event publicly.

Unit, PostgreSQL and authenticated HTTP tests cover scoped authority, published pictures,
private reads, adoption, preserved proof/identity, and rollback when proof insertion fails.
Event browser controls, deletion policy and original-app integration
remain unfinished.


### Event circles (migration 048)

`POST /v1/events/command` accepts `{action:"form_circle", id, name?}`.
Event-circle preparation compiles the existing `judgeEventCircle`,
`eventCircleDraft`, `eventCircleMemberUids` and `rootsABeing` laws into the independent
runtime. `prepareEventCircle` deduplicates participating trees, excludes beds/secret
trees, derives account membership from current anchors and preserves the one-circle-
per-lineage behavior. New circles explicitly set `door: invite`: the legacy invited
visibility label is not the independent membership gate. Reusing a remembered circle
requires an existing event-circle record bound to the same root event.

Formation serializes with ordinary community founding and locks lineage events,
current host authority and captured participant trees/links. The community, member and
participant links, and lineage memory commit atomically. Gathering into a missing or
unrelated remembered circle refuses. Captured participants are rechecked under locks;
new participation arriving afterward is included by a later explicit gather. Repeated
calls reuse the circle and add only missing links. Stored relationships are LIN links.
The former grants membership to the participating trees' anchors; this is not evidence
of their consent, and members can leave. Another explicit gather may add them again,
as in the existing event-circle contract. PostgreSQL tests cover competing formation,
node capacity, current authority, malformed host references and complete rollback.
The disposable Docker test also exercises formation and repeat gathering through the
authenticated API, then restart and database restore. Browser controls and original-app
integration remain unfinished.

### Portable-name lookup (migration 049)

`GET /v1/beings?lid=<UUIDv7>` resolves a local visible being to
`{being:{kind,id,lid}}`; absent and unreadable records both return 404 with
`{being:null}`. The only query field is `lid`. Invalid bearer tokens still refuse.
Supported kinds are tree, vision, community, pulse and person. Person lookup uses
the public person identity projection, never private accounts. Light Houses remain
unavailable until their access contract is ported.

Ordinary record reads run under the restricted runtime role and existing RLS,
including secret-tree and paired-record privacy. The lookup returns no content,
private profile fields or extra visibility. Multiple visible matches return 409
`identity_needs_review`, without choosing a winner or returning candidate addresses.
Invisible collisions are not disclosed; this is not a global uniqueness audit.
Non-unique database indexes make existing/imported records searchable immediately;
changes and removals cannot leave a stale secondary registry. This does not implement
immutable registry bindings, staff backfill/audit, federation, identity reconciliation
or the original application's `/b/<lid>` navigation. PostgreSQL/HTTP tests cover privacy,
account switching, malformed requests, duplicate identities and current-record lookup.

### The document door (migrations 050–053)

Every document hand of the application reaches the independent node through one door:
`GET /v1/docs/<collection>` (`id`, `parent`, `f.<field>`, `has.<field>`, `in.<field>`,
`order=newest`, `after`, `limit`) and `POST /v1/docs/command` (create, set, update, delete,
love). The law of `firestore.rules` is translated collection by collection into SQL rule
functions (`seed.rule_<collection>`), the row-level SELECT policies call the same `list`
rule, and `seed.doc_write` locks the row and judges every write with the Firestore-shaped
patch (server time, delete, array union/remove, increment, dotted keys, set-merge, `expect`
for optimistic checks). Node-local records that never travel (push subscriptions, bed holds)
live in the `seed` schema. `tests/seedDocs.test.ts` holds the registry to the SQL map;
`tests/seed/documents.postgres-test.ts` proves the refusals through the API.

### The organs (migration 054)

The server hands `functions/src/index.ts` kept for the origin node, grown here as
context/apply pairs the API drives (facts read under locks → the pure domain law from the
shared runtime bundle → one apply in the same transaction):

- `POST /v1/light/command` — `witness` (the circle confirms a watering; the carer's ray and the
  witness's seventh are born with the confirmation), `appreciate` (a receiver's light to the
  offering it received), `spend` (a passed purchase decision, its seal re-verified), `reset`
  (the node's keeper alone).
- `POST /v1/blocks/command` `{ "action": "unmint", "pulseId" }` — the head taken back under
  `domain/unmint`, the block's touch on the tree lifted.
- `POST /v1/staff/command` — `grant_admin` / `revoke_admin`, the superadmin's hand.
- `POST /v1/account/command` — `delete_mine` (optionally `heirUid`: the last spend through the
  prism) and `delete_as_staff`; content, light, profile and the login binding go in one transaction.
- `POST /v1/domains/command` — `start_verification` / `check_verification` (the anchor's TXT proof,
  observed by the node), `start_door` / `check_door` / `grant_door` / `withdraw_door` / `list_doors`.
  `SEED_FACE_DOORS` (comma-separated hostnames) names this node's face doors: a keeper's claim on
  one waits for the steward's grant (staff hand `door_grant`) instead of a DNS proof.

The node's keeper is appointed by the installation, never by a public first-visitor claim:

```bash
npm run seed:keeper -- <uid>            # against the Compose database
npm run seed:keeper -- <uid> --replace  # a standing keeper is replaced only on purpose
```

`tests/seed/organs.postgres-test.ts` walks every refusal through the API.

### The crossing (migration 055, `seed:export` / `seed:import`)

A node leaves by its travel plan (`src/domain/bundle.ts` TRAVEL_PLAN) and arrives at another
by additive merge (`src/domain/bundleMerge.ts`). Both run as the migration owner through the
`PG*` environment (the same hand that runs `seed:migrate --local`), never as the API's role.

```bash
# On the source node: the custodian's Ed25519 key (PKCS#8 PEM) stays outside the node.
npm run seed:export -- --charter node.json --key custodian.pem [--without-authority] bundle.json
# → bundle.json (owner-only) and bundle.json.anchor.json (the PUBLIC anchor: hand it over by another road)

# On the receiving node: plan first, then apply.
npm run seed:import -- bundle.json --anchor bundle.json.anchor.json --identities identities.json --report plan.json
npm run seed:import -- bundle.json --anchor bundle.json.anchor.json --identities identities.json --apply
```

What the law guarantees: the bundle carries exactly the travelling collections (census and
per-record hashes, the beings index as a witness computed from the body), sealed by the
custodian over the manifest; the importer verifies structure and seal, plans inside one
serializable transaction under the crossing's advisory lock, lands every planned record in
that transaction or nothing, and records the crossing in `seed.crossings`. Identical records
are idempotent; a differing record, a LID collision or an unbound identity blocks the whole
proposal; `admins` and `config` never merge (export `--without-authority`, or decide locally).
An identity is anchored on the far side by a person record carrying the same LID, or by a
login the installation bound to that uid by reviewed configuration (an explicit binding in the
auth trust file) — then the person arrives with the import. Not carried: media files, queues,
quotas, credentials, challenges (the travel plan's exclusions, said out loud in the plan).
`tests/seed/crossing.postgres-test.ts` exports from one database and lands it in another.

### The mail organ (migration 056)

How letters leave this node. The origin node writes a `mail` document the Trigger Email
extension sends and lets Cloud Functions answer document events; here one organ does both
halves (`seed/api/mail.mjs` over `seed/schema/056_mail.sql`, the words from `domain/mailLetter`):

- **The hands** — `POST /v1/mail/command`: `send_system` (the node composes the letter from
  plain words and an optional http(s) link, in the voice of the place whose door the hand stood
  at — `domain` names it; twenty a day for every hand but staff, counted in `seed.usage`),
  `send_newsletter` (the community's keeper, or staff for the node's own place: one letter per
  active subscriber at the place with its own unsubscribe token and `List-Unsubscribe` headers,
  the place stamped in the same transaction), `status` (the sender's own letter's delivery:
  `PENDING` → `PROCESSING` → `SUCCESS` | `ERROR`, the extension's shape).
- **The public doors** — `POST /v1/invite-requests` (a stranger asks for an invitation; a pending
  invitation or request for the address answers first) and `GET|POST /u/<token>` (one-click
  release by token alone; the edge proxies `/u/*`).
- **The effects** — triggers of a request's own write (never the crossing's import or the owner's
  repairs) leave rows in `seed.outbox`: a reach (the recipients' letters, once per thread per
  recipient inside ten minutes, opt-out honoured, and the push knock on their devices), a join
  request (the keepers' knock: anchor and stewards, six at most), the first profile (the welcome).
  An accepted network invitation mints `welcomed_by`, and — only when the inviter belongs to the
  node community — `member` and `invited_by`, inside the acceptance itself (`seed.lid()` mints the
  true names).
- **The courier** — every few seconds (`SEED_COURIER_INTERVAL_MS`, 15 s) the API process composes
  due effects from facts the context functions read, lands their letters in one transaction, then
  carries due letters over SMTP, settling each: success rests, a failure waits (1, 2, 4, 8 minutes,
  an hour at most) and gives up after five attempts, out loud. Letters' words leave the queue after
  thirty days; an effect older than a day is retired, never delivered late.
- **The address a login carries** — a token whose issuer verified the address (`email` +
  `email_verified`) has it remembered on the account (`seed.record_login_email`), never matched as
  identity; the realm law adds the `lightseed:email` scope to the access token for this.

Configuration (the charter is the node's name and sender; the couriers are secrets):

```bash
# seed/.env — the charter directory seed:configure wrote (node.json inside), and the footer's postal line
SEED_CHARTER_DIR=/private/lightseed/charter
SEED_MAIL_POSTAL="Your registered postal address"
# seed/runtime.env — beside the database credentials
SEED_SMTP_URL=smtps://user:password@smtp.example:465      # or smtp://host:587 (STARTTLS required)
SEED_VAPID_PRIVATE_KEY=…                                     # the pair's public half is the charter's push.publicKey
```

Without a charter the organ is not grown and every letter refuses by name (`mail_unavailable`);
without `SEED_SMTP_URL` the hands refuse the same way while the push knock still goes. The
issuer's own mail (verification, password recovery) is the realm's: `npm run
seed:identity:configure` reads `SEED_IDENTITY_SMTP_URL` and `SEED_IDENTITY_SMTP_FROM` into the
realm's `smtpServer`. `tests/seed/mail.postgres-test.ts` walks every door with an SMTP and a push
stand-in; the local walk catches real letters in Mailpit (`seed/compose.local.yml`).

### The AI organ (migration 057)

How a model is reached on a hand's behalf. The origin node proxies Gemini and Claude through
two callables and keeps provider keys under Cloud KMS; here one organ does both
(`seed/api/ai.mjs` over `seed/schema/057_ai.sql`, the rails in `seed/api/aiRails.mjs` on the
same SDKs the functions use, the law in `domain/aiRequest`, the words in `domain/aiPrompts`):

- **The hand** — `POST /v1/ai/command` `generate`: a transcript (text, pictures as base64), the
  voice, a provider (`google` | `anthropic`), a model, `json` / `image` asks and, optionally, the
  credential the chosen intelligence draws on. The node decides WHOSE KEY answers: a kept
  credential the hand may spend (its own; a community's as member, anchor or staff — opened in
  the API for the length of one call), else the node's own key, which is a member benefit
  (staff always; everyone when `config/limits.nodeAiValidatedOnly` is `false`; else an initiate
  or the anchor of a validated tree) counted by the day in `seed.usage` — 21 texts and 3
  pictures, an image model or an image ask counting as a picture. The model is asked outside the
  transaction; its failure speaks by name (`ai_key_rejected`, `ai_rate_limited`, `ai_failed`),
  the day counted either way, as the origin counts before it calls.
- **The keeping** — `save_credential`: a key is sealed in the API (AES-256-GCM under
  `SEED_CREDENTIAL_KEY`, bound to its row name) before it touches the soil, kept in
  `seed.provider_credentials`, hinted back (`…last4`) and mirrored onto an intelligence the hand
  may write (its author, or staff). An empty key removes. No route ever returns a key; a dump of
  the table yields ciphertext.
- **The shell** — every model hand of the application (`gemini.ts`, `intelligence.ts`) speaks
  through this door with the origin's routing: the listener's chosen intelligence first, the
  node's Claude then the node's Gemini as last resort.

Configuration (three secrets, all in `runtime.env`):

```bash
# seed/runtime.env — beside the database credentials
SEED_ANTHROPIC_API_KEY=sk-ant-…                   # the node's own Claude (claude-sonnet-5 by default)
SEED_GEMINI_API_KEY=AIza…                         # the node's own Gemini (gemini-3.5-flash; images gemini-2.5-flash-image)
SEED_CREDENTIAL_KEY=$(openssl rand -base64 32)    # the key under which hands' and places' keys rest; keep it with the backups
```

Without any of the three the organ is not grown and every model call refuses by name
(`ai_unavailable`); without `SEED_CREDENTIAL_KEY` keys cannot be kept (`credentials_unavailable`)
while the node's own keys still answer; without a node key for a provider only kept keys answer
on that rail (`ai_key_missing`). Losing `SEED_CREDENTIAL_KEY` loses every kept key: each must be
entered again. `tests/seed/ai.postgres-test.ts` walks the gate, the counters, the keeping and
every refusal with rail stand-ins; the real rails are the providers' SDKs.

### The clock (migration 058)

The node's own rhythm. The origin node runs two hands on Cloud Scheduler — the morning thirst
check and the nightly stay leaves; here the API process keeps a ledger and runs them itself
(`seed/api/clock.mjs` over `seed/schema/058_clock.sql`, the law in `domain/clock`,
`domain/thirst`, `domain/stayLeaf`):

- **The ledger** — `seed.clock` holds one row per job (`thirst`, `leaves`) with its due moment, a
  lease, and the last run's outcome and report. Every minute (`SEED_CLOCK_INTERVAL_MS`) the clock
  takes what is due and unleased, runs it, and settles the next due moment: 08:00 for the thirst,
  03:00 for the leaves, in the installation's zone (`SEED_CLOCK_TIMEZONE`, the origin's
  `Europe/Brussels` by default; daylight-saving changes cross without a lost or doubled run). Two
  API processes never run the same job at once (the lease, ten minutes); a job the node slept
  through runs at the next tick, once. A fresh node runs both at its first tick.
- **The thirst** — every tree on a watering schedule past its due moment is marked `overdue`, the
  quenched cleared; once a day, when someone besides its anchor would hear, the tree asks its
  circle (keepers and guardians, both ledgers) through its principal with its own face — the
  standing ask rewritten so a week of thirst is one line that keeps count, else a new reach in the
  guardians' thread, in the origin's words. Where the mail organ is grown the ask rides the outbox
  to the courier (letters and knocks); where it is not, the ask stands in the thread alone.
- **The leaves** — every accepted stay departed before today becomes a permanent leaf on its bed's
  chain: the origin's record field for field, wearing the guest's chosen tree face only ("A guest"
  when none), sealed with the canonical hash in the API and applied under the bed's lock — head
  re-checked, the bed's height advanced, the stay marked `leafed`, all in one transaction. A head
  that moved in between refuses (LS032) and the next tick seals anew.
- **The planting caps' backstop** — the soil itself refuses a tree over its keeper's ceiling at the
  insert (193 lifetrees, 132 guarded, 12 secret, `config/limits` respected), through any door; the
  origin uproots the newborn afterwards. Staff plant freely; the crossing's import is not a planting.

```bash
# seed/.env — optional; the origin's zone and a minute's tick are the defaults
SEED_CLOCK_TIMEZONE=Europe/Brussels
SEED_CLOCK_INTERVAL_MS=60000
```

`tests/seed/clock.postgres-test.ts` moves the clock's moment by hand across days and asserts the
ledger, every thirst outcome, the leaf's hash against the shared chain law, and the caps. To see a
run on a live node: `UPDATE seed.clock SET due_at=now()` as the owner and read the row a minute later.

### The face of the node (migration 059)

What the node says to whoever stands at it without signing in — the origin's four hosting-rewrite
functions (being card, face picture, sitemap, face feed) on this soil (`seed/api/face.mjs` over
`seed/schema/059_face.sql`; the law in `domain/facePage`, `domain/facePreview`, `domain/faceEvents`;
`seed/Caddyfile` proxies `/b/*`, `/face/*`, `/sitemap.xml` and `/faceEvents` to the API):

- **The being card** — `/b/<door>` hands everyone the same built shell with its head meta (title,
  description, canonical, Open Graph, Twitter) swapped to a PUBLIC being's own name, words and
  picture, so a shared link unfurls as the being and a search engine indexes it; a human's shell
  boots and opens the door as before. The being is read as a stranger reads (the runtime role under
  the row policies, no session) and the origin's card gate is applied on top; anything not public, or
  unknown, is the unmodified shell. The shell comes from disk: Compose mounts the built application
  (`SEED_APP_DIST`) read-only into the API at `SEED_SHELL_DIR=/srv/app`. A public Light House carries
  a JSON-LD Place with its coordinates. The card names its place (the community at the being's domain).
- **The face picture** — `/face/<door>.jpg?v=<digest>` is the small JPEG behind the card (≤250 KB,
  ≤1200 px, the origin's ladder), made once from the node's own media by path or from a foreign
  `https` picture — whose address is looked up first and refused at any loopback, private,
  link-local or reserved range, no redirect followed, bounded in size and time — and kept under
  the media directory (`previews/<lid>/<digest>.jpg`; a new picture is a new digest and a new URL).
  Every miss, and every render beyond two at once, answers a redirect to the node's `og.png`.
- **The sitemap** — `/sitemap.xml` lists home and every explicitly public tree, Light House and
  vision as `/b/<lid>`, newest first, 500 at most. (`robots.txt` in the independent build still
  names the origin's sitemap: a build-time item, see PARITY.)
- **The face feed** — `/faceEvents?domain=<face>` answers a mother site (CORS open) with the cradle's
  public AND node gatherings — a visitor at the face is at the node — shaped to the origin's seven
  fields by the shared law, soonest first; `seed.face_events` is the server-only door behind it.
- **The edge stands in** — should the API answer 5xx or nothing at all, Caddy serves the plain shell
  at `/b/*` and `og.png` at `/face/*` itself: never a broken page, never a leaked name.

The face is grown when the node knows its origin (`SEED_NODE_ORIGIN`); the host that enters a card's
URLs is only one the node serves (its origin, `SEED_FACE_DOORS`, the charter's domains), any other
collapses to the node's own. `tests/seed/face.postgres-test.ts` walks every door against real
PostgreSQL through the API with no bearer anywhere.
