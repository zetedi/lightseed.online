# ARCHITECTURE — how it currently lives

The current organism: systems, boundaries, data flow, interfaces.

When architecture drifts from implementation, the code reveals the CURRENT
BEHAVIOR — not necessarily what the community intended, what life needs, or
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

## Layers — the dependency direction

```
domain/     pure rules, no backend, no React — ALWAYS testable (tests/ mirrors it)
adapters/   the Store port (firestoreStore: links CRUD by deterministic id)
services/   Firebase aggregates (barrel: services/firebase.ts) + weather, refreshBus
hooks/      session (useLifeseed → SessionContext), feeds, facts, visible-sanctuaries
components/ the faces; components/sections/ = the shared Being anatomy (8 organs)
pages/      tab-level shells; App.tsx is the single conductor (overlays, routing)
```

New logic starts in `domain/` with a test. UI reads domain truths; services carry
them; nothing in `domain/` imports upward.

## The collections (see /model in the app — the crystal)

`persons` `users` `admins` `config` — identity & account.
`lifetrees` — the seed beings; chain fields frozen; provenance (`plantedAt`+coords).
`pulses` — one ledger for growth/care/events/decisions/reaches; overlay-key rules.
`links` — the LIN: `from__rel__to`; rels: guardian, co_owner, steward, observer,
member, joined, participant, join_request, **rooted** (sanctuary→tree),
**shelters** (sanctuary→community), **invited_by** (newcomer→community; append-only
provenance, grants nothing — see domain/communityDoor). Doc id MUST equal `from__rel__to`
(rules bind it: authority is resolved by path, so an unbound id would be forgeable).
`visions` `communities` (bearing the **door**: open/invite/closed) `sanctuaries`
`stays` `alignments` `supports` (server-only)
`intelligences` `personas` `memories` `providerCredentials` — the intelligence commons.
`networkInvites` `communityInvites` (shareable /i/ door keys; revoked, never deleted)
`treeOwnershipInvites` `communityTreeInvites` `inviteRequests`.

## Rules philosophy

Queries must be **provable**: list queries carry the constraints the rules demand
(visibility filters for the signed-out, `hostUid`/`participantUids` for inboxes).
Fine-grained gates live as pure domain functions (`canViewTree`,
`canViewSanctuary`, `canView` for pulses) mirrored by the rules; overlay updates
are constrained to exact key sets via `diff().affectedKeys().hasOnly(...)`.
Deterministic link ids make ownership checks O(1) (`exists(links/uid__rel__id)`).

## Flows worth knowing

- **Domain scoping**: non-hub hostnames filter forest/pulses/events/visions by
  `domain == hostname`; the hub is unscoped. Custom landings are community DATA.
- **The map**: pixel-space clustering (50px) over trees + sanctuary pseudo-beings;
  sanctuaries seed clusters (lighthouse precedence); Seed-of-Life petal expansion;
  popups via Leaflet autoPan (bottom-anchored popups can never flip — don't try).
- **Refresh bus** (`services/refreshBus.ts`): mutation sites `announce(topic, id?)`;
  mounted views re-fetch; the feed prunes deleted ids surgically.
- **Being links**: `/b/<lid>` resolves permission-aware across collections
  (`findBeingByLid`) and opens the right profile; QRs are minted lazily onto docs.
- **The White Paper**: the About page bundles these exact root/ documents at
  build time (`?raw` imports) — the deployed node carries the constitution it
  grew from, inspectable by anyone it serves.
- **The gate**: `npm run check` = tsc + eslint + vitest (unit), `npm run test:rules`
  = emulator suite. Deploy: `npm run build && firebase deploy --only
  hosting[,firestore:rules,functions]`. The firebase CLI is Homebrew-owned.

## Known debts (kept honestly)

- Client-side visibility gates (trees, sanctuaries) await full rules parity.
- Sanctuary step-in consent is keeper-side only since the shelters migration.
- Mother-tree badge lives on the tree page only (no denormalised flag yet).
- Payments, hosted-AI node credential, and the AI-need chooser are scaffolded,
  not live (see ROADMAP).
