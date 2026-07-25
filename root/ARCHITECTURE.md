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

React 18 + TypeScript (full strict) + Vite + Tailwind, as a PWA
(`vite-plugin-pwa`, prompt-style updates via `UpdateToast`). Firebase: Firestore
(`ignoreUndefinedProperties: true`), Auth (dynamic authDomain per hosted domain),
Storage, Functions, multi-site Hosting (`app` → lifeseed-75dfe, `perauset`).
Leaflet is bundled from npm, lazy-loaded on first map render (`services/leaflet.ts`).

## Layers: the dependency direction

```
domain/     pure rules, no backend, no React: ALWAYS testable (tests/ mirrors it)
adapters/   the Store port (firestoreStore: links CRUD by deterministic id)
services/   Firebase aggregates (barrel: services/firebase.ts) + weather, refreshBus
hooks/      session (useLifeseed → SessionContext), feeds, facts, visible-lightHouses
components/ the faces; components/sections/ = the shared Being anatomy (8 organs)
pages/      tab-level shells; App.tsx is the single conductor (overlays, routing)
```

New logic starts in `domain/` with a test. UI reads domain truths; services carry
them; nothing in `domain/` imports upward.

## The collections (see /model in the app: the crystal)

`persons` `users` `admins` `config`: identity & account. The public, server-owned
`config/dataAuthority` singleton names the portable LID of the node governing
this backend (`version: 1`, `nodeLid`); browser clients cannot write it.
`lifetrees`: the seed beings; chain fields frozen; provenance (`plantedAt`+coords).
`pulses`: one ledger for growth/care/events/decisions/reaches/offerings; an offering may carry
`offeringAppreciationLight` (suggested after-gift, never admission).
`links`: the LIN: `from__rel__to`; rels: guardian, co_owner, steward, observer,
member, joined, participant, join_request, **rooted** (Light House→tree),
**shelters** (Light House→community), **invited_by** (newcomer→community; append-only
provenance, grants nothing; see domain/communityDoor). Doc id MUST equal `from__rel__to`
(rules bind it: authority is resolved by path, so an unbound id would be forgeable).
`visions` `communities` (bearing the **door**: open/invite/closed) `lightHouses`
`stays` `alignments` `supports` (server-only)
`intelligences` `personas` `memories` `providerCredentials`: the intelligence commons.
`networkInvites` `communityInvites` (shareable /i/ door keys; revoked, never deleted)
`treeOwnershipInvites` `communityTreeInvites` `inviteRequests`.

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
- **Domain scoping (current compatibility behavior)**: hardcoded aliases
  (`lightseed.online`, `lifeseed.online`, and local development hosts) are treated
  as always-reflecting and therefore unscoped; other hostnames filter
  forest/pulses/events/visions by `domain == hostname`. A host community's
  `reflectsPublic` can open reflection on other domains, but the aliases cannot
  yet close it. This is not the intended identity law: a domain alone is neither
  a node nor a hub. The target is explicit node sovereignty over its forest
  database, with **hub = node + community-chosen public reflection**. Custom
  landings remain community DATA.
- **The map**: pixel-space clustering (50px) over trees + Light House pseudo-beings;
  Light Houses seed clusters (lighthouse precedence); Seed-of-Life petal expansion;
  popups via Leaflet autoPan (bottom-anchored popups can never flip; don't try).
- **Refresh bus** (`services/refreshBus.ts`): mutation sites `announce(topic, id?)`;
  mounted views re-fetch; the feed prunes deleted ids surgically.
- **Being links**: `/b/<lid>` resolves permission-aware across collections
  (`findBeingByLid`) and opens the right profile; QRs are minted lazily onto docs.
- **The White Paper**: the About page bundles these exact root/ documents at
  build time (`?raw` imports); the deployed node carries the constitution it
  grew from, inspectable by anyone it serves.
- **The gate**: `npm run check` = tsc + eslint + vitest (unit), `npm run test:rules`
  = emulator suite. Deploy: `npm run build && firebase deploy --only
  hosting[,firestore:rules,functions]`. The firebase CLI is Homebrew-owned.

## Known debts (kept honestly)

- Backend custody is now explicit, but backend division is not: hosted domains
  still share their authority node's instance-wide Auth and database, and the
  hardcoded `isHubDomain` aliases still govern query scoping. The next boundary
  is a self-describing export/import and independent backend bootstrap; only
  after data actually moves may a former Host declare itself a Node.
- Key revocation/epochs are not built: a key once published binds forever through the
  append-only lineage (signature slots stay auth-gated; see the continuity ring, 2026-07-18).
- Client-side visibility gates (trees, Light Houses) await full rules parity.
- Light House step-in consent is keeper-side only since the shelters migration.
- Mother-tree badge lives on the tree page only (no denormalised flag yet).
- Payments, hosted-AI node credential, and the AI-need chooser are scaffolded,
  not live (see ROADMAP).
