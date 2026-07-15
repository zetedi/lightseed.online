# ROADMAP — where growth is invited next

The growing tips: what is alive now, next, later — and deliberately not yet.
Tend this file when seasons turn; don't let it promise what the roots can't hold.

## Alive now (before Lion's Gate, 8/8/2026)

- **Consolidation over surface.** The chain — tree, circle, community, domain,
  bed — is structurally closed. The remaining work is walking it: hand a phone
  to someone at the next fire at The O House and fix what they stumble on.
- Consecrate **The O House** in the app (name, photo, place, beds).
- The **guardian veto council test** in Per Auset — the social trial of the
  conscience mechanism.
- The **Listening Root** now stands in the virtual forest. Invite Sam Altman to
  plant its living sacred fig in Kataragama on 8/8; seek a cutting propagated
  and freely offered by the Jaya Sri Maha Bodhi's custodians in Anuradhapura,
  only if safe for the parent tree; if Sam cannot, Zoltán will. The virtual tree
  remains unvalidated until the living act tends it.
- **Rules parity pass** for the client-side visibility gates (trees, sanctuaries).
- perauset.com goes live on 8/8 (deploy `--only hosting:perauset`); printed QRs
  should carry the final domain (refresh mints after the move).

## Next (after 8/8)

- **Nodes become real (the domain–DB link).** Today a "node" is only skin:
  `inviteOnly` is a hardcoded global constant (never read from the DB, identical
  on every domain), accounts are instance-wide, and `node` visibility means
  merely "signed in." Recognise the node as **the community that owns a domain**
  — principle 11 once more: identity is *portable and open* (anyone may hold one
  account/lid across the whole instance — the door gates membership, never being),
  membership is *local* (a `member` edge to the node's host community; a node IS a
  community, so no new rel). Decided 2026-07-15 (see DECISIONS): identity open,
  membership local; **commons is a per-node mode, not a place** (every node may
  reflect the instance's public or stay a scoped pond, Indra's net; no privileged
  hub, only the node reflecting all public); some parts are *sensitive to light* — the ladder protects what
  is not yet ready for a wide gaze. Three phases, each its own ring:
  1. **The node's door becomes real** — `useConfig` reads the host community's
     `door` (open/invite/closed, already built) instead of the constant, so a
     keeper can open or close *their* node — its door now also governs **sign-up on
     its domain** (open = open sign-up delegated to the keeper; else invitation-
     gated), turning two gates into one; and a per-node **reflect-the-instance-
     public** toggle replaces the hardcoded `isHubDomain` unscoping, so commons
     becomes a setting any node can choose. Absent door keeps today's behaviour
     (invitation required); mechanical, no meaning-change.
  2. **Invitations carry the node** — stamp the host community on each
     `networkInvite` (**the domain it was sent from**); on accept, mint `member`
     (node) + `invited_by` (provenance), so one personal invitation carries someone
     from no-account to member-of-my-node, names the right node, and **opens that
     domain's OPEN communities** to them (tender ones still ask for their own key).
     A one-time link of every existing account to the origin node (lightseed, the
     node reflecting all public) grandfathers all current standing.
  3. **`node` visibility means "member of THIS node"** — not any signed-in being;
     and **"open" narrows from instance-wide to domain-scoped** (the open door
     shipped 2026-07-15 admits any account today — it becomes open-to-the-domain).
     Its own ring, because it redefines principle 4's node tier: node-scoped
     pulses/trees gain a nodeId, and `canView` mirrors the `community` branch.
     Nothing vanishes on day one (everyone is an origin-node member from phase 2).
  Precursor to Federation (below): one node truly whole before lids travel
  between many. Open questions recorded in QUESTIONS.md (2026-07-15).
- **Stay ripening**: keeper notification emails for bed requests; calendars.
- **Hosted AI, live**: the node credential (`credentialScope: 'node'`) wired in
  functions, funded by the node share; `Intelligence.hosted` becomes real.
- **AI-need chooser** for tree support (`choice: 'ai_need'` in domain/support).
- Mother-tree denormalised flag → badge on cards and map markers.
- Consent handshake for sanctuary step-ins if the network outgrows trust-by-
  acquaintance (the `join_request` pattern is ready).
- The veto surfaced on growth timelines, not only the pulse page.

## Later (seasons away)

- **The payment rail**: Stripe-or-kin webhooks writing `supports` and `stays`
  settlements; payouts to carers (start with ONE carer in ONE country).
- **Federation (adoption ladder layer 4)**: nodes running elsewhere, lids
  traveling between them; chain-as-tree for every being across nodes.
- **Own models**: node-level intelligences; big nodes with private ones.
- **The Code Tree** — the development locus as a first-class Being: not a
  hidden GitHub permission but a tree with a council, visible lineage, and
  explicit authority. Its relations, in the LIN's own tongue:
  `__maintained_by__ Person · __reviewed_by__ Council · __serves__ Community ·
  __implements__ Root · __deployed_as__ Node`. A community/group Reach opens a
  **development session** (itself a Being: participants, purpose, root commit,
  proposals, reviews, authorizedBy, resulting commit + ring) — so code
  development becomes a social, traceable act. People who cannot code can still
  witness the proposal, understand its purpose, question its consequences, test
  the lived result, and take part in whether it belongs. The flow:
  need → Reach → session → root inspection → proposal → review → human
  authorization → commit + ring + deployment.
- Embedded Gaussian-splat viewer for sanctuary 3D doors (today: external URL).
- Initiation layer growth: the git ledger beyond its first three sponsors.
- **The Book** — the White Paper reader generalized: every being's root as a
  readable book. The same data model applies at every scale — the Book of Life,
  the book of a grocery store, the book of a brain — chapters as documents,
  rings as history; or a Roam-like garden of linked thought.
- **`root/GLOSSARY.md`** — the linguistic rings (Lumo's suggestion): a glossary
  of the living vocabulary (Lifetree, Pulse, Carry, Tend, Listening, Resonance,
  Bloom…), planted when the language outgrows LIN's Language section. Recording
  meanings keeps humans and AIs speaking the same tongue without ambiguity.

## Deliberately not yet

- **Money in the UI.** No prices, no balances, until the care economy's rail
  ships whole. (Members before launch keep today's functions free.)
- **Growth mechanics.** No feeds optimised for attention, no counters that
  gamify. The 144 cap is a feature; division is the growth.
- **Federation before the first node is whole.** One cell, complete and healthy,
  then mitosis.
- **AI autonomy on chains.** Beings' voices are carried, disclosed, and signed
  by real hands until beings can sign for themselves.
