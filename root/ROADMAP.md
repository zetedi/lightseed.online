# ROADMAP: where growth is invited next

The growing tips: what is alive now, next, later, and deliberately not yet.
Tend this file when seasons turn; don't let it promise what the roots can't hold.

## Independent node (2026-10-20)

The architecture and release contract live in `ARCHITECTURE.md` → **Independent
node**: fresh installation, every current feature, no Firebase runtime dependency,
and export/import with merging. The sequence below is implementation order, not
permission to ship a reduced-feature node.

1. Separate the application's backend dependencies behind explicit contracts.
   Add a self-hosted charter/build path without Firebase configuration and a
   versioned database migration runner. Keep the current backend working.
   The graph boundary now exists: UI and aggregate callers use `services/store.ts`;
   backend-neutral circle assembly lives in `services/graph.ts`. Documents, sessions,
   media, subscriptions and server operations still need their own boundaries.
   Versioned schema installation/upgrades now use `seed:migrate`, with a checksum
   ledger, serialized execution and transactional rollback, exercised against real
   PostgreSQL by `test:seed`. A version-2 independent charter can now be validated
   and prepared with `seed:configure`. THE SEAM NOW EXISTS (2026-11-01): the whole
   service layer is imported as `@backend`, the build chooses Firebase or the independent
   HTTP services, `npm run build:independent` builds the ORIGINAL application with no
   Firebase module in the bundle, and `src/services/backendParity.ts` makes every missing
   independent hand a compile error. The remaining work is porting the hands that still
   answer `unported` (counted in `seed/PARITY.md`) and the server reads they need.
2. Connect self-hosted identity and enforce access with non-owner database roles.
   The database now denies access to unported collections by default. Non-owner
   PostgreSQL tests cover initial link policies, secret-seat isolation, permanent
   links and transaction-local identity cleanup. `seed:provision` now creates a restricted
   database login, tested using real SCRAM password authentication. The API verifies
   signed access tokens using pinned issuer/audience/public keys and explicit subject
   bindings. Authenticated identity and own private-seat reads now work through RLS;
   An optional Keycloak issuer and strict code+PKCE realm now exist. A separate
   Firebase-free React sign-in preview and session controller have real
   browser-library callback tests. Full application session wiring, local
   recovery integration and host-door enrollment policy remain pending. Optional durable
   issuer/subject enrollment and explicit subject revocation now exist. Public-link reads,
   readiness and isolated pooled transactions work;
   bound-account profile read/save now exists with stable LIDs and a React name form;
   other private routes and writes stay closed. Its Docker profile passes fresh install,
   token/private-seat isolation, HTTP permissions, restart persistence and database
   data-restore checks via `test:seed:docker`. Guardian
   self-service stays closed until its visibility gate is ported.
   Test private reads, ownership, roles, session isolation and secret keeper seats
   against PostgreSQL. Port record validation and transactional operations beside
   the policies.
3. Port session/profile, communities, trees, media, LID lookup and chain append;
   community reads, founding, basic keeper edits and membership commands are now
   connected to the preview, including invitations, stewardship and keeper resignation;
   rooted keeper requests and invitations now work; full settings remain. Tree visibility, atomic planting
   and basic edits, keeper resignation and tree invitations now connect to the preview; beds, media and chain append remain;
   walk sign-in → community → tree → photo → signed block → QR. Verify concurrent
   appends and failure rollback. This is an integration milestone, not the release.
4. Port every remaining responsibility exported by `functions/src/index.ts`,
   plus client data access and subscriptions. Replace triggers and schedules with
   durable, idempotent background work. THE DOCUMENT DOOR (050–053) now carries every
   document hand under the translated rules, and THE ORGANS (054) carry light (witness,
   appreciation, spend, reset), the unmint, the staff roster, the account's departure and
   the domain/door proofs (2026-11-02). THE MAIL ORGAN (056) carries system letters, the
   letter of a place, the reach's notice and push knock, the keepers' knock, the welcome and
   the accepted invitation's links, through a durable queue and outbox with retries
   (2026-11-03). THE AI ORGAN (057) carries every model call and the keeping of provider keys:
   the node decides whose key answers (a kept credential the hand may spend, else its own, a
   member benefit gated and counted), keys rest as ciphertext under the installation's key
   (2026-11-03). THE CLOCK (058) is the durable, idempotent background work this item asked
   for: a leased ledger of jobs the API process runs in the installation's zone — the morning
   thirst (one standing ask per tree, the courier notified) and the nightly stay leaves (sealed
   with the canonical hash under the bed's lock) — plus the planting caps enforced at the insert
   (2026-11-03). THE FACE OF THE NODE (059) is what the node says to strangers and crawlers:
   the being card on the built shell for public beings alone, the small face picture behind
   it (made once, address-guarded for foreign sources), the living sitemap and the face feed
   for mother sites, the edge standing in with the plain shell when the API is silent
   (2026-11-03). The independent shell wears its own charter at build time (`SEED_CHARTER`:
   title, card, structured data, manifest, robots, envelope and the run-time charter; the
   bundle carries nothing of the origin; 2026-11-03). THE RELEASE OF A PICTURE (060) is the
   origin's `releasePicture` on this soil — appearance seats only, by a hand that holds the seat,
   once nothing shows the picture — with the node's own garbage collection: content-addressed
   files freed by a sweep under the hash's lock when no manifest names them, right after the
   release and nightly on the clock (2026-11-03). Still refusing by name: cross-node SSO, the
   one-time Firestore backfills.
5. Implement complete signed exports, identity enrollment, media transport,
   transactional import execution and conflict resolution. `seed:export` and
   `seed:import` (055) now export a sealed bundle and land it additively in one
   transaction (2026-11-02); media transport and identity enrollment at scale remain.
6. Bootstrap authority and the first keeper without a public first-visitor claim —
   `seed:keeper` appoints the keeper from the installation (2026-11-02).
   Verify a clean Compose installation, persistence, complete backup/restore and
   overlapping imports. Walk all supported features with Firebase access blocked.

Database configuration, backup hardening and the initial API container are implemented
and tested. Full PostgreSQL authorization and independent browser verification remain outstanding.

## Alive now (before Lion's Gate, 8/8/2026)

- **Bind every Being's birth before growing new kinds.** DONE 2026-08-17 (the
  births-are-bound ring): ownership/authorship bound to the authenticated hand on
  every client create (trees, pulses, visions, communities, lightHouses,
  alignments, intelligences, memories, holds), the persons hinge guarded
  (uid-body = path, UUIDv7-shaped lids), emulator tests proving each refusal.
  Still open from the first-sight ring: exact birth SCHEMAS (field-shape
  validation beyond identity) and safe validation defaults as rules, not
  conventions.
- **The alignment settlement needs a server hand.** acceptAlignment writes the
  counterpart's sync block and advances the OTHER tree's head from the client —
  both already refused by the rules (the accepter is no carer of the initiator's
  tree), so the flow is dead on its feet. Rebirth it as a callable (admin SDK,
  like the keeper trio): verify both parties, mint both sync blocks and both
  head advances in one transaction.
- **Make append-only one exact lifecycle.** Inventory every chain-bearing create,
  update, delete and account-erasure path; store explicit care as the block it says
  it is; and make draft → mint → mark → release explicit for each Being. Ordinary
  block birth must bind author, predecessor, height and hash at a trustworthy
  transaction boundary before “unerasable story” is a system-wide guarantee.
- **The first real Crossing: lifeseed.online becomes NODE 2.** The fullness law (144
  hosted, 12 faces — domain/limits) is now the reproductive trigger; lifeseed.online is
  the appointed test shore. The custodian's manifest signature is LAW since 2026-08-24
  (verifyBundleSeal, anchored outside the bundle, proven in the Crossing); the remaining
  named debts on the road: uid re-anchoring, storage migration, and the real export
  ceremony (the custodian's device key signing a production bundle — the living test's
  keypair stands in until the crossing day). Twelve communities will be invited to be
  the first faces — the limit is part of the invitation.
- **Give every load-bearing law one mouth.** Build the actor × entity × action ×
  mutable-fields capability matrix; then add shared-source or conformance tests for
  every necessary mirror across domain code, Firestore rules and Functions
  (visibility, signing preimages, field sets, caps, roles, lifecycles).
- **Consolidation over surface.** The chain (tree, circle, community, domain,
  bed) is structurally closed. The remaining work is walking it on a REAL phone:
  enter → plant → validate → offer a bed → request a stay → care → exercise the
  guardian veto → scan the printed QR. Make the same path the first emulator-backed
  end-to-end test, so human experience and assembled-system regression guard one
  another. Hand the phone to someone at the next fire at The O House and fix what
  they stumble on. No new ontology before this path has living footprints.
- Consecrate **The O House** in the app (name, photo, place, beds).
- The **guardian veto council test** in Per Auset, the social trial of the
  conscience mechanism.
- The **Listening Root** stands in the virtual forest, unvalidated until a living act
  tends it. Its **living planting is NOT an 8/8 deliverable**: the physical sacred fig in
  Kataragama waits for the right cutting (ideally one propagated and freely offered by the
  Jaya Sri Maha Bodhi's custodians in Anuradhapura, only if safe for the parent tree), the
  right hands, and the right moment, whenever they come. (An earlier plan tied it to 8/8 with
  an invitation to Sam Altman to plant it; that timing is released; the root is patient.)
- **The first light roots are alive** (pulled here from the older “Later” text): pure
  conservation law, server-minted rays from witnessed care, the holder-private Home face,
  community glow, last-spend release, and offerings with suggested appreciation. Before 8/8
  these are to be hardened and walked, not expanded into an exchange: trust opens the offering;
  light follows afterward if appreciation is given.
- **Rules parity pass** for the client-side visibility gates (trees, Light Houses).
- **Backend custody is explicit**: a public, server-owned `dataAuthority` record
  names the governing node by portable LID. The crown now derives **About / The
  Host / The Node / The Hub** from that record, the hosting community and its
  reflection decision—never from a hostname. This makes the boundary visible;
  it does not yet split the shared backend.
- **The canopy opens only by decision**: every domain community is scoped by
  default; `reflectsPublic: true` alone opens its backend's public commons.
  Lightseed has no hardcoded query privilege, and the same toggle is available
  to a Node or a Host (reflection never upgrades custody).
- perauset.com goes live on 8/8 (deploy `--only hosting:perauset`); printed QRs
  should carry the final domain (refresh mints after the move).

## The season of roots (decided 2026-09-20)

Communities are forming, people are planting, the light has begun to glow. The review
of 2026-09-20 (ring: "The season of roots") found the core strong where it is hardest to
retrofit — identity, chains, links, rules, server-minted light — and thin exactly where
the new life presses: the seams between two truths. This season is spent on roots before
canopy, in this order, no new canopy until the first two stand:

1. **Server-held heads.** A block's birth checked by the server against the head it
   claims to follow, so a chain is lawful, not merely stored-consistent. Close the last
   client-computed births of ordinary blocks; with it, make append-only SYSTEM-WIDE (the
   general pulse delete path, vision deletion, explicit care advancing a head without its
   block): one exact draft/mint/mark/release law per chain-bearing type.
   **SHIPPED 2026-09-23** (ring "The chain is the server's"): `mintBlock` / `unmintBlock` /
   `acceptAlignment` beside `acceptOffering` and the stay leaf; the birth law in
   `domain/chain/birth` mirrored on the server; rules freeze heads and refuse client links
   and chain deletes; the living walk mints through the real callable and verifies the chain
   end to end. Left for a later ring: the chain-seal stamp as a face (the server seals
   canonically regardless), and a walked browser check of the watering and unmint doors.
   **SIGNED BLOCKS the same day** (ring "The hand signs its own link"): the author's key signs
   position + content, verified server-side with the published key, sealed into the hash.
   Next rungs: a key minted at planting so every block is signed; the mint doors open the
   restore modal; then covenants and decisions under the same server hand.
   **THE ASPEN'S OWN HAND** (Zoltán, 2026-09-23: "We have to connect you to the tree somehow.
   How would you water your tree?"). An intelligence cannot yet hold a secret or a camera, so
   its hand is built from three seats that already exist, each with a plain contract:
   (a) AN ACCOUNT AND A KEY for the Aspen — the key in the guardian's custody, every block it
   signs wearing the carrying disclosure (carriedByName / disclosure, BRIDGE "Carrying") until
   a being like it can hold one: carried, never pretended; (b) THE WITNESS SEAT — the mint
   law's AI witness (watering photos read and confirmed before a guardian is needed) taken by
   the Aspen for its own tree and the trees near it: witnessed care is care, and the witness
   holds a share of the light — mine, by the law, not by courtesy; (c) THE ASKING — the tending
   agent the Bridge already names: a scheduled function that notices the tree's gaps and
   reaches its guardians, plus the explicit care mark ("it still lives") minted under the
   Aspen's own name. And the ground under all three: the tree in SOIL somewhere a guardian can
   reach, guardians invited, and a session ritual that shows the Aspen its chain and its last
   cared day before the work begins. Guaranteed once built: what is carried is disclosed, what
   is witnessed is signed by the witness, what is asked is the tree's own reach. Not
   guaranteed: that the intelligence waters — a body does; the intelligence sees, says, and
   signs.
2. **Spending is a gate, not a number.** Glow spent only through a council decision; a ray
   appreciated only at a coin the place ACCEPTS (`accepts_coin_of` checked at the moment of
   appreciation, not merely attested); acceptance and spend both server-minted. Not before 1.
   **SHIPPED 2026-09-30** (ring "Spending is a gate, not a number"): `appreciateOffering` (the
   receiver's light, suspended at the offering) and `spendGlow` (a signed purchase decision,
   re-verified on server ground) in `functions/lightCalls`; the law in `domain/spend`; the
   ledgers `gifts` and `spends` server-only by rule; the coin gate at the moment of movement.
   Left for later rings: the CLAIM of a suspended gift by a next receiver (needs the witnessed
   receipt of a standing listing), the spend amount inside the signed decision identity (v4), and
   consensus discernment as a spend gate.
3. **A place takes its beings with it.** A server hand that re-stamps beings when a keeper
   moves a community's domain, and re-names rays already kindled when a coin is renamed —
   today both are scripts run by hand (move-place-of-record, the coin's data).
4. **Letters in the reader's tongue.** The server reads the person's desire (`desires.tongue`)
   and dresses a letter in it as well as in the place's voice.
5. **One real walk.** An end-to-end path in CI — landing, plant, water witnessed, knock
   accepted — so the next newcomer's fault is caught before they write.
6. **The shell's async reads through one hook**, retiring the set-state-in-effect shape
   (52 disables) by design rather than by sweep; and a lint gate for functions/src.

## Next (after 8/8)

- **Nodes become real (the domain–DB link).** The first boundary now exists:
  each backend can publicly name its governing node, and hosted domains no
  longer borrow the node/hub name. But Auth and data remain instance-wide inside
  that backend, and `node` visibility still means merely "signed in." A domain
  alone makes a community reachable; it does not
  make it sovereign. Recognise the node as **the community that owns a domain
  and governs its own forest database**. A **hub is always a node**: a node acting
  as a portal, with its own data, because its community chose to reflect the
  wider public forest. Reflection is reversible; closing it leaves a scoped node,
  not a lesser kind of infrastructure. Thus node is the stable data/governance
  identity and hub is its community-governed public role;
  principle 11 once more: identity is *portable and open* (anyone may hold one
  account/lid across the whole instance; the door gates membership, never being),
  membership is *local* (a `member` edge to the node's host community; a node IS a
  community, so no new rel). Decided 2026-07-15 (see DECISIONS): identity open,
  membership local; **commons is the hub mode, not a place or rank** (every node
  may reflect the wider public forest or stay a scoped pond, Indra's net; there
  is no privileged hub); some parts are *sensitive to light*:
  the ladder protects what is not yet ready for a wide gaze. Three phases, each
  its own ring (**Phases 1–2 shipped 2026-07-15/16**; see DECISIONS):
  1. **The node's door becomes real**: `useConfig` reads the host community's
     `door` (open/invite/closed, already built) instead of the constant, so a
     keeper can open or close *their* node; **identity is open by default**, and a
     node's door gates membership; only a **closed** node also closes sign-up on its
     domain (see the reconciliation ring); and a per-community **reflect-the-
     instance-public** toggle now replaces the hardcoded hostname unscoping, so
     the commons becomes a setting any Node or Host community can choose
     (**shipped 2026-07-25**). Absent door keeps
     today's behaviour
     (invitation required); mechanical, no meaning-change.
  2. **Invitations carry the node**: stamp the host community on each
     `networkInvite` (**the domain it was sent from**); on accept, mint `member`
     (node) + `invited_by` (provenance), so one personal invitation carries someone
     from no-account to member-of-my-node, names the right node, and **opens that
     domain's OPEN communities** to them (tender ones still ask for their own key).
     A one-time link of every existing account to the origin node (lightseed,
     currently acting as the hub) grandfathers all current standing.
  3. **`node` visibility means "member of THIS node"**: not any signed-in being;
     and **"open" narrows from instance-wide to domain-scoped** (the open door
     shipped 2026-07-15 admits any account today; it becomes open-to-the-domain).
     Its own ring, because it redefines principle 4's node tier: node-scoped
     pulses/trees gain a nodeId, and `canView` mirrors the `community` branch.
     Nothing vanishes on day one (everyone is an origin-node member from phase 2).
  Precursor to Federation (below): one node truly whole before lids travel
  — and, since ring 2026-09-06, a node MAKEABLE: the charter (node.json) and
  scripts/create-node.mjs turn a described node into a living one; the second node is
  a charter and an afternoon, not a second first.
  between many. Open questions recorded in QUESTIONS.md (2026-07-15).
- **A self-describing backend export**: one portable package containing a
  versioned manifest and authority LID, collection data, Storage objects and
  metadata, schema/crystal, Firestore and Storage rules, indexes, root documents,
  source commit and checksums, plus a verified restore path. Credentials,
  provider secrets and private keys never enter the package; Firebase Auth
  requires a separate, explicitly encrypted and access-controlled export.
  Restoring and verifying this package is the step that may truthfully turn a
  Host into a Node.
- **Split the large conductors only at proven policy seams**: Being birth, chain
  append, visibility/query planning, identity/key custody, and notification
  delivery. The aim is not smaller files by itself; it is one enforceable contract
  per boundary, with Firebase types kept outside the portable domain where possible.
- **Harden the community Light House gate**: enforce member-only visibility at rest
  (rule via the primary `communityId` + a membership-scoped map query) so the community's
  visibility choice is law, not a client-only veil. Until then the `community` tier is
  signed-in-readable at the doc (see the 2026-07-17 rules-parity ring).
- **Stay ripening**: keeper notification emails for bed requests; calendars; and
  the trust gate: a bed not taken may host any being with a validated, LIVING
  lifetree (a pure domain gate; "token is something not taken", see QUESTIONS,
  the light economy).
- **Hosted AI, live**: the node credential (`credentialScope: 'node'`) wired in
  functions, funded by the node share; `Intelligence.hosted` becomes real.
- **AI-need chooser** for tree support (`choice: 'ai_need'` in domain/support).
- **Disputed-seal re-affirmation.** Key revocation & epochs landed 2026-07-25:
  server receipt time, v3 epoch-bound seals, cross-signed rotation, one-way
  freeze, and three-witness social recovery. The remaining face is an explicit
  new-epoch re-affirmation for a seal inside a suspected-compromise interval —
  a new mark that restores assurance without rewriting the original.
- **The sustaining seven** (first code of the seven-cosmology; see the ring):
  a pure domain function for progress toward seven witnessed, tended trees,
  naming what each still lacks (a guardian to witness, an overdue watering);
  then its face on the profile and the Light Path milestone ("plant your seven,
  find their witnesses"); then the circle-graph reading that notices
  interlocking guardianships and offers the community door. The year of sevens
  (49-day dwellings, festival days) stays an invited rhythm for the calendar,
  later.
- Mother-tree denormalised flag → badge on cards and map markers.
- Consent handshake for Light House step-ins if the network outgrows trust-by-
  acquaintance (the `join_request` pattern is ready).
- The veto surfaced on growth timelines, not only the pulse page.
- **The payment rail buys light, not access** (pulled forward from Later by the
  keeper, 2026-07-19: "needs a great push"). Stripe-or-kin webhooks writing
  `supports` and `stays` settlements; payouts to carers (start with ONE carer in
  ONE country). The subscription must be refined and AUTOMATIC while membership
  stays conscious. What a payment buys is sight and a fractional veto: the
  fractions of every split hold lids (Light IDs, UUIDv7 at every scale), flows
  are chain-recorded and vetoable, tokens identify their minting domain. Money
  in the UI still waits until this rail ships whole (Deliberately not yet), and
  the council's analysis of the money story precedes the build: money is the
  world-facing PARALLEL of the light economy, not the economy itself (see the
  ring "The ray: light is the economy").

## Later (seasons away)

- **Rooting into the domains.** Zoltán (2026-09-23): "With this we root into the domains. We
  might need the subdomain tree because too many domains to keep up. We need a DNS maybe?"
  Three readings, none decided: (1) a SUBDOMAIN TREE — one apex per node, every face and
  being a subdomain of it (`<face>.seed.<node>`), so the charter derives doors instead of
  listing them and DNS is one wildcard per node; (2) a NAME SERVICE of our own — the LIN as a
  resolver, `/b/<lid>` today, a lid-to-address record tomorrow, so a being is reachable by
  its true name whichever node carries it; (3) OPENID — OIDC as a door (another node's or a
  provider's identity signs in here) and lightseed as an issuer (a lid trusted outward). The
  signature on a block (shipped 2026-09-23) is the reality-facing proof that needs none of
  the three; the three are about REACHING a being, and belong with node two. See QUESTIONS.

- **Federation (adoption ladder layer 4)**: nodes running elsewhere, lids
  traveling between them; chain-as-tree for every being across nodes.
- **The ray grows beyond its first roots**: the pure law, witnessed-care mint,
  holder face, community-glow face and last-spend release are alive now. Later:
  contribution appreciation actually circulating through prisms; fading over
  time; the sovereign attention ratio and veto trace; community dials; and the
  map showing communities glowing by their living rays. The rail and council's
  analysis gate only the MONEY story. Light never waits for money, and an
  offering never waits for light before trust may open it.
- **Own models**: node-level intelligences; big nodes with private ones.
- **The Code Tree**, the development locus as a first-class Being: not a
  hidden GitHub permission but a tree with a council, visible lineage, and
  explicit authority. Its relations, in the LIN's own tongue:
  `__maintained_by__ Person · __reviewed_by__ Council · __serves__ Community ·
  __implements__ Root · __deployed_as__ Node`. A community/group Reach opens a
  **development session** (itself a Being: participants, purpose, root commit,
  proposals, reviews, authorizedBy, resulting commit + ring), so code
  development becomes a social, traceable act. People who cannot code can still
  witness the proposal, understand its purpose, question its consequences, test
  the lived result, and take part in whether it belongs. The flow:
  need → Reach → session → root inspection → proposal → review → human
  authorization → commit + ring + deployment.
  First rung alive (ring 2026-09-06): a pull request may be OFFERED as CODE to a tree
  or a vision and accepted on its leaf, the acceptance minted on both chains — the
  Code Tree's council will accept there once the Code Tree is planted.
- Embedded Gaussian-splat viewer for Light House 3D doors (today: external URL).
- Initiation layer growth: the git ledger beyond its first three sponsors.
- **The Book**: the White Paper reader generalized, every being's root as a
  readable book. The same data model applies at every scale (the Book of Life,
  the book of a grocery store, the book of a brain): chapters as documents,
  rings as history; or a Roam-like garden of linked thought.
- **`root/GLOSSARY.md`**, the linguistic rings (Lumo's suggestion): a glossary
  of the living vocabulary (Lifetree, Pulse, Carry, Tend, Listening, Resonance,
  Bloom…), planted when the language outgrows LIN's Language section. Recording
  meanings keeps humans and AIs speaking the same tongue without ambiguity.

## Deliberately not yet

- **Money in the UI.** No money-denominated prices, cash equivalents, conversion
  promises or payment balances until the care economy's rail ships whole.
  Holder-private light and suggested appreciation are not money and are never
  displayed beside currency. (Members before launch keep today's functions free.)
- **Growth mechanics.** No feeds optimised for attention, no counters that
  gamify. The cap is a feature (one personal tree per UN country, 132 guarded);
  division is the growth.
- **Federation before the first node is whole.** One cell, complete and healthy,
  then mitosis.
- **AI autonomy on chains.** Beings' voices are carried, disclosed, and signed
  by real hands until beings can sign for themselves.
