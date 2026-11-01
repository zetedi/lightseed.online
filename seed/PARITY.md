# Independent-node feature coverage

The release contract is [Architecture → Independent node](../root/ARCHITECTURE.md#independent-node).
This inventory is implementation tracking, not permission to release a subset. A green
API test does not prove the original application's corresponding feature works without
Firebase. The original React app still uses Firebase; `seed/web` is a separate preview.

Inspected sources: `functions/src/index.ts`, `src/services/firebase/`, the independent
API and migrations 000–049. Updated 2026-10-31. Recheck the source exports before
claiming parity: this table must not silently freeze the existing application's scope.

## Server responsibilities

| Existing exported responsibilities | Independent status / required work |
| --- | --- |
| `rotateSigningKey`, `beginSigningKeyRecovery`, `witnessSigningKeyRecovery`, `activateSigningKeyRecovery` | Partial foundation: public Ed25519 key anchoring and current public identity reads exist, with immutable lineage and concurrent first-publication checks. Emergency freezing and paginated public key/event history are implemented; the preview can inspect and freeze a key. Cross-signed rotation is implemented through the API; signed recovery proposals can be opened against a frozen identity. Current-epoch witness collection is implemented with rooted-tree/initiation eligibility. Three-account quorum activation re-verifies proofs, current keys and eligibility under locks. Preview first-key creation, backup confirmation, phrase restoration and publication retry use an independent device store. Browser rotation now requires backup confirmation and retains both non-extractable keys plus the signed retry receipt across reloads. Authenticated witness-list reads are bounded and expose only recorded proof fields; these are not a current quorum count. The preview now prepares/restores recovery candidates, resumes saved proposals, reviews and signs witness statements, and activates with local candidate possession. Full OIDC browser journeys and original-app integration remain. |
| `generateAIContent`, `saveProviderCredential`, `generateClaudeContent` | Unported. Provider credentials, authorization, quotas and streaming/error contracts need coverage. |
| `sendSystemEmail`, `onReachCreated` | Unported. Durable mail queue, delivery retries and private-reach permissions required. |
| `onLifetreeCreated` | Partial replacement in atomic tree birth: quotas, Root Vision and guarded follow. Beds and other birth effects need audit against the complete trigger. |
| `onBedHomeMoved`, `onStayWritten`, `mintStayLeaves` | Unported. Bed home/occupancy and stay lifecycle remain. |
| `witnessWatering`, `checkWateringSchedules`, `resetLight`, `appreciateOffering`, `spendGlow` | Unported. Light accounting, witness authority, schedules and spending remain. |
| `onJoinRequestCreated`, `onNetworkInviteAccepted`, `requestInvite` | Community membership commands exist; mail effects, network invitations and full host enrollment policy remain. |
| `acceptTreeInvite` | Independent equivalent in migration 015: private/public seats, one-time claims, guardian qualification/validation and atomic circle creation. API/preview connected; full-browser journey still required. |
| `acceptKeeperInvite`, `acceptKeeperRequest`, `resignKeeper` | Independent equivalents implemented in migrations 009, 012–013; API/preview connected; database and HTTP tests. |
| `resignTreeKeeper` | Independent equivalent in migration 014; API/preview connected; secret-ledger, concurrency and rollback tests. Signed succession is not added by either implementation. |
| `formCommunityFromCircle` | Independent equivalent in migration 017; API/preview connected. Atomic formation, keeper authorization, birthplace and rollback tested; missing/secret roots require review. |
| `startDomainVerification`, `checkDomainVerification`, `startDoorClaim`, `checkDoorClaim`, `grantDoor`, `withdrawDoor`, `listDoorClaims` | Unported. DNS proofs, uniqueness, face grants and routing lifecycle remain. |
| `sendNewsletterEmails`, `unsubscribe` | Unported. Consent, queueing, batching and unsubscribe capabilities remain. |
| `listUsersAsAdmin`, `deleteUserAsAdmin`, `deleteMyAccount`, `mintSsoToken` | Unported. OIDC enrollment/sign-in exists, but account administration/deletion and cross-node SSO parity do not. |
| `beingPreview`, `facePreview`, `sitemap`, `faceEvents` | Unported. Public-only rendering and discovery must not expose private beings. |
| `deriveImageVariants`, `releasePicture` | Partial: migration 019 and local media store provide authorized immutable uploads and synchronous WebP variants. Migration 020 attaches ordered pictures to trees; picture release, complete reference tracking, garbage collection and original app integration remain. |
| `acceptOffering` | Shared acceptance law and reciprocal record construction now compile into the independent runtime; a server preparation helper creates canonical paired seals. Tests compare the existing record shape and reject missing standing, terminal status and dead receivers. Migration 040 and the database adapter now commit paired records, heads and answer atomically under current-standing locks; PostgreSQL tests cover concurrent acceptance and rollback of the entire operation. The authenticated acceptance endpoint is wired. Migration 041 requires ordinary readers to see both named bearers while recorded participants retain both agreement records; this tightens the existing public-label discrepancy. The preview lists visible offerings and reloads one for explicit acceptance review; a browser fixture checks success and lost-response refresh without replay. Migration 042 now creates listings, protected birth proofs and private recipient notices atomically, with source/bed authority, published pictures, target visibility and private-reference checks. The API accepts complete creation drafts; current recipient carers can read addressed private offerings. Migration 043 supplies protected edit/pause/withdraw/decline commands; the preview has pause/reopen, confirmed withdrawal and recipient decline, verified in a browser fixture. The preview now has creation/edit forms with named paginated choices, local pictures and explicit private-reference behavior; imported picture references are preserved unless replaced wholesale. Mail/push delivery, imported-picture fine-grained editing, original-app wiring and complete OIDC browser journeys remain. |
| `mintBlock`, `acceptAlignment` | Shared birth/signature/hash/watering laws now compile into the Docker runtime from the existing domain source. Migration 038 and the API now mint tree/vision blocks with shared birth rules, current-key proof checks, locked head concurrency, canonical hashes and atomic care/watering effects. Signed replay after a moved head is refused. Migration 039 provides privacy-filtered direct and paginated pulse reads; the preview displays tree/vision history and checks recorded content hashes. A device-key service and preview review/submit form now prepare signed text growth and optional tree watering, with one-attempt submission and account-change guards. The actual form passes a browser fixture using real device storage/signatures; a separate authenticated PostgreSQL API test accepts those service signatures and checks stale-head/unauthorized refusal and lost-response behavior. Full-chain/key-lineage verification, complete OIDC browser mint journeys, original-app integration, other consequences remain. Alignment migrations 044–045 now provide server-derived proposals, participant-private notes/reads, recipient rejection and atomic paired acceptance with current standing checks. Private counterpart protection, exact-party access, answer races and rollback are tested. The authenticated HTTP and session commands are wired; the separate preview supports proposal/notes/reviewed answers with a browser-verified lost-response refresh. Original-app integration and complete OIDC browser journeys remain. |
| `unmintBlock` | User assigned unmint work to another chat. Preserve that work; verify integration before final parity. |
| `formCircleFromEvent`, `duplicateEvent` | Migration 046 and the authenticated API now duplicate events with current author/community-keeper/staff authority, preserved place/visibility, fresh attribution, protected birth proof and an atomic permanent lineage link. PostgreSQL and HTTP tests cover privacy and rollback. Migration 047 now supports profile-backed standalone creation, community-keeper/staff creation, author/keeper/staff edits and one-way adoption by the keeper at the event’s own domain. Proofs and identity survive edits; pictures must be published. Migration 048 adds atomic circle formation/gathering with lineage and capacity serialization, current authority checks and rollback tests. Browser controls, deletion policy and original-app integration remain. |
| `indexPersonLid`, `indexTreeLid`, `indexVisionLid`, `indexLightHouseLid`, `indexCommunityLid`, `indexPulseLid`, `backfillLidIndex` | Migration 049 and GET /v1/beings now resolve visible local tree/vision/community/pulse/person LIDs through current RLS or the public person projection. Indexed source records avoid stale registry entries; multiple visible matches refuse with 409. PostgreSQL/HTTP tests cover hidden records, collisions and account isolation. Immutable registry bindings, global collision audit/backfill, Light Houses, federation and original /b navigation remain. |

## Client data and subscriptions

All eighteen existing Firebase service modules still require full-call-site review and
backend-neutral integration. This is in addition to the server exports above.

| Modules | Independent coverage |
| --- | --- |
| `core`, `accounts`, `authority`, `staffHands`, `governance` | Separate OIDC/session, own-name profile, personal logo/banner settings and public name search support; full original app sessions, profile/settings, authority management and subscriptions remain. |
| `trees`, `beings`, `spaces` | Tree reads/plant/basic edits/resignation; community reads/founding/basic edits/membership/invitations/keepership. Vision reads now cover visibility, author/root/joined filters and precise newest-first pagination; standalone vision creation and author/staff prose/visibility edits and ordered local pictures are available. Release preserves contribution records and removes only authorized incoming links. Remaining vision appearance, contributions, houses, complete settings and the rest of each module remain. |
| `media`, `exportBeing`, `subgraph` | Local binary upload/download transport and browser session upload exist; original media call sites and complete signed export/import execution remain. An offline signed additive-merge planner exists; it does not import data. |
| `pulses`, `engagement`, `covenants`, `holds`, `stays`, `watering`, `light` | Pulse reads and tree/vision chain append now have independent endpoints, with a separate visible-history preview. Standalone writes, original-app services/subscriptions and the remaining modules are unported. |

The graph abstraction in `services/store.ts` and `services/graph.ts` is a start, not a
replacement for document queries, live subscriptions, upload/download or server calls.

### Main application integration boundaries inspected

- `contexts/SessionContext.tsx` composes `hooks/useLifeseed.ts`; the latter imports
  Firebase authentication, account subscriptions, tree queries and direct Firestore
  guardian-link repairs. Selecting an OIDC provider alone cannot replace this hook.
- `useLifeseed.ts` also derives staff flags and auto-claim behavior from the charter
  email. Independent authority must continue to come from governed local database
  records, never copy email-based UI flags into server authority.
- `services/firebase.ts` remains the application's aggregate barrel. The separate
  independent session is not selected there. Existing call sites, listener teardown,
  profile projections and account-switch behavior require explicit adapters.
- `adapters/firestore.ts` supplies graph reads/writes to `services/store.ts` and
  imports Firebase initialization directly. The independent HTTP API still needs
  complete graph write coverage before replacing this composition boundary. Migration
  022 adds own joined/guardian writes, circle self-withdrawal and keeper guardian release;
  migration 023 adds all four directional community attestations with keeper and
  named staff-hand checks. Migration 024 adds garden placement/withdrawal with door,
  tree-carer and staff-hand rules. Migration 025 adds tree keepership requests and
  atomic invitation answers, keeping secret requests private. Other relationships
  and broader staff minting remain. Migration 026 adds keeper-authorized tree
  participation markers and privacy-filtered participant lists; event admission
  and capacity lifecycle are not implemented by this graph operation. All five read
  shapes now have an independent adapter, including pagination, circle authorization
  and timestamp conversion; the shared graph service composes with it.
- Personal appearance pictures now work in the preview, while
  `components/profile/ProfileAppearance.tsx` still calls Firebase upload, account
  writes and picture release. Palettes/inheritance and release must be ported too.

## Release evidence still required

- Original application features exercised with Firebase network access unavailable.
- Full authentication/recovery/browser journeys, host-door enrollment and first-keeper bootstrap.
- Secure VPS ingress/TLS, installation/upgrade, service health and durable scheduled work.
- Complete database, identity, media, configuration and key backup/restore. Existing Docker
  proof covers fresh application DB install, API restrictions, restart and DB data restore only.
- Complete signed exports including media and provenance; verified transactional import,
  additive merging, identity reconciliation, conflict reporting and overlapping-import tests.
- Existing backend regression checks and a four-layer review: correctness, architecture,
  security/data integrity and meaning. Commit remains subject to explicit human approval.
