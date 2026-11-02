# ARCHITECTURE: how it currently lives

The current organism: systems, boundaries, data flow, interfaces.

When architecture drifts from implementation, the code reveals the CURRENT
BEHAVIOR, not necessarily what the community intended, what life needs, or
what should happen next. When behavior drifts from the root or from lived
reality, the contradiction must be surfaced and consciously resolved. Sometimes
experience reveals the flaw before a test does; sometimes a vulnerable person
sees the danger before the maintainer understands the code; sometimes a tree
dies while every gate remains green. No layer is supreme in isolation.

## Stack

React 19 + TypeScript (full strict) + Vite + Tailwind, as a PWA
(`vite-plugin-pwa`, prompt-style updates via `UpdateToast`). Firebase: Firestore
(`ignoreUndefinedProperties: true`), Auth (dynamic authDomain per hosted domain),
Storage, Functions, multi-site Hosting (`app` → lifeseed-75dfe, `perauset`).

**The charter (ring 2026-09-06).** `node.json` at the repo root says what THIS node is: its
lid, name, domain and aliases, keeper, mail, push public key, Firebase project / bucket /
region / web config, and its faces (hosting target, site, the door each wears, custom
domains). The law is `src/domain/charter.ts` (validation and every derivation: the hosts a
face answers at, the origin, the public envelope, the hosting targets); `functions/src/
charter.ts` mirrors it and reads `functions/src/charter.json`; `scripts/charter-sync.mjs`
writes that copy, `public/.well-known/lightseed.json`, `.firebaserc` and the hosting entries
of `firebase.json`; `tests/charter.test.ts` holds mirror and copies true, and `npm run check`
refuses a tree out of step. Nothing in `src/` or `functions/` names the node by heart any
more. `scripts/create-node.mjs <charter> [--apply]` walks a charter to a living node — project,
web app, database, sites, secrets, sync, three deploys, custody — and says out loud the steps
only a console can take. Other nodes the same code runs as keep their charters under `nodes/<id>/node.json`;
`NODE_CHARTER=nodes/<id>/node.json` makes the sync, the build and create-node act AS that node,
and `FIREBASE_ACCOUNT=<email>` makes the CLI act as the node's own account (after
`firebase login:add`). The shell reads the generated `src/config/charter.json`, never the root
file directly, so a checkout can be built for any charter it knows.
Leaflet is bundled from npm, lazy-loaded on first map render (`services/leaflet.ts`).

## Independent node

**Release contract (2026-10-20).** A fresh node on a VPS, run with Docker Compose,
with every current feature and no Firebase runtime dependency. It must also export
and import into an existing node by merging. A database-only container or a
reduced-feature application does not satisfy this contract. The current Firebase
deployment remains supported during the migration.

### Intended deployment

The node owns its identity service, PostgreSQL database, media and background work.
A TLS reverse proxy serves the existing React application and its API. The node's
charter names its identity, domains, faces and backend without requiring a Firebase
project, bucket or Hosting site. Credentials belong to the installation, not the
public charter or browser bundle.

The server verifies the identity provider's issuer, audience, expiry and signature.
The authenticated identity is bound to each database transaction and cleared before
a pooled connection is reused. A browser cannot choose `seed.uid()`. Request-serving
roles must not own tables or bypass Row-Level Security; migration credentials are
separate. Unported operations remain inaccessible rather than inheriting broad
database permissions.

Domain laws stay shared. Backend-specific adapters implement persistence, sessions,
media, subscriptions and server operations. The build selects the implementation at
the application's composition boundary, including the SSO entry point. No independent
operation may fall back to the origin node's Firebase project.

Chain append verifies the actor and signing state, reads/locks the head, validates
and seals the block, and advances the head in one transaction. LIN relations remain
entities; private keeper seats remain private. Firestore triggers become explicit
transactional work or durable jobs. Retries must not duplicate chain records,
settlements or notifications.

`functions/src/index.ts` is the inventory of server responsibilities to preserve:
keys and recovery; invitations and keeper succession; domain and door proofs;
chains and agreements; care and light; beds and occupancy; events and circles;
accounts and SSO; media and variants; mail and push; intelligence and quotas;
LID indexes, previews, feeds and sitemap. Optional mail/AI providers still need
configuration; absence must be reported without borrowing another node's credentials.

### Merging and identity

Import is additive and reviewed, not a database replacement. A bundle's custodian
signature is checked against a key trusted outside the bundle. Identical records are
idempotent; changed records and conflicting LIDs require resolution. Local authority,
configuration and staff grants are not inherited from an export. Derived indexes
are rebuilt. Export exclusions describe what must not travel, not which tables a
running node needs: queues, quotas and credentials must be recreated locally.

Identity binding must establish the same person, not merely a matching email or UID.
Portable LIDs and signed history survive unchanged. Renaming UIDs inside signed
records or silently choosing one chain head is not an acceptable merge. Media,
identity enrollment, authorization and record validation are part of the eventual
import transaction/workflow, not guarantees provided by a merge report.

### Implemented now and remaining boundaries

- `seed/docker-compose.yml` starts PostgreSQL only, requires an explicit password
  and binds its development SQL port to loopback. `npm run seed:migrate` installs and
  upgrades the schema: a database advisory lock serializes runners, a checksum ledger
  binds applied files, and one transaction holds the pending batch. Edited/missing
  history and untracked existing databases are refused, never silently baselined.
- `seed/schema/` covers the bundle travel plan, with deterministic LIN identifiers
  and initial link RLS policies. Migration 003 enables RLS across existing collections,
  denying access where policies have not been ported. It closes premature guardian
  insertion and protects all eight permanent link kinds from own-hand withdrawal.
  `seed:provision` creates a fresh restricted LOGIN with a private generated password
  and SCRAM verifier, granting only the initial graph operations. Real PostgreSQL
  tests authenticate with that account and verify privilege refusal. Full authorization
  parity and the sign-in/account lifecycle remain pending. `seed.uid()` is a trusted server session-setting
  seam, not authentication; never expose SQL or owner credentials to clients.
- `seed/backup.sh` publishes completed private database dumps and preserves previous
  backups on failure. It does not back up future identity/media volumes.
- `seed/api/` serves liveness, readiness and bounded public-link reads using its own
  PostgreSQL-only package. The optional Compose `api` profile runs it with the
  restricted credential file and a loopback-only host port. Startup and requests
  reject privileged database accounts or missing RLS. Every query uses a transaction;
  session state is cleared on reuse and failures discard the connection. Optional
  server-only trust configuration verifies RS256 access tokens against pinned public
  keys, issuer, audience, expiry, token purpose and a 15-minute maximum lifetime.
  Explicit issuer-subject bindings select local UIDs; email and UID/role claims confer
  no authority. `/v1/me` returns that identity; `/v1/me/secret-links` reads only its
  own private seats under RLS. No authentication config means public-only mode;
  invalid configured trust fails startup. Only the explicitly ported command routes below are writable; other private routes stay closed.
  Binding/key changes require restart; token-level revocation and the application
  full application login/recovery journey remain unfinished. Real PostgreSQL/HTTP tests cover
  those boundaries and concurrent session isolation.
  `test:seed:docker` builds and starts the image against fresh PostgreSQL 16, verifies
  signed-token/private-seat isolation, private-route and owner-credential refusal, non-root/read-only execution, outage recovery, restart
  persistence and data dump/restore, then removes its isolated containers and volume.
- `seed/identity/compose.yml` adds an optional self-hosted Keycloak OIDC issuer with
  a separate persistent PostgreSQL database. `seed:identity:configure` prepares a
  realm with exact HTTPS callbacks, code flow with S256 PKCE, five-minute access
  tokens and no password/implicit grant. Its explicit API verifier profile checks
  Keycloak access-token purpose and authorized client as well as existing trust
  constraints. Provider login grants no application membership, staff or keeper role.
  Self-registration and local enrollment can be explicitly enabled; SMTP, TLS and an operator account
  require installation setup. The existing React app still uses Firebase sessions;
  cross-node trust and portable identity linking remain separate unfinished work.
  `test:seed:identity` passes against the real container: discovery, code+PKCE login,
  API identity, ID-token refusal, replay/wrong-verifier refusal, refresh, logout and
  signing-key persistence after restart. This is not a full identity backup/restore drill.
- `seed/web` is a separate React sign-in preview. `seed:web:build` requires explicit
  HTTPS application/issuer settings and rejects Firebase modules. It uses the standard
  browser OIDC client with code+PKCE, nonce/state validation and in-memory tokens;
  pending redirect state alone uses session storage. The session service binds the
  local UID through `/v1/me`, clears local state on sign-out/expiry, and rejects stale
  identity/private responses after account changes. Unit tests cover those races;
  the real issuer test exercises the browser library callback protocol. The original
  React application still uses Firebase; this preview is not its replacement and
  has not yet completed a full-browser end-to-end test.
- Migration 004 adds narrow own-profile read/save functions, with public execution
  revoked and runtime execution explicitly granted. These privileged functions use a
  fixed search path and transaction identity; direct `users`/`persons` access stays
  denied. Already bound accounts can create a UUIDv7 person and private profile or
  rename themselves atomically. Per-account locking keeps concurrent saves on one
  LID; existing signing state/history survive. Duplicate person LIDs or inconsistent
  imported identity require review. The React preview has a display-name form;
  signing-key creation and the rest of profile settings
  remain unported. Existing runtime logins need replacement provisioning for the
  new function grants; migrations do not broaden them silently.
- Migration 005 ports public community reads under RLS. The API lists bounded,
  cursor-paginated community documents or looks up one ID, with SQL IDs overriding
  JSON metadata. Invite/closed doors govern joining, not document visibility, as
  in the existing Firestore rules. Runtime provisioning grants SELECT only and
  readiness checks it; existing roles need replacement provisioning. Real database
  tests verify that even accidental DML grants cannot bypass denied writes.
  Migration 006 adds atomic founding, basic keeper edits and membership commands.
  Capacity is serialized; IDs, anchor and birthplace come from the server. Door changes
  and membership share a row lock, departure removes steward authority, and sitting
  keepers must resign first. Generic link withdrawal cannot bypass those protections.
  Authenticated lookups return caller access flags; the independent preview offers
  list/detail, founding, edits, joining, requests and keeper/steward request handling.
  Full settings remain unported; rooted keeper requests arrive in migration 012. These are narrow
  security-definer operations with fixed search paths and explicit runtime grants,
  tested for denied authority, concurrent founding and rollback after a forced failure.
- Migration 007 adds public invitation-token lookup, keeper/steward-only lists and
  atomic mint/revoke/accept operations. Random tokens are capabilities; no direct
  invitation-table grants exist. Revocation is one-way. Acceptance writes membership
  and permanent arrival provenance together; failure rolls everything back. The
  preview exposes invitation management and preserves a pending invite through login.
- Migration 008 records issuer/subject bindings independently of portable LIDs.
  Explicitly enabled enrollment allocates a new local UID under a per-subject lock;
  matching email/UID claims never adopts an existing person. Closing registration
  keeps established enrolled logins; configured disabled subjects are refused, and
  removing an explicit binding still revokes it. Conflicting remaps fail closed.
  The realm generator can explicitly enable registration; SMTP and the matching API
  policy are installation settings. Host-door synchronization, complete account
  management and federation identity linking remain unfinished.
- Migration 009 adds steward delegation/revocation and self-resignation of community
  keepers. The anchor passes to the longest-standing peer (UID breaks ties), never
  disappears; a stray duplicate old-anchor seat is removed. Community locking orders
  concurrent departures; failed transfers roll back seat changes. The preview exposes
  these controls. Migration 012 adds rooted acceptance of keepership requests.
- Migrations 010–011 add tree reads under RLS and atomic planting/basic edits. Public,
  node and private circles have distinct access; a SECRET record stays circle-only
  even if imported with a malformed public visibility. Secret keeper seats are readable
  by the circle without granting power over non-secret trees. Legacy unstamped records
  remain directly readable under the legacy law but are not anonymously listed.
  Planting serializes per-anchor quotas and creates the tree, its Root Vision (only a
  lifetree), and the guarded-tree follow as one transaction. Root Visions inherit birth
  visibility; secret trees create neither public reflection nor guardian link. Genesis
  hashes retain their exact v0 preimages for verification. Basic edits preserve identity,
  validation and chain heads. The separate preview now browses/plants/edits trees;
  beds, media, visibility changes and chain appends remain unfinished; tree invitations arrive in migration 015.
- Migration 012 adds community keepership requests, withdrawal, keeper acceptance and
  decline. Acceptance locks the request and qualifying tree/keeper seat, creates canonical
  keeper and member links, consumes consent and rebuilds the ACL mirror atomically.
  Beds and secret trees never confer outside standing; the qualifying test matches
  `rootsABeing`, including legacy trees. Migration 013 adds keeper offers and recipient acceptance/decline, with pending
  inbox/community pagination. Offers grant no seat before acceptance; a qualifying tree
  is rechecked and keeper/member/provenance writes plus offer consumption are atomic.
  Closed offers cannot reopen. Signed-in reads match the existing collection law.
- Migration 014 adds self-resignation from tree keepership with deterministic
  succession across private and legacy public seats of secret trees. Non-secret trees
  cannot acquire authority from the private ledger. The last keeper cannot leave;
  staff status alone is no keeper seat. Departure preserves tree identity and chain
  heads, removes duplicate departing/promoted seats, and remains private. Generic
  keeper-link deletion is denied; the preview uses the locked command.
- Migration 015 adds tree invitation mint/claim/accept/decline/revoke and bounded
  inbox/tree lists. An open token permits single lookup only while pending and unexpired;
  claiming binds one signed-in recipient. Secret trees accept only private keeper seats
  and never create a public circle community. Guardian acceptance requires an anchored
  living lifetree and applies the validation dial; other non-secret roles create/reuse
  the tree circle and membership atomically. The preview connects inboxes, management
  and share links across sign-in. Full-browser verification remains outstanding.
- Migration 016 exposes bounded public person-name lookup/search through an explicit
  UID/LID/display-name projection. It never reads private user records and does not
  grant direct person-table access. Invitation pickers use this endpoint; complete
  profile settings, public profile pages and portable LID lookup remain separate work.
- Migration 017 forms an existing tree circle once, under locks, through a circle
  keeper or root-tree keeper. It preserves identity, relationships and chain history;
  the root tree supplies normalized birthplace, never a domain claim. Missing or
  secret roots require review. The preview exposes the server-derived formation right.
  Database-only transactions now retry at most twice after explicit serialization or
  deadlock aborts; connection failures and uncertain commit outcomes are not replayed.
- Migration 018 keeps the private account UID/LID mirror aligned with its public
  person when saving a profile. It fills a missing mirror but refuses conflicting
  identities or a private imported LID without its person; name edits cannot rebind
  portable identity. Other profile fields and signing/history data are preserved.
- Migration 019 records immutable local image manifests. Authenticated uploads enforce
  canonical person/community ownership; all image reads are public, matching current
  storage rules. The API strips metadata, bounds image decoding, creates WebP variants,
  and stores hash-checked bytes on a persistent Docker volume. Browser upload transport
  exists. Migration 020 adds authorized ordered tree-picture attachment/removal without
  altering signed growth. Other attachment flows, release/garbage collection and media
  backup remain unfinished.
- Migration 021 adds personal logo/banner references to own-profile reads and writes.
  Published local images are required; public/private identity consistency is checked
  under the same lock as name changes. Clearing a reference preserves stored bytes.
  The preview supports these slots; palettes, inheritance and provider avatars remain.
- Independent graph reads now cover endpoint filters, relation-wide queries, own
  private seats and authorized secret circles. A paginating adapter converts HTTP
  timestamps to the existing Stamp contract and rejects cross-account page mixtures.
  It composes with the shared graph service; generic graph writes and main-app backend
  selection remain incomplete.
- Migration 022 adds narrow graph care writes: own joined/follow edges, own circle
  role withdrawal, and keeper guardian release. Private/secret trees cannot be
  self-followed, duplicate follows preserve tenure, and community role commands
  cannot be bypassed. Keeper/member grants and provenance remain consent commands.
- Migration 023 implements directional community collaboration, recognition, resource
  sharing and coin acceptance. Source keepers control their statement; the reverse
  belongs to the other community. Reciprocity is derived and grants no authority.
  Staff minting respects its named hand; preview reads/writes use the same graph API.
- Migration 024 implements garden placement and withdrawal as `grows_in` links.
  Tree carers use open doors; community door-keepers welcome through any door; staff
  placement follows its named hand. Secret trees are excluded. Links change neither
  the tree document nor read authority, and duplicate writes preserve link tenure.
  Garden-filtered tree lists apply RLS and exclude beds/secret trees; the preview
  displays guest forests and lets tree carers manage placement.
- Migration 025 adds tree keepership requests. An answer atomically creates a
  pending invitation and removes the request; acceptance remains recipient consent.
  Secret requests live in the private ledger, and requesting grants no tree access.
  Existing invitation authority determines which roles a keeper/steward may offer.
- Migration 026 adds keeper-authorized participation markers and RLS-filtered
  participant tree lists. Secret trees cannot enlist; lists exclude beds and secret
  trees. The opaque target reference grants no access or admission and does not
  implement event-capacity reservation; complete event/vision services remain pending.
- Migration 027 exposes visions with author-based privacy and precise newest-first
  pagination. Joining or keeping the root tree does not grant private-vision access.
  Legacy direct reads remain compatible while broad discovery stays restricted.
  Preview reading/joining is available; full vision writing and lifecycle remain.
- [Feature coverage inventory](../seed/PARITY.md) tracks existing server exports,
  Firebase client modules and release evidence. It records gaps, not a reduced scope.
- `src/domain/bundleMerge.ts` plans additive merges and binds each proposal to a
  destination snapshot digest. `npm run node:merge:plan` verifies Ed25519 provenance
  and writes a private offline report. It does not execute an import. The browser's
  existing export ZIP is not yet the complete signed bundle this planner accepts.
- Version-2 independent charters describe PostgreSQL deployment intent without
  Firebase fields. `independentCharterProblem` validates identity and unambiguous
  host assignments; `seed:configure` writes an isolated private configuration,
  public envelope and host list. It neither deploys services nor changes the app's
  backend. The existing Firebase sync refuses version 2 to prevent accidental fallback.
- THE SEAM (2026-11-01): the application imports its service layer as `@backend`; the build
  resolves it to `src/services/firebase` or, in mode `independent`, to
  `src/services/independent` (no SSO door, browser config from the installation's HTTPS
  origins, any Firebase module in the bundle fails the build). `src/services/backendParity.ts`
  proves at compile time that the independent backend offers every name the Firebase backend
  offers; a hand not yet grown is `unported` and refuses by name. The shared types name no
  vendor (Lightseed, Stamp, page cursors). The independent backend's first hands stand on the
  OIDC session and the API below: profile, trees, pulses, visions, communities, the /b/ door,
  media upload. The remaining hands are counted in seed/PARITY.md.
- Before the seam, the application's data, authentication, media and server actions used Firebase directly.
  The existing `Store` interface covers relationships only. Its callers now use
  `services/store.ts`, which selects the graph adapter in one place; the backend-neutral
  `services/graph.ts` assembles open/private tree circles using the existing domain
  law. Views and aggregates no longer import the Firestore graph adapter directly.
  Replacing this adapter alone still cannot migrate the full application.

Merge, backup and migration-source tests run in the ordinary quality gate. The schema
coverage test checks SQL text. `npm run test:seed` separately runs the actual schema
and migration CLI in an isolated PostgreSQL cluster, testing rollback, repeat runs,
concurrency, history validation, non-owner access, secret-seat isolation and identity
cleanup between transactions; it does not yet establish full authorization
parity. The initial API's container startup and restart/data-restore checks pass on
Docker. The independent browser journey, full identity/media/role restoration and
feature parity are still unimplemented; a passing API smoke test is not that release proof.

**Release proof:** on a clean VPS, complete the current user journeys with Firebase
access blocked, including private-data refusal, signing/recovery, concurrent chain
appends, media access and background work. Restart without losing state; restore
database, media and identities into an empty installation; merge an overlapping
export without changing authority or signed history. Required checks include
`npm run check`, PostgreSQL/API authorization and concurrency tests, and the browser
walk against Compose. The delivery sequence lives in `ROADMAP.md`; operational
commands live in `seed/README.md`.

Independent-node vision writes (migration 028) now use a bounded command endpoint:
server-owned birth identity, author, domain and reproducible genesis; row-locked
prose/visibility edits by author or local staff preserve all chain fields. The
preview exposes creation and author editing. Community grounding resolution and
full vision lifecycle/main-app integration remain unfinished (see seed/PARITY.md).

Independent-node vision pictures (migration 029) use the same published local
media as tree pictures, with author/staff checks and atomic ordered attachment.
Pictures stay public; clearing references does not delete bytes or alter chains.
The preview shares upload/reorder/removal controls for both record types.

Independent-node vision release (migration 030) locks and authorizes the record,
then atomically removes it and only the incoming public links allowed by the
existing withdrawal policy. Contribution records, outgoing edges, private ledgers
and media stand. The preview requires confirmation; this does not supply signed
contribution minting or complete original-app integration.

Independent-node signing-key publication (migration 031) binds canonical public
Ed25519 keys to the authenticated UID and consistent saved person identity. First
publication appends lineage and a server-timed anchor event atomically. Repeated
publication preserves epochs, timestamps and frozen state; replacing a key requires
the future rotation/recovery path. Current public identity reads expose only signing
fields. Browser custody integration, complete history reads, freeze, rotation and
witnessed recovery are still unfinished, so signed contributions remain unavailable.

Independent signing freeze (migration 032) checks the observed current epoch under
lock, appends one immutable server-timed event, and changes only freeze state. An
optional suspected-compromise date remains an allegation, not retroactive signature
authority. Public key/event history is paginated; recovery records stay inaccessible.
The preview can inspect and confirm freezing. Rotation, witnessed recovery and
browser key creation/restoration still remain before independent signing is complete.

Independent key rotation (migration 033) verifies old/new Ed25519 signatures in the
API using the existing UID-bound preimage before the restricted SQL apply function
locks and updates the current epoch. Old lineage remains immutable; stale, frozen,
reused-key and repeated-event attempts refuse. The trusted API role is the signature
verification boundary, never a browser credential. Browser key custody and witnessed
recovery remain unfinished.

Independent recovery proposals (migration 034) use a locked, validated freeze boundary
and a candidate Ed25519 proof over the existing recovery claim. The API verifies the
signature before a restricted SQL function appends an open proposal. Account access
and candidate possession never activate a key; it remains frozen. Proposal reads
require authentication. Witness quorum/activation and browser custody remain open.

Independent recovery witnesses (migration 035) bind support to the caller's current
active key and the exact candidate claim. Identity, proposal and initiation/rooted-tree
eligibility facts stay locked through signature verification and append. Retries do
not rewrite receipts. BED/SECRET trees grant no outside standing, including through
anchor ownership (the Firebase helper's anchor query omits that filter; review remains).
Quorum activation, witness-list reads and browser custody are not yet complete.

Independent recovery activation (migration 036) re-verifies candidate/witness proofs
and requires three distinct eligible current witness UIDs. Identity, proposal,
witness records and eligibility facts remain locked across verification and apply.
Activation appends a fresh key/recovery event and updates the identity/proposal
atomically, preserving every prior receipt. This is an account-based quorum, not
proof of three physical people. Browser custody, witness-list reads and original-app
integration remain unfinished.

The independent preview now supports first-key device custody: 24-word backup
confirmation, public-key publication, matching-phrase restoration and publication
retry. Origin-scoped IndexedDB stores non-extractable CryptoKeys keyed by UID, stable
person LID and public key; seeds/phrases never enter storage or API requests. Device
keys are saved before publication and checked by signing a disposable challenge.
Account/person changes cancel pending gestures. A real browser reload verifies
persistence and export refusal. Browser rotation now keeps both keys and its signed
retry receipt before publication, requires backup of the replacement phrase, resumes
the same event after reload, and reconciles a lost success response against the
current public key. Migration 037 exposes bounded authenticated witness receipt
pages with an explicit field projection. Receipt counts do not establish quorum:
activation still checks current distinct accounts, eligibility and signatures.
The preview now also keeps recovery candidates before proposing them, restores the
candidate phrase against a verified proposal, requires witness review of the account
and replacement fingerprint, and checks local candidate possession before activation.
Lost proposal/activation responses reconcile against stored proofs/current identity.
This does not replace the server's quorum or eligibility checks. Full OIDC browser
custody journeys and original-app integration still remain.

The independent Docker build now compiles the existing pure chain laws through
`seedChainRuntime.ts` into a standalone module. Build dependencies stay out of the
runtime image; the compiler refuses non-domain imports. This avoids a new semantic
mirror for independent minting. Migration 038 now appends tree/vision blocks through
those laws while locking standing, signing identity and bearer head. Current-key
proofs bind normalized content to the observed head; the canonical sealed block,
head and care/watering effects commit together. A partially imported published
identity cannot fall back to unsigned minting. Migration 039 adds direct and precisely
paginated pulse reads under row-level access rules. Addressed messages remain private
even if imported visibility says public; query filters confer no authority. The
separate tree/vision preview displays visible history, omits private-message types,
and checks individual content hashes. It does not yet verify full chains or key
lineage. A separate preview form now prepares signed text growth and tree watering
with the current device key. Review inputs are copied and submission consumes the
attempt even if its response is lost; no automatic re-signing or replay occurs.
Service tests cover signature bytes, account changes and uncertain responses. Real
authenticated API tests accept the device service proofs and reject stale heads and
unauthorized authors; a separate browser fixture checks the form and device key.
Complete OIDC browser mint journeys, other block forms, original-app integration and
offering/alignment twin mints remain unfinished. Offering acceptance now has a shared
compiled judgment and reciprocal-record builder plus a tested server seal-preparation
helper. Migration 040 adds paired-head/lifecycle atomicity with ordered bearer locks,
current standing checks and an answer written in the same transaction. Concurrent
acceptance and late-write rollback are exercised against PostgreSQL. The authenticated
acceptance endpoint now takes only the offering ID. Migration 041 restricts paired
record reads to viewers allowed to see both named bearers, or the exact recorded
agreement parties/staff. Private tree guardianship alone does not admit the record;
recorded parties retain access after bearer removal. This closes the existing
Firebase twin-label disclosure discrepancy without rewriting either sealed record.
The preview now lists visible offerings, reloads before acceptance review and requires
explicit confirmation; uncertain replies are not replayed, and refresh reconciles the
answer. A synthetic browser fixture verifies that flow. Migration 042 and the API now
create offerings with protected birth proofs and a private recipient reach in one
transaction. Current source/bed authority, target visibility and published pictures
are checked under locks; private referenced beings require a private listing.
Recipient carers can read addressed private offerings. Birth verification preimages
stay in a separate table without runtime read grants, preserving prior private text
across later listing edits. Migration 043 supplies edit/pause/withdraw/decline commands;
accepted words and all birth proofs remain unchanged. Answers serialize with acceptance
and recipient standing is checked when declining. The preview has pause/reopen,
confirmed withdrawal and recipient decline, including for paused offerings.
Creation/edit forms now use paginated named choices, permission-filtered source/bed
lists and local picture uploads. Private referenced beings make creation drafts private;
editing preserves immutable references and unchanged imported pictures. Synthetic
browser tests cover creation and retelling. Mail/push delivery, protected proof export,
imported-picture fine-grained editing, original-app wiring and complete OIDC browser
journeys remain unfinished.


Independent alignment commands (migrations 044–045) now derive the receiving account
from the matched pulse's author, including delegated stewards. Proposal creation checks
source authority, readable matched pulse/target and current target standing; optional
initiating pulses must belong to the proposer and source tree. Negotiation reads and
notes are private to recorded participants, with governed staff read access. Only the
named recipient can reject or accept. Acceptance locks the proposal and ordered tree
heads, rechecks both people's current standing and appends reciprocal canonical records
with both head updates and the final answer in one transaction. A same-tree proposal
cannot append twice to one head. Notes stop once answered; rejection races with acceptance
so only one answer wins. No participant signature or light transfer is invented.

The original Firebase alignment path exposes proposals publicly and does not recheck
both carers at acceptance. The independent path deliberately tightens these boundaries.
Its sealed record shape retains the existing public label, but restrictive read policies
require ordinary viewers to see both named trees; the exact recorded parties retain
both records after bearer removal. Unit, PostgreSQL and authenticated HTTP tests exercise
these boundaries, concurrency and rollback. The session command and preview now support named tree/pulse selection, private notes,
explicit answer reviews and refresh after uncertain responses. A disposable browser
fixture verifies proposals, notes, acceptance, rejection and lost-response reconciliation.
Original-app integration and complete OIDC browser journeys remain unfinished.

Independent event duplication (migration 046) copies the existing gathering frame
and place/visibility into a fresh standalone event, with the duplicator as author.
Current author, community keeper or staff authority is checked under locks. The new
event, protected legacy birth proof and permanent `descends_from` link commit together;
participation, social counts, signatures and formed-circle state are not inherited.
No tree head moves. The original event remains unchanged. API/session commands and
PostgreSQL tests cover authority, privacy and failure rollback. Migration 047 now creates standalone and keeper/staff-authorized community events with
protected birth proofs, scoped visibility and published pictures. Author/current-keeper/
staff edits preserve identity, lineage, original seal and proof. An unplaced event can
be adopted once by the keeper of its own domain community, never moved elsewhere.
Shared span/link laws validate content; omitted edit pictures preserve imported references.
Chain-bearing records refuse standalone edits. Migration 048 enables event-circle
formation and gathering through the same API: current host authority, eligible captured
participants and lineage bindings are locked and rechecked. The shared node-capacity
lock prevents competing foundations exceeding the cap. Community, member/participant
links and lineage memory commit together; repeated asks reuse the circle. New circles
have an invite door. Membership is the former's gift, not participant consent; members
may leave and an explicit later gather may add them again. PostgreSQL tests cover
concurrency, capacity, authority loss and rollback. Browser controls, event deletion
policy and original-app integration remain unfinished.

Independent portable-name lookup (migration 049, `GET /v1/beings?lid=…`) reads
indexed source records under the runtime's existing RLS. Trees, visions, communities,
pulses and public person identities return only kind/local ID/LID. Hidden records and
missing records have the same response; multiple visible matches require review.
It does not expose private accounts or silently repair conflicting identity. Source
indexes do not become an identity registry: immutable bindings, global collision
audits, backfill, Light Houses, cross-node lookup and original `/b` navigation remain.
PostgreSQL and HTTP tests cover privacy, collisions and pooled-account isolation.

THE DOCUMENT DOOR (migrations 050–053, 2026-11-02). Instead of one SQL command per
client hand, the independent node grew one generic, RLS-governed document API: `GET
/v1/docs/<collection>` and `POST /v1/docs/command`. The law of `firestore.rules` is
translated collection by collection into SQL rule functions (`seed.rule_<collection>` with
the five Firestore actions), the row-level SELECT policies call the same `list` rule, and
`seed.doc_write` locks the row and applies the Firestore-shaped patch (server time, delete,
array union/remove, increment, dotted keys, set-merge, optimistic `expect`). Writes by an
anonymous hand are allowed to reach the door; the rules decide. Records that never travel
(push subscriptions, bed holds) live in the `seed` schema; the stays occupancy mirror is a
trigger that refuses a double booking. With this one door some two hundred client hands
were ported mechanically and the application's Firebase-free bundle runs against a local
Compose node. `tests/seedDocs.test.ts` holds the registry to the SQL map and the travel
plan; `tests/seed/documents.postgres-test.ts` proves the refusals through the API.

THE ORGANS (migration 054, 2026-11-02). The server hands of `functions/src/index.ts`
that moved light, took back a head, lent staff hands, ended an account or proved a domain
are grown as context/apply pairs the API drives — facts read under locks, the pure law from
the shared domain bundle (`domain/light` now carries the mint's judgment itself, mirrored by
the functions and held equal in `tests/mint.test.ts`; `domain/spend`, `domain/unmint`,
`domain/doors`, `domain/domainVerification`), one apply in the same transaction. The
decision seal is re-verified on server ground signature by signature before the commons
moves. DNS is observed outside every transaction and re-checked under the lock before the
server-only mark is written; face doors are named by the installation (`SEED_FACE_DOORS`)
and granted by the steward. The account's departure is one transaction: the last spend to
the heir through the prism, every record, the login binding. The node's keeper is appointed
by the installation (`seed:keeper`), never by a public first-visitor claim.

THE AI ORGAN (migration 057, 2026-11-03). A model is reached on a hand's behalf through one
organ (`seed/api/ai.mjs`, `POST /v1/ai/command`): the shell sends the transcript and the
voice (the words are the domain's, `domain/aiPrompts`, shared by both backends), the node
decides WHOSE KEY answers — a credential kept for the hand or for a place it belongs to
(`seed.credential_take`, opened in the API for one call), else the node's own key, which is
a member benefit (`seed.ai_gate` → `domain/aiRequest` nodeAiRefusal: staff, the dial, a
validated membership) counted by the day in `seed.usage` (21 texts, 3 pictures) — and asks
the provider's own SDK outside the transaction (`seed/api/aiRails.mjs`). A kept key rests in
`seed.provider_credentials` as AES-256-GCM ciphertext under the installation's
`SEED_CREDENTIAL_KEY`, bound to its row name; a dump yields nothing, no route returns a key.
Provider failures speak by name (`ai_key_rejected`, `ai_rate_limited`, `ai_failed`). Still
refusing by name: the one-time Firestore backfills, cross-node SSO, the scheduled thirst and
stay leaves, previews and feeds, the issuer's own sign-in hands.

THE MAIL ORGAN (migration 056, 2026-11-03). Letters leave the independent node through one
organ (`seed/api/mail.mjs`): the hands (`POST /v1/mail/command` — a system letter the node
composes from plain words in the voice of its place under a daily quota, the letter of a
place fanned out one per subscriber with its own unsubscribe door, the sender's own delivery),
the public doors (`/v1/invite-requests`, `/u/<token>`), and the EFFECTS of a request's own
write — a reach's notice and push knock, a join request's knock on the keepers, the first
profile's welcome — which triggers leave in `seed.outbox` and the courier composes from facts
the context functions read, lands as letters in one transaction, then carries over SMTP with
the law's patience (`domain/mailLetter`). An accepted network invitation mints its links
inside the acceptance. The words of every letter are the domain's (`mailLetter`, `mailVoice`,
`newsletter`, `push`); the sender is the charter's (`SEED_CHARTER`); the couriers are the
installation's secrets. The address a login carries is remembered only when the issuer
verified it, and never matched as identity.

THE CROSSING (migration 055, 2026-11-02). `seed:export` reads every travelling
collection through the crossing's map (`domain/seedBundle`: one closed map from the travel
plan's signatures to the soil's tables), builds the charter head and census, carries the
beings index as a computed witness, and the custodian seals the manifest with an Ed25519
key kept outside the node; the public anchor is written beside the bundle to travel by
another road. `seed:import` verifies structure and seal, plans the additive merge with the
shared planner inside one serializable transaction under the crossing's advisory lock, and
with `--apply` lands every planned record in that transaction or nothing, remembering the
crossing in `seed.crossings`. Local authority (`admins`, `config`) never merges. An identity
is anchored on the far side by a person record carrying the same LID, or by a login the
installation bound to that uid by reviewed configuration — the planner's `loginBound`, set
by the executor from the node's own bindings, never by the operator's file. Not carried yet:
media, identity enrollment at scale, overlapping concurrent imports.

## Layers: the dependency direction

```
domain/     pure rules, no backend, no React: ALWAYS testable (tests/ mirrors it)
adapters/   implementations of the graph Store port (Firestore today)
services/   store.ts selects the graph adapter; graph.ts assembles tree circles;
            Firebase aggregates (barrel: services/firebase.ts) + weather, refreshBus
hooks/      session (useLifeseed → SessionContext), feeds, facts, visible-lightHouses
components/ the faces; components/sections/ = the shared Being anatomy (8 organs);
            components/app/ = the conductor's own limbs (main content, overlays, being detail)
pages/      tab-level shells; App.tsx is the single conductor — composing hooks/use* seams
            (overlays, modal doors, host node, door arrivals, carrying), not holding them
```

New logic starts in `domain/` with a test. UI reads domain truths; services carry
them; nothing in `domain/` imports upward.

## The collections (see /model in the app: the crystal)

`persons` `users` `admins` `config`: identity & account. The public, server-owned
`config/dataAuthority` singleton names the portable LID of the node governing
this backend (`version: 1`, `nodeLid`); browser clients cannot write it. A
person's signing history lives below `persons/{uid}` as append-only `keys` and
`keyEvents`; `keyRecoveries/{id}/witnesses/{uid}__{epoch}` holds the social recovery
proof, while the person doc names only the current epoch and active/frozen state.
`lifetrees`: the seed beings; chain fields frozen; provenance (`plantedAt`+coords); `anchorUid`
(the never-empty keeper seat — ring 2026-09-30; keepers are equal, `keeper` links beside it).
`pulses`: one ledger for growth/care/events/decisions/reaches/offerings; an offering may carry
`offeringAppreciationLight` (suggested after-gift, never admission) and, server-written, the light
SUSPENDED at it (`offeringSuspendedLight`); a purchase decision names its `spend` at birth (frozen).
`gifts` / `spends`: the ledgers of light that MOVED (ring 2026-09-30) — server-only, like `rays`.
`links`: the LIN: `from__rel__to`; rels: guardian, keeper, steward, observer,
member, joined, participant, join_request, **rooted** (Light House→tree),
**shelters** (Light House→community), **invited_by** (newcomer→community; append-only
provenance, grants nothing; see domain/communityDoor), and the first **Interbeing Matrix**
attestations (`collaborates_with`, `recognises`, `shares_resources_with`; community→community),
**descends_from** (a copied event→its original; server-minted only, never deleted; the lineage's
one truth, `domain/eventLineage`).
Doc id MUST equal `from__rel__to`
(rules bind it: authority is resolved by path, so an unbound id would be forgeable).
`secretLinks`: the SECRET CIRCLE (ring 2026-10-02, `domain/secretTree`): a secret tree's keeper
seats — the same link, the same id — in a ledger read only by that tree's circle and written only
by the server (`acceptTreeInvite` mints, `resignTreeKeeper` lays down). Every "does this hand keep
this tree?" reads both ledgers (rules `isTreeKeeper`, server `secretKeeperRef`, shell `linksToTree`).
`visions` `communities` (bearing the **door**: open/invite/closed) `lightHouses`
`stays` `alignments` `supports` (server-only)
`intelligences` `personas` `memories` `providerCredentials`: the intelligence commons (`authorId`
on the made things; a credential has a `holderId`, never an owner).
`networkInvites` `communityInvites` (shareable /i/ door keys; revoked, never deleted)
`treeKeepingInvites` `communityTreeInvites` `inviteRequests`.

## Rules philosophy

Queries must be **provable**: list queries carry the constraints the rules demand
(visibility filters for the signed-out, `hostUid`/`participantUids` for inboxes).
Vision lists are a source-level union: public visitors query `public`; signed-in
viewers query `public` + `node` (until node membership becomes real) and merge
their own author-scoped records; staff may read the field. The rules deliberately
keep absent-visibility compatibility for a direct `get`, never for an
unconstrained `list` that could sweep private records.
Fine-grained gates live as pure domain functions (`canViewTree`,
`canViewLightHouse`, `canView` for pulses) mirrored by the rules; overlay updates
are constrained to exact key sets via `diff().affectedKeys().hasOnly(...)`.
Deterministic link ids make ownership checks O(1) (`exists(links/uid__rel__id)`).
Love is stronger than an overlay-key fence: rules couple the private `loves/{uid}`
slot to exactly +/- one on the parent's tally with `existsAfter` / `getAfter`, in
the same transaction. Neither slot nor count may move alone; pulse slots are
own-slot private too. The love-update branch repeats the parent's visibility gate,
so a known private id cannot be touched as an existence probe. Love has no economic
side effect: neither the being nor pulse path mints a token, ray, balance or reward.

## Flows worth knowing

- **Backend authority and the crown**: `config/dataAuthority` states which node
  governs this database. The shell compares its `nodeLid` with the hosting
  community's own LID and derives the last menu name without hostname inference:
  a different LID is **The Host** (a community domain on its parent node's data);
  the same LID is **The Node**, or **The Hub** when that community chooses public
  reflection. Missing or malformed authority makes no claim and remains
  **About**. The record is public so a signed-out visitor receives the same truth,
  but server-owned so a community cannot click itself into sovereignty.
- **Domain scoping**: every domain community begins scoped. Only an explicit
  `community.reflectsPublic == true` opens its authority backend's public forest;
  absent and false remain closed. Feeds carry this choice as one query signal:
  a domain means `domain == community.domain`, while no domain means reflection.
  No hostname inherits a data role. The seed-shell aliases remain for branding
  and local-development behavior only. A Host may reflect without becoming a
  Node; custody, not visibility, governs the crown. Custom landings remain
  community DATA.
- **The map**: pixel-space clustering (50px) over trees + Light House pseudo-beings;
  Light Houses seed clusters (lighthouse precedence); Seed-of-Life petal expansion;
  popups via Leaflet autoPan (bottom-anchored popups can never flip; don't try).
- **Refresh bus** (`services/refreshBus.ts`): mutation sites `announce(topic, id?, patch?)`;
  mounted views re-fetch, an edit's patch merges into loaded copies, and a patchless id
  prunes (so an edit must never announce twice). `mintPulse` announces the tree's new head;
  the shell merges it into the open tree and the profile's chain reloads when `latestHash`
  moves (the chain follows the head, ring 2026-09-03).
- **Being links**: `/b/<lid>` resolves permission-aware across collections
  (`findBeingByLid`) and opens the right profile; QRs are minted lazily onto docs.
- **Interbeing Matrix**: a community's founding owner or `keeper`-link peer proposes a typed
  relationship by minting its directed LIN edge (door stewards do not carry the outward voice).
  The other community acknowledges with its own reverse edge;
  reciprocity is pure derived state, never an ownership or acceptance field. The community
  profile's Interbeing section is the first end-to-end face. Domains are displayed as honest
  self-declared external anchors; verification remains a named future boundary. See
  `root/INTERBEING_MATRIX.md` for the plain contract.
- **Server-held heads** (ring 2026-09-23): every link on a tree's or a vision's chain is
  born by the server — `functions/mintBlock` (and its twins `unmintBlock`, `acceptAlignment`,
  `acceptOffering`, the stay leaf) reads the bearer's head inside its transaction, judges the
  birth by `domain/chain/birth` (mirrored in `functions/src/birth.ts`, held equal by
  `tests/birth.test.ts`), seals the block canonically over the very record it stores, and
  moves the head in the same write. A client hands over only what a hand may SAY about a
  block (`BLOCK_BIRTH_FIELDS`); authorId, domain, mintedAt, previousHash and the hash are the
  server's. The rules refuse every client-born chain link, every client head move
  (`latestHash`/`blockHeight`/`genesisHash` frozen on trees and visions, staff included) and
  every client delete of a chain block; a client births only standalone, sentinel-rooted
  records (events, offerings, decisions, person-reaches). Trees and visions are born at
  their root (head == genesis, height 0). The chain-seal stamp (`community.chainLocked`) no
  longer changes what is written: every server-born block is canonical.
- **The event circle** (ring 2026-09-27): `functions/formCircleFromEvent` births a community
  from an event's participating trees — the tree circle's shape (`formation: 'event'`,
  `rootEventId`, no address, `visibility: 'invited'`), member links for the former and every
  tree's owner, participant links for the trees, `circleCommunityId` stamped on the event (no
  client key set names it). Law in `domain/eventCircle`, mirrored, `tests/eventCircle.test.ts`.
  `functions/duplicateEvent` births a new occurrence in the duplicator's name, mints its
  `descends_from` edge and the lineage cache (`descendsFromId`, `lineageRootId`, `generation`),
  and the face opens its edit. The circle belongs to the LINEAGE: it forms once at the root
  from every occurrence's trees; a later occurrence's ask gathers newcomers into it.
- **Signed blocks** (ring 2026-09-23): a person with a published signing key signs every block
  they mint — over the chain position and `signedContentOf` the content (the same pure
  judgment run client-side over the bearer) under `lifeseed.block-signature.v1`; `mintBlock`
  verifies with the PUBLISHED key from `persons/{uid}` and seals `authorSignature` into the
  hash. A keyless person mints unsigned (no `authorSignature`); a frozen key mints nothing; a
  device without its key speaks `block_key_restore`. Readers verify from the block alone via
  `blockSignaturePayloadOf` + the frozen `pubkey`.
- **The signing crystal**: first publication atomically anchors current key,
  lineage and epoch. V3 covenant/decision seals carry fingerprint + epoch and
  receive server time at rest. Routine rotation is old/new cross-signed in a
  callable; account access may only freeze; recovery activation requires three
  current witness signatures rooted in initiation or validated lifetrees.
- **The White Paper**: every root/*.md is served by the deploy itself at
  `/root/<NAME>.md` (vite.config `rootPapers`; `domain/whitePaper` names the
  chapters and refuses anything not declared as text), fetched by the About page
  when a chapter is opened and kept by the worker for offline reading; the
  deployed node carries the constitution it grew from at an address anyone it
  serves can open.
- **The gate**: `npm run check` = tsc + eslint + vitest (unit), `npm run test:rules`
  = emulator suite. Deploy: `npm run build && firebase deploy --only
  hosting[,firestore:rules,functions]`. The firebase CLI is Homebrew-owned.

## Known debts (kept honestly)

- Backend custody is now explicit, but backend division is not: hosted domains
  still share their authority node's instance-wide Auth and database. The next
  boundary is a self-describing export/import and independent backend bootstrap;
  only after data actually moves may a former Host declare itself a Node.
- Key epochs are append-only and server-timed. New signatures bind fingerprint +
  epoch in their v3 payload and land with `recordedAt == request.time`; planned
  rotation is old/new cross-signed; account access may freeze but never replace;
  recovery needs three distinct initiated/validated-tree witnesses. Historical v2
  signatures remain readable without pretending they acquired a trustworthy
  receipt time after the fact. Explicit re-affirmation of disputed seals is not
  yet a product surface.
- Client-side visibility gates (trees, Light Houses) await full rules parity.
- Light House step-in consent is keeper-side only since the shelters migration.
- Mother-tree badge lives on the tree page only (no denormalised flag yet).
- Payments, hosted-AI node credential, and the AI-need chooser are scaffolded,
  not live (see ROADMAP).
- **Being births are not uniformly bound to their claimed hands.** Broad create
  paths for lifetrees, visions, pulses, communities, Light Houses, alignments and
  intelligences do not all bind ownership/authorship or safe birth defaults in the
  rules. In particular, a direct client can claim another owner/author or create a
  lifetree already validated. Close at CREATE with schema keysets and emulator tests
  before new Being kinds grow (first-sight ring, 2026-08-12). CLOSED 2026-08-17 (the
  births-are-bound ring): anchorUid/authorId/initiatorUid is the writer's own uid on every
  client create, a tree cannot be born validated, the persons hinge is guarded, each
  refusal held by an emulator test. (This bullet stood open a month after the ring; a
  review of 2026-09-20 cited it as live debt before checking the rules — noted there.)
- **Append-only is not yet system-wide.** The general pulse delete path still admits
  deletion of some chain blocks; vision deletion attempts to remove contributions;
  and explicit care advances a tree's head without persisting the described care
  block. Draft/mint/mark/release lifecycles need one exact law per chain-bearing type
  (first-sight ring, 2026-08-12). CLOSED for care 2026-08-17 (a real block); CLOSED for the
  chains 2026-09-23 (server-held heads): no client deletes a chain block — a tree's or a
  vision's, head or below, staff included — and `deleteVision` lets the contributions stand;
  the unmint is the server's (`unmintBlock`, domain/unmint). Standalone records (events,
  offerings, decisions) keep their own draft/withdraw laws; covenants and decisions carry
  their own chains under their own rules, not this one.
- Ordinary block birth is client-computed and not checked by Firestore against a
  server-held head. Canonical verification proves stored-byte consistency, not by
  itself authorship, lawful creation or lived truth (first-sight ring, 2026-08-12).
  CLOSED 2026-09-23: birth is the server's (see "Server-held heads" above) — previousHash is
  the head the transaction read, the hash is computed over the stored record, the author is
  the signed-in hand, the standing is read from the documents. What remains not guaranteed:
  lived truth (a photo proves a moment), and the recomputability of blocks born before the
  ring under the browser's legacy seal (linkage and height still verify; `verifyChain` with
  `canonicalRecompute` reports them as hash mismatches by design).
- **A keyless being's block is the server's word alone.** Signing is required only once a key
  is published; planting does not yet mint a key. Making the key the default at planting (and
  opening the restore modal from the mint doors) is the next rung of signed blocks.
- **Covenants and decisions still seal their own marks in the browser.** A covenant's
  seal/break hashes and a decision's enacted/withdrawn marks are client-computed
  (`createBlock`) under their own signature-backed rules, not the server-held head of
  ring 2026-09-23; bringing those two chains under the same server hand is the next rung
  of "one law per chain-bearing type".
- Load-bearing contracts remain manually mirrored across domain code, Firestore
  rules and the isolated Functions package. The light mirror test is one good seam;
  visibility, signing preimages, field sets, caps and lifecycles need equivalent
  conformance (first-sight ring, 2026-08-12).
- Pure-law and rules tests are stronger than the assembled experience: there is no
  automated component/end-to-end walk, and sparse event/offering feeds filter a
  bounded general-pulse sample, so real items can fall outside it as activity grows
  (first-sight ring, 2026-08-12).
- Layering is directional but incomplete: the Store port covers links, and the
  shell, Functions entry point and Firebase services remain large policy
  conductors (first-sight ring, 2026-08-12). CLOSED 2026-08-14: the domain layer
  itself is now import-sealed — zero imports from outside `src/domain/` (the
  `Stamp` time port replaced Firestore `Timestamp`; `words.ts` owns the key
  manifest the dictionary proves coverage of; the block hash lives in
  `chain/hash.ts`) — the `@lightseed/domain` extraction is a folder-move away.
  CLOSED 2026-09-16 for the two conductors: `functions/src/index.ts` is a 17-line
  composition root over fifteen modules by concern (core imports no feature module);
  `App.tsx` is 802 lines and 10 hooks over `hooks/use*` seams and `components/app/`.
  The Firebase services stay large but now name what they read at the Firestore
  boundary (`mapDoc<T>`, `Partial<Link>`, `msOf`); the users document still reaches its
  readers as untyped `DocumentData`.
- Scoped feeds paginated in document-id order (no createdAt composite for domain-scoped
  queries). CLOSED 2026-09-03: the `domain[, type][, visibility] + createdAt DESC` composites
  exist for pulses, trees and visions; every feed orders on the server, with an
  index-building fallback that ends pagination rather than continuing in the wrong order
  (`tests/indexes.test.ts` holds the index file to the queried shapes).
- **A reflecting node's own node-level items are absent from its feed.** Reflection queries
  PUBLIC only across the instance, so items at `node` visibility on the reflecting node itself
  are not shown there; a union (public anywhere + node here) needs two queries merged
  (ring 2026-09-03).
- Power is visible but broad: staff retain general mend/delete escape hatches. The
  present boundary is stewardship by known people, not resistance to stewards;
  retire broad powers into named capabilities over time (first-sight ring,
  2026-08-12).
