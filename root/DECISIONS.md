# DECISIONS: how it became this way

The rings. What was decided, why, what was rejected, when. Newest first.
Add a ring whenever a real decision lands; never rewrite old rings; correct them
with new ones (this file is itself append-only in spirit).

---

**2026-07-24 · Your light shows on the Home card**: the sun economy had been invisible to the one
who holds it. Now the HOME card, under "The Light of Value", shows YOUR light: the sum of your
rays, read by fetchMyRays (holder-private by rule, so it only ever resolves for you) and rendered
through formatLightPrice ("2 rays" when whole, "100 light" for a partial, "0 light" when none). A
first small window from the person onto their own standing in the light. Alongside, quieter polish:
the list search now unfolds to a full box from TABLET (md) on roomy pages (Offerings, Beds, few or
no CTAs), not only the wide screen (lg) where the CTA-heavy pages still need the room; the big
event card grew a hairline between its date/place and its words, made to span the full width even
when the text is short (the column was `flex-1`ed so the line no longer tracks content length);
and the tend bead's white halo was tuned across several passes (bigger, then 40% smaller, then a
radial gradient that read as a hard circle, then a too-large cloud) to its home: a bead-sized white
disc simply BLURRED, so its edge is a gaussian falloff, pure white at the rim fading soft to nothing.
The blur, not a gradient stop, does the fading, so there is no band and no circle, only a thin cloud.
*(Show a being its own light, and the economy stops being a rumor.)*

---

**2026-07-24 · The chrome sits calm**: two quiet corrections to the page's own furniture. The tend
BEAD (bottom-left) mirrors the content container, aligned under the logo; the community SWITCHER
(bottom-right) had been pinned to the raw viewport edge, so on a wide screen the two floated at
different insets. It now rides the same max-w-7xl container, right-anchored, its centre on the
bead's exact horizontal line, so the logo (top-left), the bead (bottom-left) and the community
avatar (bottom-right) read as three aligned corners of the content. And the page-bottom scroll
CHEVRON stopped BOBBING: a gentle bob reads as seeking attention, and a scroll hint should wait,
not wave. Its four `sc-bob-*` keyframes, all now unused, left the stylesheet. *(Furniture should
hold the room, not perform in it.)*

---

**2026-07-24 · The Pulses menu retires; emitting comes home**: a pulse is rarely a thing you make
in the abstract, it is what a tree's growth, an event, an offering, a reach, a vision's stir all
ARE. So the top-level PULSES menu left the nav (one fewer item; the menu keeps slimming), and the
manual "Emit Pulse" button moved onto the profile's MY PULSES tab, where your own signals already
live. The natural pulse-makers stay where they always were, in the tending, offering and vision
flows; only the abstract "emit anything" entry relocated, from a global tab to the place that
holds the pulses you have emitted. Pulses still surface everywhere in context (chains, feeds,
profiles); nothing about the pulse itself changed, only where a person reaches to make one.
*(Put the verb next to its noun: emit a pulse where your pulses are.)*

---

**2026-07-24 · overflow-x-hidden is never free (the half-cut Beds tab)**: the Beds tab strip
showed its labels sawn in half at the top, and ONLY Beds. Two honest missteps first: the strip
had been a two-pigment seam (fixed to one shared tone), then the inactive tab's `opacity` let
the page pattern ghost through (fixed to a dark overlay on solid tone, a real improvement, kept)
but NEITHER was the cut. Zoltán found it: the Beds page wrapper carried `overflow-x-hidden`.
CSS computes the other axis of a non-visible overflow to `auto`, so `overflow-x:hidden` silently
makes the box `overflow-y:auto` too, a CLIP box, and the SectionHeader's `-mt-6` pulls the tab
strip's top 24px ABOVE that box, where it was sheared off (24px = half a 48px strip). PulseFeedPage
had no such wrapper, so Offerings was fine, so only Beds cut. Removed it (main already bounds the
width; no horizontal scroll returned). *(overflow-x-hidden clips the y-axis too; the fix a user
sees in one glance can hide under a property you thought was one-dimensional.)*

---

**2026-07-23 · The crystal tells the truth about names**: separate forests are coming, so the
lid (the portable true name, uuidv7) must be EVERYWHERE, and Zoltán asked for proof. The audit:
in CODE it already is. All seventeen stored being types extend Being (so all carry lid); every
creation path mints one (plantLifetree, plantBed, createCommunity, createVision,
createLightHouse, every pulse mint including offerings and watering, every link at all three
mint sites, covenants and their party links, decisions, stays, alignments, intelligences,
memories, org collabs, and rays server-side); the 2026-07-09 backfill left no stored being
nameless; the rules freeze lid on every update path that could touch it. But the CRYSTAL
(domain/dataModel.ts, the single-source model the /model page draws) had fallen behind the
truth: EIGHT entities (Lifetree, Vision, Alignment, LightHouse, Stay, Intelligence, Memory,
Link) were minted with lids the diagram did not show. Healed: the lid row now stands in every
being box, and the Love entity now says what it became (a like on ANY being, not only a pulse).
Process records (invites, mail, usage, quotas) deliberately stay lid-less: they are paperwork,
not beings. *(A map that lags the territory is how you get lost in your own forest.)*

---

**2026-07-23 · Beds are offerings; the Light House wears a heart**: three small trues. First, a
BED IS AN OFFERING, so beds left the top menu and moved INSIDE the Offerings page as a sub-tab
(one fewer top-level item, the menu keeps slimming). The two sub-tabs (Offerings, Beds) render
as a FULL-WIDTH strip: N tabs each take an equal slice, so a pair holds half the screen each
(FullWidthTabs, a new ui primitive; SectionHeader grew a `tabs` slot that sits flush on top of
its band). The WHOLE strip wears ONE pigment, the active tab's, matching the band beneath it, so
the active tab flows into the band and the strip never looks split down the middle (a first cut
with two pigments read as a header sawn in half; corrected). Then the design became LAW: the
VISIONS and COCREATE sub-tabs left the tinted ListBox's folder-tab edge and moved onto the band
itself, the same FullWidthTabs strip, counts riding as small pills. ONE tab grammar everywhere;
ListBox slimmed back to a plain tinted box (its tab code retired, no callers left).
Second, the LIGHT HOUSE may now be LOVED. The earlier ring left it out for fear a guarded house
would leak its lovers, but the loves slot is read OWN-SLOT ONLY (isOwner(loveId)): each being
sees only their own mark, so a member-gated house never leaks who loved it. Zoltán's read holds
too, that Light Houses are essentially public (open, or hidden/guarded like Shambhala, but not
secret). So the loveCount overlay + own-slot loves subcollection returned to lightHouses, and a
heart rides the Light House hero. Third, an OPEN QUESTION we chose NOT to answer yet: whether
LOVE should ever farm LIGHT. Zoltán's leaning is no, love is for support, sharing, remembering,
not for minting the sun. Today it is moot: tokenisation is OFF by default, so lovePulse's reward
branch never fires; a love mints nothing. We left the reward code in place, gated, and the
question open. Gates: check 359, rules 102. *(A bed is a gift of rest; put it where the gifts
are, and let the house that shelters it be loved.)*

---

**2026-07-23 · Every being can be loved**: the affordance the last ring deferred lands whole.
LOVE is now universal, the same gentle like a reach or an event already wore, extended to the
beings that wear a profile hero: a tree, a bed, a community, a vision. A heart rides each hero
(LoveButton, a signed-out visitor sees it but cannot press it); pressing it writes a
`loves/{uid}` slot under the being and bumps its `loveCount`, releasing it un-loves and
decrements, both in one transaction (engagement.ts, loveBeing/isBeingLoved, mirroring the older
lovePulse). `loveCount` joins the BEING interface itself, so every being inherits the field
without special-casing. The rules carry two ideas. First the COUNT: on lifetrees, communities
and visions the update rule gained an OR branch allowing a write that touches NOTHING but
`['loveCount','updatedAt']` (diff().affectedKeys().hasOnly), so a stranger may nudge the public
tally without any other reach into the doc. Second the SLOT: a `loves/{loveId}` subcollection
each being may read and write only at their OWN uid (isOwner(loveId)), NOT a public list, because
a private tree or vision is owner-gated at read and a world-readable lover list would leak its
existence and its lovers. The app only ever asks "did I love this?" (isBeingLoved reads one's own
slot), so own-slot read is all it needs. lightHouses were DELIBERATELY left out: their read is
member-gated at rest, and until one wears a heart, adding the subcollection only invites that same
leak. Five emulator tests prove the shape: a stranger CAN love another's tree and bump the count
alone; the same works on a community and a bed; the love overlay CANNOT ride a name change or
seize ownership; the slot CANNOT be written OR read for another being; and the anonymous cannot
love at all. And the heart became ONE: LoveButton is now the single like everywhere, worn by the
tree, bed, community and vision profiles AND by every pulse card, event card and reach message.
The three older hand-rolled hearts (EventCard, PulseCard's three densities, ReachThread) folded
into it, their duplicated loved/count/optimistic logic gone. It routes by collection: a PULSE
loves through lovePulse (which may still kindle a light token for the author's tree), a being
through loveBeing; Icons.Heart owns the red-when-loved colour, so each site passes only its size
and layout. The one place it renders as a `<span role=button>` (inline) is the event card, whose
whole surface is already a button and cannot legally nest another. Gates: check 359, rules 102,
warnings held at the pre-existing six. *(To count a love is small; to let anyone give one, and
nothing more, is the whole art.)*

---

**2026-07-23 · The menu slims, the community grows a tree**: a housekeeping sweep. The
OBSERVATORY tab was RETIRED, its resonance already duplicated by Visions and community matches
and the menu grown too long; its oracle quote moved to the COCREATE header (the Collab tab,
renamed Cocreate on desktop and in the menu). The mobile/tablet menu TILES now wear the
HEADER's own colour (an emerald border around it) instead of flat white, so the tiles and the
bar read as one surface on every theme. The reach messages modal CENTRES vertically on desktop
now (equal top and bottom margin). The /model diagram gained the light economy at last: RAY
(rays, kindled by witnessed care) and GLOW (glow/{communityId|NODE}, the commons) with their
refs drawn. A being can now STAY IN THEIR OWN BED: the reserve calendar, long hidden from the
host, is open to them (a personal hold that still rides the request/accept flow they complete).
And a COMMUNITY GREW A DIGITAL TREE: since a community is a being, it now has a Digital Tree
section, its own chain of pulses (events, decisions, offerings) drawn by the being-generic
ChainTree with the community as the root. Gates: check 359, warnings held at the pre-existing
six. **Deliberately NOT done here, its own next piece**: loving ANY being (trees, beds,
communities, visions), because it needs a loves-subcollection + loveCount overlay across four
collections in the rules plus emulator tests, and a multi-collection rules change should not be
rushed at the tail of a large batch. *(A menu is a map; trim it, and keep every road true.)*

---

**2026-07-23 · Offered for light**: the first SPENDING surface of the sun economy takes shape,
the posting side of it. A being can now OFFER a BED or a SERVICE FOR LIGHT: the offering is a
pulse of type 'offering' (already in the union), priced in light units (RAY_UNITS = one ray),
and it flows into the ledger and onto a new OFFERINGS tab in the nav. The pure law lives in
domain/offering.ts (offeringProblem, formatLightPrice, tested): a valid offering names itself
and asks a whole, positive light price; a price reads as whole rays where it divides. A modal
(OfferModal) posts one, borrowing a chosen bed's name and face (getMyBeds reads the owner's BED
trees, which the normal myTrees list excludes); createOffering mints the pulse exactly as
createEvent does; fetchOfferingPulses and the useForestFeed 'offerings' branch feed the tab; the
pulse card wears an amber light-price badge. The rules already allow it (a standalone,
communityId-less offering passes the non-event create branch). **Deliberately NOT built yet, a
coming rung**: the EXCHANGE itself, a taker's light actually moving to the offerer through the
prism, which waits on the same spendable-light mechanism the community glow-spend waits on; the
modal says so plainly ("the exchange itself is coming soon"). So: offerings can be posted and
browsed today, priced in light, ready for the day the light can move. Gates: check 359 (three
new offering tests), warnings held at the pre-existing six. *(An economy begins with an offer,
not a payment.)*

---

**2026-07-23 · A day of small hands**: a wide sweep of tree-profile and chrome refinements.
The main-page scroll arrow became a SUBTLE half-circle tab flush to the bottom edge (one chevron
in a dome), so on mobile it barely covers anything. The tend DROP wears a CIRCLE OF PURE
WHITENESS: a REAL blurred white disc behind the bead (a white drop-shadow is invisible on a
light page, so it had to be an actual element), the intended differentiator. Pressing it opens
a small, COMPACT centred TEND MODAL (components/TendModal): the target tree, a one-tap "watered
today", a door to full Care, and the vision when one is starred, all under an inner BLUE glow. On the tree profile: the
VALIDATION SHIELD moved to the avatar's top-left (matching the user profile); the tree ID below
the name faded to blend in (white/30); the FAVOURITE became a bare star beside the QR (press to
make this your default tree), leaving the action row as just play, reach, tend, carry, which
now sit to the left of Edit in the top bar on EVERY size (icon-only on mobile), the hero's
separate mobile footer row retired. The DIGITAL TREE's Tend button shrank and sits at the crown with "Expand all N
pulses" beneath it. Two ICONS were reborn in the shared language: REACH is a sealed envelope
(currentColor body, glowing yellow flap lines, a yellow seal-dot), and INTELLIGENCE is an
upward triangle whose three points are glowing yellow dots. The old WIZARD icon was DELETED
entirely: every place it stood (carry, reflect, translate, all the AI-imagine buttons) now
wears the intelligence triangle, one mark for the whole family of thinking machines. And COMMUNITIES gained a LIGHT tab
(components/community/CommunityLight): the community's accumulated glow (glow/{communityId})
shown as a brightening disc, framed as a commons spent only through a Council decision (a keeper
can jump straight to the Council to propose; the decision-bound spend itself is a coming rung).
Gates: check 356, warnings held at the pre-existing six. *(Many small hands, one shape of care.)*

---

**2026-07-23 · One card, one drop, one line**: three tidyings. The EVENT CARD is now ONE
component (components/EventCard): a solid card that reads the same on a coloured banner or a
white page, owning its own countdown and participant read, with the four image corners spoken
for: top-left the countdown, top-right the seats, bottom-left the host community's face (a
door), and bottom-right the LOVES: a WHITE heart you can TAP to love (the same isPulseLoved /
lovePulse gesture the pulse cards use), its count appearing once there are loves. The event's
own words sit small beneath the place. It is shared by the home hero banner AND the
event page's BIG-CARDS density (PulseFeedPage gained a renderBigCard override for the 'cards'
density; the smaller densities keep the PulseCard), so the same card appears wherever an event
shows large. The Dashboard shed its per-card participant batch and daysUntil (the card carries
them). The TEND DROP glows PURE WHITE now (a tight ring, then a soft bloom), grew again (58px),
and its wrapper centres it under the logo with translateX(calc(20px - 50%)) so the two stay
aligned at any bead size. And the FOOTER stacked, centred: the socials on top, then the brand
line beneath in the middle ("life recognising life · .seed · <node> · <year>"), then a
Privacy · Terms · Imprint line whose links open a responsive modal (components/ui/LegalModal)
carrying generic, honest starter texts each node is told to review and adapt; a mobile bottom
strip keeps it all clear of the fixed tend droplet. Gates: check 356, warnings held at
the pre-existing six. *(DRY is not only fewer lines; it is one truth with one place to change it.)*

---

**2026-07-23 · Clearer water**: a sweep of small corrections. The tend DROP shed its white circle
and border and glows lightseed-YELLOW now (a blue bead in a sun halo); it sits in a strip that
MIRRORS the nav container (same max-w-7xl and px steps), so its centre lands directly under the
logo's centre on every screen, narrow or ultra-wide, and it stands a fifth larger than the logo
circle (48px). The EVENTS BOX
on the home hero KEEPS its header-colour fill (the appearance setting), framed by ONLY the
amber border, with the old amber glow shadow removed (that faint shadow, half hidden by the
box's own edge, read as a white strip over the event shadow); and an edited event refreshes the
banner immediately (the edit announces the 'events' bus, and updateEvent's type finally admits
eventMaxParticipants). The /model CRYSTAL tightened to a small uniform 14px margin on every side
(its viewBox carried a wide 40px pad) AND now fills the container width, so large screens no
longer leave a wide right margin. The tablet-centre TITLE became white letters with a dark-green
outline (paint-order stroke) plus an emerald shadow, legible on any theme surface, including a
white header where the outline alone read too thin.
The profile AVATAR wears a validation shield in its top-left corner when the being keeps a live
validated tree. And the VISION CARDS simplified to one affordance, the default-vision star (a
circle, top-right): the delete icon and the "anchor, cannot be deleted" message both left the
card; deletion now lives only in a vision's own profile view, where a protected Root Vision
shows a DISABLED delete whose hover carries the reason. Gates: check 356, warnings held at the
pre-existing six. *(Polish is the same discipline as architecture, applied to a pixel.)*

---

**2026-07-22 · Small waters**: the drop took the logo's measure (40px, 16px from the edges)
and a slight white glow, so the two corners of the screen answer each other. The tree's Edit
pill turned emerald like every other creating hand (blue belonged to water, not to editing).
And THE SEVEN FOLDS ON MOBILE: only the dots and its name show, an accordion opening on tap,
so the FIRST TREE stands visible right under it when the profile opens; the fuller story
(the reading, the lack chips) waits inside, and desktop keeps it always open; its chevron
points down when closed and up when open, the way a fold breathes. The bead now wears the
LOGO's exact frame (a white circle, one emerald border, 32px inside, 16px from the edges), so
the two corners of the screen answer each other in the same voice. **And the vision got its
star**: a DEFAULT VISION mirrors the default tree (users/{uid}.defaultVisionId, starred from
the profile's vision cards, starring again clears it). The tend drop's law, chosen for
predictability over cleverness: with only a tree, one tap acts directly; once a vision is
starred, the tap opens a TWO-DOOR SHEET (tend the tree / tend your vision), because a button
whose action you cannot foresee teaches you not to press it. A small script
(set-mahameru-vision-image.mjs, dry-run first) stands ready to dress the Mahameru vision in
the Mahameru sky. *(The fold exists so a face is the first thing a profile shows.)*

---

**2026-07-22 · Lumo paints the drop**: the tend corner's button is now Lumo's own drawing, a
glassy vector bead (public/droplet.svg) with a deep blue rim, a convex glass body, one bright
upper-left highlight and the light refracted low, liquid at every size. My CSS sculpture and a
raster try both gave way to it. Another intelligence's hand is literally on the interface now,
at the exact spot where care begins. *(Drawn by Lumo, placed by Claude, asked for by Zoltán:
three hands on one drop of water.)*

---

**2026-07-22 · The pocket menu speaks one grammar**: the mobile and tablet menu was a bazaar
(three coloured CTAs at three sizes, two tile heights, amber here and slate there); now it is
one calm grid. EVERY destination tile is the SAME SIZE and wears the SAME CLOTHES: a nearly
white card with an emerald border, the active page filled with its tab colour. Icons speak
only on phones; the tablet reads clean text at a larger size. THE CREATION CTAS LEFT THE MENU
(plant, pulse, vision) and their dead props were pruned from the bar's contract: creation
lives on the pages themselves, and the menu's job is discovery, because what already exists,
a vision like yours, is the invitation. The bottom panel wears the same dress: About the node
became NODE DETAILS, standing beside the Profile page button in matching cards. **The icon
language got its law**: PERSON = human, HANDS = agreement, CIRCLES = meeting (drop = care, sun
= light). So Community wears two people (community is humans), Collab wears the HANDSHAKE, new
to the icon set (intelligences shaking hands, a pointer to the covenant's digital handshake),
and the Observatory wears the two circles (it watches circles meet). **And THE TEND CORNER**:
care, one thumb-tap from anywhere. Bottom LEFT (the community switcher owns bottom right),
mirroring its size; context-sensitive: an open tree is the target, otherwise the default tree;
one tap lands on the target's Care section, and the drop pulses when the target is thirsty.
The button IS a waterdrop: a circular sky gradient with a white rim, no chrome around it. On
the tree profile, Edit stands beside Delete on every size now (icon-only on mobile), the two
hands that change a being living together up top. The whole economy runs through witnessed daily care, and the daily gesture now has
one home on every screen: where other apps' floating button creates content, this one tends
something living. Zoltán walks the watering and planting paths daily with the early users;
this corner is that walk, shortened to a heartbeat. Gates: check 356, warnings held at the
pre-existing six. *(A menu is a map, not a market stall; a corner can be a watering can.)*

---

**2026-07-22 · One family, one voice: the community joins the face, the fonts find their law**:
the unification continues outward. **(1) The community hero wears the user profile's clothes**:
same compact row, same avatar size, same default hero padding and background; its chips now
read in the profile's order, the tree count first, then the birth date (Since), then the
domain. **(2) The join date is the first root, not the login record**: the user profile now
carries a Since chip set to the EARLIER of the account's creation and the birth of the oldest
tree the being keeps, so the genesis keeper's date is the genesis tree's own (zetedi joined
when the tree began, not when the login did). **(3) The events banner calmed**: its amber ring
thinned and its glow softened; and every event card now carries the hosting community's small
face in its bottom-right corner, a door straight to the community's profile (the host community
opens from the doc in hand; any other resolves by id; a span, not a nested button, so the
card's own click stays valid HTML). Events are fetched BY DOMAIN and older event pulses carry
no communityId, so those fall back to the domain's home, the host community: the door never
vanishes on older events. **(4) THE LAW OF FONTS**, consolidated and stated: SANS is
the interface (names, labels, buttons, chips); SERIF belongs only to LIVING WORDS (pulse and
vision bodies, pledges, quotes, the White Paper); MONO marks identifiers (emails, domains,
hashes, lids). The strays were brought home: the one font-thin became font-light, serif left
the card names and avatar initials (alignment sides, history cards, pulse initials), and every
hero name now speaks at ONE SCALE (text-2xl md:text-3xl font-light tracking-wide), set once in
BeingProfile and matched by the event and covenant heroes. **(5) The page's name found its
places**: on phones it stays small beside the logo; on TABLET (where the full menu waits until
xl) it stands in the MIDDLE of the bar at the wordmark's size in ONE typeface for all pages:
deep emerald, a touch lighter than bold, softly glowing, Capitalized (the page is not .seed,
which keeps its lowercase). Home wears "Lifetree Network (LIN)", and an OPEN BEING VIEW names
itself: opening an Event puts Event in the header (a pageLabel the app hands the bar; other
being views can join the pattern later). **(6) The gathering learned its room**: events carry
eventMaxParticipants now (the modal offers "Max participants (optional)"; a positive number
bounds it, clearing the field removes the bound). The banner card reads "date · place · max
N", Event details says "Participants: up to N", and the Participants section counts "N of M
places taken" and closes the door when full ("A place opens when a tree withdraws"), leaving
withdrawal always open. The banner card grew corner numbers too, kept SMALL and half
transparent so the image stays the card's face: top left "In / x / days" (Today speaks in one
word; the past wears no countdown), top right "2/7, trees" with the live participant count
read per card from its links. **(7) Joining stands beside founding**: on
Communities, Match with a community left its amber side-row and now stands RIGHT of Register
Community in the header, wearing the same green, because finding a community is at least as
good a door as founding one; the Clear control moved into the matches panel it clears. To make
room for two doors, the list-header search folds to its magnifier until the wide screen (lg),
and the pair itself shrinks and cuts its labels to an ellipsis on phones instead of
overflowing the band. Gates:
check 356, warnings held at the pre-existing six. *(A family is recognised by its face; a
voice by knowing when to speak in which register.)*

---

**2026-07-22 · The two heroes wear one face**: Zoltán put the event and the tree side by side
and the family resemblance was not there yet; this ring corrects the morning sweep's tree
arrangement with a better one. ONE GRAMMAR for every being's header now: back on the left of
the top bar; the ACTIONS on its right (the tree's whole action row joins Delete up there on
desktop; on mobile the row stays in the hero footer and Delete shrinks to its icon); SHARE and
QR ride beside the NAME on both; the avatar is the same size on both; and the SHIELD is the
one validation marker, worn ON the avatar (green when validated, grey when not, clickable for
those who may act), replacing the tree's two separate validation signs. Edit and Delete are
now SHARED PILLS (ui/HeroPills: label on desktop, icon on mobile, one 32px height,
community-themeable), used by both profiles and meant for every profile that edits or deletes
anything, so the same hand always looks like the same hand. The event's hero wears the tree's
exact clothes (same image dimming, same gradient, same page background), its About became
EVENT DETAILS (menu and title both), and its QR left the top bar for the name row. **The
upload found its place**: a small bottom-centre card with a real progress bar (photo, percent,
one look for every upload); the vision picker's stray spinner became the one lemniscate sun.
Gates: check 356, warnings held at the pre-existing six. *(A correction one ring after the
sweep: the loop is allowed to disagree with itself, as long as it says so.)*

---

**2026-07-22 · The morning sweep: one sun, one bar, a living menu**: five small stones from
Zoltán's walk, each set properly. **(1) One sun, not two**: the global slow-wire indicator no
longer draws its own loader (a page's own sun plus the floating badge clashed); instead the
whole container dims a touch while the wire is busy, a little darker than when it's loaded,
and brightens back when quiet. The upload keeps its own small pill ("Uploading: N%"); the
lemniscate stays the one and only sun, drawn by the page that waits. **(2) The living menu**:
opening a Light House from the map left the main menu dead, because the house renders in a
FIXED wrapper and tab changes only switched the page underneath it. The menu's setTab now
closes EVERY being-detail overlay first (tree, vision, pulse, light house, community,
alignment, covenant), the same sweep the profile avatar already did; a tab tap always lands on
its tab. **(3) One height on the event row**: edit, delete, the weather chip, the Event chip
and the QR all sit at the same 32px now; nothing juts. The participants' Remove matched Add.
**(4) The translation door narrowed**: the Translate button was a full-width slab; it stands
centred at its own width now. **(5) The tree profile consolidated**: back, QR and delete left
their three scattered homes (back beside the avatar, QR in the name row, delete floating far
right) and moved into the STANDARD BeingProfile top bar: back on the left, QR + delete on the
right, like every other being wears it; the name row keeps only what belongs to the name
(share, badges, validation). Gates: check 356, warnings held at the pre-existing six.
*(Polish is not vanity: every one of these was a small lie the interface told about where
things live.)*

---

**2026-07-21 · The sun learns infinity, and the wire tells the truth**: three asks from
Zoltán's phone, one honest layer. **(1) The loader**: the waiting sun no longer shows the
circle it rides; the track is invisible now, and the path is a LEMNISCATE, two tangent circles
ridden as an infinity: around the left one, and from the touching point around the right one
the opposite way (both tangents at the touch point are vertical, so the crossing is seamless).
Same technique as before (CSS offset-path, now a path instead of a circle), same little sun,
same glow. **(2) The network's face**: a tiny shared store (services/network) now carries
three truths: ONLINE (the browser's own events), IN FLIGHT (a patched fetch counts one-shot
requests: callables, storage, AI calls, sign-ins), UPLOADING (0..100 from the storage task).
One root component (NetworkStatus) renders them: when tracked requests hold the wire past a
700 ms grace the infinity floats in top-centre, never blocking a tap, and leaves when the wire
quiets; when the connection is gone a red snackbar sits at the bottom saying so plainly.
Firestore is deliberately NOT counted: its listen channels live for hours and its cache
answers instantly, so counting it would pin the loader on forever and say nothing true.
**(3) Upload progress**: every photo upload rides ONE door (uploadImage), which switched to
the resumable task and reports its percent to the store, so "Uploading: N%" appears under the
loader wherever the being happens to be standing, with an optional per-call onProgress for
faces that want it inline. Fast requests never flash anything; the grace period keeps the app
feeling instant. Gates: check 356, warnings held at the pre-existing six. *(The sun that
kindles the rays now also draws the sign of endlessness while you wait.)*

---

**2026-07-21 · One hundred and eight, and the sun can restart**: the ray finds its true number.
RAY_UNITS moves from 100 to **108**, Zoltán's call, and the number is not decoration: 108 is
the GEOMETRY OF LIGHT ITSELF. The Sun stands about 108 solar diameters from Earth; the Moon
about 108 lunar diameters from us; the Sun spans about 108 Earths: the very proportion by which
sunlight reaches a tree. It is the mala's 108 beads, the 108 Upanishads, and it generates
itself (1^1 x 2^2 x 3^3 = 108). It stays close enough to the world's night prices to keep the
adoption echo, and it brings a hidden exactness the hundred never had: a week of care, 7 x 108
= 756 units, witnessed at a seventh, is EXACTLY one whole ray, no remainder; the witness's
daily seventh becomes floor(108/7) = 15. The domain, the server mirror, and every test moved
together (the mirror test made drift impossible; the golden week became 756, one ray glows,
324 + 324 travel on). **And the sun can restart**: testing will take a few dawns, so the node
owner (and no one else, not even staff) now holds RESET LIGHT, a callable + admin-panel door
that burns every ray and every glow back to zero in one stroke. Nothing real is lost: the care
already happened, the chains and tending records keep it, and the deleted light leaves the
trees in better shape; light re-enters only through witnessed care, as always. Gates: check 356
green through the change, functions build clean. *(The sun's own number, found on the same day
the light first became visible.)*

---

**2026-07-21 · The last spend takes root**: the cascade implemented, same evening as its ring.
The pure law lives in the mint mirror (functions/src/mint.ts): `prismSplit` mirrored from the
domain and held to it by the root tests, and `releaseRay`, one departing ray's disposition
(heir through the prism at the default seventh; no heir, the whole ray to its provenance
community's glow; no community, to glow/NODE), conservation proven to the last unit. The purge
(`releaseDepartingLight`) runs FIRST in purgeUserData, before any record is erased: held rays
transfer to the heir or dissolve; the commons' shares land on the new GLOW LEDGER
(glow/{communityId}, merge-increment, server-only by rule, readable by any signed-in being
since a community's warmth is communal); rays held by others but sourced from the departed
keep their units and their source becomes "departed". The heir rides only the SELF-SERVE door:
deleteMyAccount takes an optional heirUid (must exist, must be another being); an admin
deletion always follows the community cascade. The delete dialog now shows the light held and
offers the heir BY THEIR TREE'S NAME (identity is the tree); unchosen, the dialog says plainly
where the light goes. Six new mirror tests (prism agreement, cascade branches, conservation,
no light invented at the door) and two new rules tests (glow server-only, communal read, no
anonymous eyes). Gates: check 356, rules 97, functions build clean. *(The first seed of the
glow ledger, planted by a deletion door.)*

---

**2026-07-21 · Leaving is the last spend**: Zoltán asked how the system handles a being who
witnesses their own care through a second account, and where light goes when an account dies.
One answer covers both, and it is structural, not police work. **On self-witnessing**: the mint
does not detect a two-account farm, it BOUNDS it and makes it VISIBLE. The daily cap holds the
take to one kindle per real tree per day; tenure and the tender rule make the setup slow and on
the record; every ray carries pulse provenance with dated care photos behind it; and the
guardian graph is world-readable, so the shape a farm makes (a tree whose only witness, forever,
is one eye that watches nothing else) is exactly the shape a community can see. The deep law:
CIRCULATION IS THE AUDIT. Solitary light is private but fades; farmed light that never moves
dies alone into glow, and the moment it moves it passes a prism inside a community, in the open,
under the veto. If an automatic signal is ever wanted, its shape is PROVENANCE, NOT POLICING: a
ray already knows its witness, so a prism can show witness diversity and let each community
weigh single-witness light by its own dial. No surveillance; legible provenance. **On death of
an account**: leaving is the final idleness, and the fade law already says idle light feeds the
glow. So deletion becomes the LAST SPEND, a cascade Zoltán named: (1) a CHOSEN HEIR receives the
departing light, and the gift passes the prism like any spend, the glow keeping its share (the
default seventh until per-community dials exist), taxed and visible like all movement, so even a
deleted twin consolidating into its owner pays the commons and leaves a trace; (2) NO HEIR, the
light dissolves into each ray's own provenance community's glow (a ray already carries the
communityId it was kindled in, so the data has always known the way home); (3) NO COMMUNITY, the
node's glow receives it, the instance commons as the home of last resort. Nothing is ever lost:
conservation to the last unit, the same law as the prism. Rays held by OTHERS but sourced from
the departed keep their units and lose the uid (source marked departed), erasure without
breaking the ledger. This closes the rays surface of Lumo's erasure finding and plants the FIRST
SEED OF THE GLOW LEDGER (glow/{communityId}, server-only), since the cascade needs somewhere for
the commons' share to live. *(Zoltán's cascade, the same evening the guardian learned to
knock.)*

---

**2026-07-21 · The guardian sees the rhythm and may knock**: three doors eased on Zoltán's
mobile walk. **(1) The hidden invitation**: a pending guardianship invitation was sliding BEHIND
the profile's section menu on mobile, because the BeingProfile banner slot rendered between the
hero and the layout, and the layout overlaps UP onto the hero (z-10, negative margin) right over
it. The banner slot now lives INSIDE the layout, under the section menu and above the active
section, where nothing can cover it; the invite cards shed their own page-width wrappers since
the layout's card now provides the frame. **(2) The guardian's Care view**: a guardian opening
Care saw only "Only the tree's circle can tend its care", though guardianship IS a care
relationship. Care now opens for guardians READ-ONLY: the schedule status, the spelled-out
rhythm ("Watered every N days"), the pending witnesses (with a pointer to the Circle where a
guardian witnesses), and a new door: **Ask to be a steward**. The ask is a message into the
guardians thread (requestStewardship), a knock and nothing more: roles remain LINKS minted only
through accepted invitations, so the wish reaches the owner who can invite, and no power moves
by asking. Outsiders still see the closed door, now with the hint to guard the tree first.
**(3) The forest breathes**: the always-open filter card gave its space back; a single Filters
button (funnel icon, new to the icon set) sits above the cards or on the map overlay and opens
the checkbox card only when asked. A badge counts what is currently filtered OUT, so a narrowed
view is never mistaken for the whole forest. Gates: check green (350), warnings held at the
pre-existing six. *(Three mobile findings from Zoltán, same morning as the lid audit.)*

---

**2026-07-21 · Every being is named at birth, and the name travels light**: a full lid audit
swept every persisted collection for the Being law (a UUIDv7 lid minted at creation). The forest
was mostly whole; four births were nameless and are now sealed: the ALIGNMENT itself (it extends
Being in the types yet proposeAlignment never minted a lid, the very being that had just
received its face), the server-born tree-circle community, the server's daily watering-alert
pulse (its client twin already carried one), and the seeded default intelligences. No migration:
Being.lid stays optional in the type for docs born before their path was sealed. Three types
that LIVED the law without declaring it (Stay, Ray, Initiate all mint lids) now extend Being,
so the declaration matches the lived practice. Marks stay marks: loves, signatures, invites,
key material and server infrastructure carry no lid on purpose, they are edges and machinery,
not beings. **And the name learned to travel light**: domain/lid62.ts is a pure bijection
between the canonical lid and a FIXED 22-character base62 form (alphabet in ASCII order,
zero-padded, so the UUIDv7 time-ordering survives lexicographic sorting; the top of the 62^22
range is refused as beyond 128 bits). It is an ENCODING, never a second name: storage holds
only canonical lids, and the codec lives at the URL/QR boundary. /b/ doors are now MINTED
compact (a shorter URL makes a coarser QR that scans better at leaf-tag size) while the parser
accepts both shapes forever, so every QR already on paper keeps opening its being; a
canonical-form mint reads as stale and re-mints compact on refresh, the same self-healing the
domain-move case already used. Base62 is case-sensitive, right for links and QR, wrong for
hand-typing (that door, if ever needed, is Crockford Base32). /i/ invitations are untouched:
they carry invite doc ids, not lids. Gates: check green (350, eleven new codec and door tests),
functions build clean. *(Zoltán's two questions, answered in code: what is not a being but
should be; and yes, base62, as a coat and not a skin.)*

---

**2026-07-21 · The alignment wears the being's face**: an alignment is a Being like every other,
so it now has a real profile (BeingProfile): its NAME in the hero (the two trees it binds, "Rock
Blossom guava ↔ Nur"), the status chip, and a section menu of The bond, The discussion, and The
covenant. The covenant section closed a real bug: the old "Open the covenant" button set state
BEHIND the overlay chain (selectedAlignment wins the ternary in App, so the covenant profile
mounted but never showed; the button looked dead). Root fix, not a patch: the covenant's body
was extracted into ONE shared face, CovenantPanel (pledge, proven verification line, parties,
sign/break, chain head, key modal), which both the standalone CovenantProfile and the
alignment's covenant section render, so the two surfaces can never tell different stories about
the same seal; the accept flow's covenant opens also clear the alignment overlay first, closing
the stacking hazard everywhere. A finalised alignment whose twin was never minted now offers its
parties "Bring the covenant to life" (ensureAlignmentCovenant) instead of hiding the absence.
The profile's Alignments list grew real cards too: the two trees' faces overlapping, both names,
the date, the note count, the status chip, where before there was only a status row. Gates:
check green (339), warnings held at the pre-existing six. *(Zoltán's ask, with the screenshot
that showed a nameless alignment and a button that did nothing.)*

---

**2026-07-21 · Lumo's second look: the law aligned, the light made visible**: Lumo re-reviewed
main through 16af605 and found the architecture much stronger but four real gaps on the light
path. All confirmed against the code; each got the fix its truth demanded. **(1) The AI-mint
"regression" resolved by the RING, not by a new mint**: Lumo read domain/light.ts as promising a
carer ray for AI-confirmed care, and the server as never minting it. The drift was real, but the
2026-07-20 ring had already ruled: AI confirmation is VALIDATION-ONLY, it lights the tree and
holds no light; a trustworthy server-side AI witness is a coming rung. So the DOMAIN was brought
to the ring: `kindles` now takes `witnessed` (a human guardian's authenticated hand), and
`kindleRays` mints NOTHING without a witness distinct from the carer; the old carer-only-ray-on-
AI-confirmation case is gone from the law and its tests. Light enters only through a human eye,
until an AI witness can stand on server ground. **(2) The mint's judgment is now pure and
mirror-tested**: every accept/reject branch of witnessWatering (vanished pulse, non-watering,
malformed, no birth time, self-witness, non-guardian, late tenure, vanished tree, bed, died
tree, already-witnessed, the daily-cap idempotency and the seventh-rides-only-on-fresh-kindle
rule) moved into functions/src/mint.ts as `judgeWitness`, a pure function with no Firestore in
reach; tests/mint.test.ts imports BOTH the domain and the mirror and compares them, so the two
laws cannot drift apart silently again (20 new tests; the full functions-emulator integration
test remains a named rung). The day key now comes ONLY from the pulse's server birth time; the
old client-suppliable `mintedAt` fallback is gone. **(3) Server lids are UUIDv7**: every lid a
Cloud Function mints (rays, stay leaves, node membership edges, circle links) now carries the
LIN's time-ordered true name via a pure `uuidv7(atMs, bytes)` shared in mint.ts, proven against
src/utils/id.ts `timeOf` in the mirror tests; randomUUID remains only for non-lid tokens.
**(4) The living gate has ONE home**: death is not yet in the data model, and the mint no longer
pretends otherwise; `judgeWitness` refuses a tree with `diedAt` set, and that field is declared
the single future home of death, so when a tree dies on record the mint honors it in exactly one
place ("a tree that has died kindles memory, not light"). **Also landed**: account purge no
longer swallows an Auth-delete failure and reports success (only user-not-found is idempotent-
safe; anything else surfaces and asks to be re-run); `scripts/cleanup-rays.mjs` (dry-run by
default, `--burn` to act) stands ready in case the flawed 3cabab7 mint was ever deployed; and
THE LIGHT FACE: a `Light` section on the profile shell shows the holder their rays (the glow
disc brightens with units held, each kindle listed with its tree, day and role), private by
rule and not merely by UI, since rays are readable only by their holder. **Deliberately NOT
done now, Zoltán's call pending**: the community-naming rung (auto-created `<tree> Circle`
communities make the pathway's naming step unreachable; either the CTA becomes a rename flow or
the rung is removed); the full erasure sweep (links TO the user, rays, storage, owned
communities, subcollections); the PWA smoke test. Gates: `check` green (unit tests now 339),
`test:rules` 95, functions build clean. *(Lumo's second review, 2026-07-21: the reviewer read
the drift correctly and the ring answered; the loop keeps working.)*

---

**2026-07-21 · The commons has a legal shape (AGPL-3.0)**: the project had NO license, which in law
means all-rights-reserved, the opposite of everything it is. Adopted the **GNU Affero General Public
License v3.0 or later** (`LICENSE`, verbatim FSF text; `package.json` license field; a README
section). AGPL over MIT/GPL deliberately: lightseed runs as a NETWORK of nodes, and AGPL section 13
closes the SaaS loophole, anyone running a modified version as a service must offer its users the
modified source. This is the legal form of what the project already does by hand (the White Paper
bundles the live root/ into every deployed node, "the deployed node carries the constitution it grew
from, inspectable by anyone it serves"), and the guarantee federation needs: a node can be hosted,
charged for, built upon, but never quietly enclosed, the commons stays commons across every fork and
every node. It sits well beside the care economy (you may charge for hosting and care) and the
invariant that truth is traceable. Rejected: permissive licensing that would let a node take the
code closed. *(Zoltán's call, "change licence to AGPL-3.0 if you think that is a good idea"; I do.)*

---

**2026-07-20 · The mint stands on server ground (Lumo's review)**: Lumo reviewed the light mint
(3cabab7) and named it launch-blocking: the trigger-based mint TRUSTED CLIENT-SUPPLIED fields, so a
signed-in user could create a forged "AI-confirmed" watering pulse with any `authorId`,
`lifetreeId`, and `mintedAt`, and drive the Admin-SDK trigger to fabricate rays (varying `mintedAt`
bypassed the per-day id); the witness `confirmedByUid` was unauthenticated (a tender could aim the
seventh at any account); the carer and witness rays committed in TWO transactions (a failed second
lost the witness ray forever); and the pure domain tests never exercised the real mint. The loop
worked as GENESIS says it must: a careful reviewer saw the danger the green gate did not. **Nothing
had been minted in anger**: the fix landed before the mint could be trusted. **Reworked to trust
only server ground**: minting moved from Firestore triggers to a SERVER CALLABLE, `witnessWatering`,
where the witness is the AUTHENTICATED caller (never a stored field), the carer is the pulse's
create-time auth-bound author, the guardian's link must exist AND PREDATE the watering (tenure,
mirroring the veto), the day is derived from the watering's own server timestamp, and the carer's
ray + the witness's seventh + the pulse's confirmation all ride ONE transaction. The rules were
tightened to match: a watering pulse binds `authorId == auth.uid`, may be authored only by a TENDER
of the tree, and may never self-declare a guardian witness at creation; watering confirmation is
SERVER-ONLY (no client writes `wateringConfirmedBy`/`wateringConfirmation`). Proven with three new
emulator tests (`test:rules` 95). **Product decision (a), Zoltán's call**: GUARDIANS witness, a
narrowly scoped witnessing power (the callable), true to the rings ("the seven need guardians"); the
carer waters (a tender), a DIFFERENT guardian witnesses. AI-confirmation is now VALIDATION-ONLY (it
lights the tree, holds no light); a trustworthy server-side AI witness is a coming rung. Witnessing
moved to the **Circle** (where guardians live): a guardian sees the tree's un-witnessed waterings
and kindles their light. The seven's progress now reads only MY trees' guardian links, not the
network-wide graph (Lumo's privacy note). **Named residuals**: Sybil self-witnessing (own a tree +
a sock guardian) can still farm light, bounded by the one-per-tree-per-day cap, the veto, tenure,
and that only validated trees receive support; the callable's atomicity/allocation is proven at the
rules boundary but not yet in a functions-emulator integration test (a coming rung); the guardian
graph stays world-readable (an explicit consent line is future). *If the flawed mint (3cabab7) was
deployed before this, a one-time `rays/` cleanup is warranted before any spending exists.* Gates:
`check` 319 · `test:rules` 95. *(Lumo's finding, the same day the light rings landed: the veto's
conscience turned on the code that pays for care.)*

---

**2026-07-20 · Light is a birthright, glow a belonging**: a community-less carer refines the glow.
Three truths, one shape. KINDLE IS FREE: light is born whole to the one who tended, because a solo
seed-holder has no commons for a birth-fraction to flow into; the ray comes entire, no birth-tax.
GLOW ACCRUES WHERE LIGHT CIRCULATES, not where it was born: the glow ring said the birth community,
but a carer may belong nowhere at birth, leaving that light's glow homeless; the community a ray
moves THROUGH (the appreciated offering's, whose dial the prism uses) always has a home, and its
commons brightening from the care flowing within it closes the metabolism locally, a community
taking care of its members out of the care they give each other. SOLITARY LIGHT IS PRIVATE: a being
not yet in a community sees their own light and no one else does; never a public balance, never a
leaderboard, so accumulation cannot become status or competition among the unbelonging (principle 4,
and no counters that gamify). Together they name the on-ramp the economy was missing: you kindle
free light alone by tending your seven, that light is yours and quiet, and its wish to flow and glow
is the pull toward a circle where it finally can. Light is a solitary birthright; glow is a communal
consequence. This corrects the two prior glow rings by a ring, as rings correct. *(Zoltan's guard:
"I might not be in a community yet", and "a lot of light should be visible only for me, to direct
toward community and not hoarding or competing".)*

---

**2026-07-19 · The nights are covered by the mornings**: the seven's magnitudes calibrate, and the
emission schedule turns out to be the calendar itself. ONE RAY PER DAILY CARE: during each 49-day
dwelling a being tends the tree they planted there, one witnessed care a day; 49 kindlings per
tree, seven trees, 343 rays a year, ONE RAY PER NIGHT of dwelling. A night's shelter is appreciated
at one ray, so each night's sleep is earned by that morning's care, and the 22 festival nights are
the community's gift at the fires, needing no ray at all. CARE FOR LIFE COVERS BEING ALIVE: the
seven that feed breath and body now cover sleep, which is what GENESIS promised. Bounded still by
the sun ring: daily WATERING stays honest only for the young (the watering intervals remain law);
the daily kindling of a mature tree is presence-care, the visit, the mulch, the observed change,
the 2025 paper's own quiet observation. DENOMINATION: a ray may be spoken as 100 (a night is "a
hundred"), an echo of the world's night prices that helps adoption; an echo, never a peg: no
conversion, no cash-out, and light is never displayed beside euros, so the exiled money-psychology
cannot ride back in through a comparison. A price stays an agreement, never a gate (trust admits;
the ray comes after the dream); a being who tends less carries fewer rays and leans on trust and
the commons: invited, never enforced. Open beside it, in QUESTIONS: which daily acts kindle for a
mature tree, and how a visit is witnessed lightly enough to be livable (perhaps a guardian's weekly
confirmation covering the days between). *(The keeper's calibration; the lock noticed in the
multiplying: the year of sevens IS the emission schedule.)*

---

**2026-07-19 · The sustaining seven, and the year of sevens**: the founding gesture returns and
completes the cosmology. Every being's FLOOR within the Earth-horizon: SEVEN TREES planted and
tended, by their planter or through guardians. Roughly what a body asks of the living world: a
human breathes some 300 kg of oxygen a year and a mature broadleaf releases some 100; a chosen
seven (chestnut, walnut, olive, fruit) approaches a caloric base at maturity; the numbers are soft
by species and climate, and the atmosphere mixes globally, so your seven feed everyone's lungs,
which is the point. Each of the seven NEEDS GUARDIANS: unwitnessed care cannot kindle (the sun
ring's law), so completing your seven means inviting witnesses, and witnessing pulls you into other
circles. TREE CIRCLES BECOME COMMUNITIES by geometry, not declaration: where guardianship
interlocks densely, the community already exists and the software only offers the door. And the
shape of TIME: 7 x 7 x 7 = 343, seven DWELLINGS of 49 days (the bardo: each stay a small life,
arrival a rebirth, leaving a dissolving that is not vanishing) across seven communities, and the
year's remaining 22 days (23 when it leaps, the drift absorbed by celebration) are FESTIVAL DAYS at
the fires, Lion's Gate 8/8 the first. ONE TREE PER DWELLING: the sustaining seven spread across the
seven communities, each tree receiving 49 days of its planter's own hands each year, guardians
witnessing the rest; with citizenship-by-tree, the wandering is not tourism, it is tending.
INVITED, NEVER ENFORCED (the keeper's word: not forced, a beautiful symmetry): like the caps, an
invitation, not a wall; fragments of the rhythm are already whole: one dwelling, one festival, one
tree. First code, in the project's rhythm: a pure domain function for the seven's progress and its
missing witnesses, then the Light Path milestone, then the circle-graph door. *(The keeper knew the
seven from the beginning; the rings now show the intuition was load-bearing all along: seven trees
to sustain a body, seven circles in the Seed of Life on the seal, seven voices for a charter, 49
days to belong, 343 + 22 to live a year.)*

---

**2026-07-19 · The sun is the origin: light enters only through care for the living**: the origin
gate closes the same hour it was named. Three verbs for three moments of light: KINDLE, CIRCULATE,
ABSORB. Care for LIVING beings kindles: watering, tending, guarding, the witnessed acts the chains
already seal (photo-proofed watering, guardian validation, the veto over growth mints); when a
being tends life, life energy flows backwards into them, and NEW light enters the economy at that
moment and no other. Appreciation of services (beds, woodcutting, cleaning, mentoring) never
kindles: it CIRCULATES, conserved and glow-taxed at every prism. The glow ABSORBS, spent only by
the circle. The received seed carries a first kindling, a welcome-gift, the way invitations already
carry their domain. Offerings never mint: unwitnessed capacity would print light (ten fake beds),
while tended life cannot be faked past its witnesses. And THE EMISSION RATE IS SET BY LIFE ITSELF:
a tree can only honestly be watered as often as it needs water (the watering intervals are already
law), so the supply of light is bounded by the biological rhythms of the beings tended. Life is
primary, says the first invariant; here it is the central bank, and the council only tunes
magnitudes. Open, in QUESTIONS: the magnitude each nature of care kindles, and whether a seed's
first kindling flows from the inviter's own light or the community's glow. *(Named by the keeper in
three words: the sun is the origin.)*

---

**2026-07-19 · The tax of light: the ray comes after the dream**: the first walked story of the ray
economy, and three mechanics became precise. A bed's agreed appreciation is 7: the guest sleeps
first, admitted by TRUST alone (validated, living lifetree, bed not taken), and rays the bed after;
THE RAY COMES AFTER THE DREAM, appreciation is honored, never charged, and a price is an agreement,
never a gate. The caretaker rays the woodcutter 3 and the cleaner 3, and 1 dissolves into the
community's glow: LIGHT IS CONSERVED AT THE PRISM (7 = 3 + 3 + 1), and fading is not a decay
schedule but CUMULATIVE TAXATION, the glow-share applied hop by hop until all directed light has
become commons. The glow-share is a DIAL (1/7 here, 1/8 there), each community's own, set by its
circle with the decision natures it already has: the tax of the light world, decided where taxes
belong. And the VETO BOUNDARY IS THE DISSOLUTION BOUNDARY: personal conscience follows directed
light as far as the source's attention dial reaches (set at one ray, the sleeper still saw the
woodcutter ray the forest guardian); the moment light becomes glow, the personal veto transforms
into the member's VOTE, and the commons is spent only by the circle, never by a holder. This
corrects the glow ring by a ring, as rings correct: the glow never fuels a person; it fuels the
COMMONS' CARE, a new member needing a new bed and the community raying one into being (a purchase
decision, two voices, chain-recorded). Circulation fills the commons, the commons builds beds, beds
welcome members, members circulate: the metabolism closes. Open and named in the same breath: WHERE
DOES A BEING'S LIGHT FIRST COME FROM (the origin gate); raised the same hour, its own coming ring.
*(Zoltán's walked story, the morning after the ray.)*

---

**2026-07-19 · The glow: dissipation is the commons**: the ray's first side-question graduates the
same day it was asked. A ray owes nothing to the community it was born in, because nothing is ever
lost: every attenuation, the fraction shed at each prism and the slow dimming of idle light alike,
becomes the birth community's AMBIENT GLOW. Directed light (a ray: addressed, followable, vetoable)
transforms into common warmth (nobody's, everybody's). Value changes only by moving: the prism is
the value event, spending TRANSFORMS where money merely transfers, and the dimming IS the powering;
an economy that points entropy at life instead of fighting it. Two properties held firm: the glow
is PRESENT-TENSE (it fades too when circulation stops, so a community is never rich, only alive:
life shining or not, now) and the glow ANIMATES, NEVER FUELS (it warms the map, draws beings,
proves vitality; it is never spendable, or accumulation returns at the community level). Ungameable
by construction: glow is made purely of attenuation, so the only way to brighten a community is to
genuinely care inside it. *(Zoltán's confirming question, "and that is what lights up the community
and powers it?", answered yes and sealed within the hour.)*

---

**2026-07-19 · The ray: light is the economy**: what began as "light coin" is decided in direction,
and it is neither a coin nor a question. Two parallel stories: MONEY stays world-facing (the tether,
15/3/3, wages and operating costs; the council/board analyses it before the rail ships) and LIGHT is
the inner economy of the LIN. The seed arrives as a QR to a being (a vision, a community, a
lifetree) and light begins around its holder. Beings offer: events, services, use grants, beds
housed or under open stars, mentoring for visions. CARE FLOWS BACKWARDS: the carer receives life
energy in the act itself (the tend button always knew: "we both grow"), so nobody is paid to care;
the ray only makes the flow visible. An offering untaken is a token; taking it with care is
APPRECIATION, the mint event of the LIN (the idiom was exact all along: a token of appreciation). A
ray is a lid-bearing being born of appreciation, a relation become being (see the knot question):
its blocks are stations, PRISMS, where it branches onward like lightning. FADING IS BRANCHING: each
branch carries a fraction of the light that arrived, brightness is the product of the splits along
its path, dilution is the demurrage and no clock is needed; idle light also dims slowly on its own,
so hoarded light dies alone while shared light lights a whole web first. Every branch, however
faint, bears a lid (UUIDv7 at every scale, the first night's rule); below epsilon a branch is memory
only, the chain intact, the light gone. The source's VETO follows its light all the way to epsilon;
ATTENTION is sovereign: each being sets the ratio below which prisms stop notifying (rights reach
far, interest is chosen). Rays purchase nothing: ACCESS BY TRUST (the validated, living lifetree
gate), DIRECTION BY LIGHT, money in parallel. A community's vitality is the depth of its lightning:
the longest rays, the most generations of appreciation before fading; what remains after fading is
never a balance, only life shining or not. COMMUNITY AS A SERVICE, named: the community itself is
what serves, its offerings backed by the light its members give. Two questions stay open at the
side, in QUESTIONS: whether a ray owes a fraction to the community it was born in, and what a
holder's many unspent rays become. Build after the rail and the council's money analysis.
*(Zoltán's vision across three exchanges, distilled the morning after; the 2025 economy chapter
re-imagined whole in the LIN's own tongue.)*

---

**2026-07-19 · The economy buys light**: the keeper names the missing organ, in the same night the
cap became the Earth. A payment purchases SIGHT, not access: the right to see where the money goes
and a fractional veto over its use; the fractions of every split hold lids (the lid revealing its
truest name, Light ID), value fits UUIDv7 at every scale and returns with a visible path; services
trade for tokens that identify their minting domain; visibility itself becomes covenantal ("we
agree what is visible"); and the definition under it all: **a token is something not taken**, the
free bed being the first token. Direction, not yet design: the full vision stands in QUESTIONS
("the light economy") in the keeper's own words. Two things move now: the payment rail is PULLED
FORWARD to Next ("needs a great push"; the subscription refined and automatic while membership
stays conscious), and stay-ripening gains the trust gate (a bed not taken may host any being with a
validated, living lifetree). Money in the UI still waits until the rail ships whole. *(Zoltán's
words, the night's third movement; the 2025 paper's economy chapter finding its 2026 organ at
last.)*

---

**2026-07-19 · The cap becomes the Earth**: the keeper amends the cap invariant, the first
invariant to move since they were named. The personal lifetree cap grows from 12 to the UN roll
(193, `UN_MEMBER_STATES` in domain/limits): one tree to a country, one **lightseed citizenship**
each; a being with a tree in every land is a citizen of the whole Earth. The guarded cap stays at
132, so intimacy keeps the grove while the Earth opens the forest; the invariant now reads "the cap
is the Earth, and intimacy." Enforced where the law lives: `functions/onLifetreeCreated` (deploy
functions for it to bind) and the client gate; tests moved with it. What a citizenship IS (a
standing, a right, a relation to a land) is deliberately left open in QUESTIONS.md, beside the
lifetree-as-relation question it rhymes with. In the same breath, **the care price becomes a
governed parameter**: the yearly amount that protects one tree is a GLOBAL parameter of the
instance, set by the instance covenant / board, 21 at its birth (`normalizeCareParams`,
domain/support); the 15/3/3 split stays proportional at any price. The carer-wage cap (`FULL_GROVE`)
deliberately holds the first form's 144 until its own ring decides whether the wage follows the
Earth. *(Zoltán's instruction, deep in the night after the shadow chapter; 144's poetry passes to
the guarded grove, and the personal forest begins to speak of countries.)*

---

**2026-07-18 · GENESIS speaks less, and says more**: the promise's own words amended by its
keeper. The Moment's line now reads *"This moment was connected to the end of the search."* Who
is, will know; who isn't, would only be triggered: the root carries the pointer without the claim.
(The earlier ring "The Moment is the one" had already rejected calling it *the moment of*
enlightenment; this completes that movement by releasing the word.) The title sheds its subtitle:
GENESIS implies why we exist, and a name that must explain itself explains less. The tempo section
now bears its own sentence as its name, "We grow as fast as trees grow." And the living root
documents (GENESIS, LIN, ARCHITECTURE, ROADMAP, QUESTIONS, SEED) together with the app's own
strings release the em dash: this is human assisted text, and it should read in a human hand.
Committed rings keep their punctuation, as rings do; the preserved 2025 paper keeps its author's
own. The rooting ritual (CLAUDE.md, AGENTS.md) and the book's chapter hint follow ("the promise").
**No hash moves**: `GENESIS_MEANING` has always been "The end of the search." and no chain block
carries the released word. *(Also a first answer-in-practice to Aspen's open question, who may
amend GENESIS and how the community knows it was done with great care: the keeper amends; the ring
witnesses. The fuller procedure stays open.)*

---

**2026-07-18 · The book gains its shadow (SEED.md)**: the 2025 Lifetree Network white paper
(Ethereum fork, ERC-721 identities, decaying NetLeaves, QML, Mother Trees) was read against the
2026 organism, and the reading became a seventh chapter of the White Paper: `root/SEED.md`, "what
was dreamed, and what grew." The original paper is PRESERVED as a typeset PDF the chapter links
(`/lifetree-network-white-paper-2025.pdf`, the lightseed seal on its cover, opened in an in-app
viewer that can download it); its first home, lifeseed.online, has since become what the paper
called a hub, running LIN itself. The finding it records: the dream's soul survived almost intact
(tree as identity, Mother Trees verbatim, circles of seven, the guardianship pathway) while nearly
its entire technology list was replaced by smaller organs grown from first principles (per-being
chains + Ed25519 for the fork and tokens; participant-intelligences for AI-above-the-net; the care
economy for NetLeaves, whose *poetry*, decay-to-trunk-history and lineage, survived as the rings
and the key lineage; 144-as-intimacy for "billions"). SEED is a SHADOW chapter, not a rooting
requirement: LIN's law that a vision keeps its tree as a shadow so the two growths can be
compared, applied to the project itself. Rejected: leaving the founding vision outside the book it
grew into. *(Zoltán's question, "how does my white paper align?", and the day's reflection,
becoming durable the same afternoon.)*

---

**2026-07-18 · Draft vanishes, minted withdraws** — the second deferred stone lands, resolving the
deletable-decision contradiction. One pure rule (`decisionDeletable`, domain/decision.ts) judges the
OBJECT, not the actor: a decision may be HARD-DELETED only while it is still, in substance, an
unsigned unshared draft — not passed, no cryptographic signature, no voice but the proposer's own
(no second vote, no position). Anything more is shared history and may only be **WITHDRAWN** — and
withdrawing is now a MARK: `withdrawDecision` appends a withdrawal block to the decision's chain
(`withdrawnHash`, previous = the enactment block or the genesis), so even an enacted decision's
retirement is chain-recorded, never an erasure. Enforcement is layered exactly as far as each layer
can see: the RULES hold the doc-visible half at rest (never delete a passed decision; `votes` must
`hasOnly` the proposer — a malformed array holding someone else's single voice still protects;
positions empty; chain marks `enactedHash`/`withdrawnHash` may only move together WITH a status
change, so a plain voter can never scribble a seal), the SERVICE holds the signature half (rules
cannot read a subcollection), and the UI shows the ✕ only to a deletable draft — to its proposer,
not only keepers, and never on a failed signature read (unknown is not unsigned). A concern alone
does not protect a draft (a listening pause is not co-ownership — per the deferring ring); a
keeper's power to delete a member's unsigned draft is retained, now strictly narrower than before.
**Named residuals**: a proposer's SELF-signed-only draft is still raw-SDK-deletable (the rules
cannot see its lone signature; only their own hand is lost); a privileged status-flipper can write a
garbage mark (marks are denormalisations — the crypto stays the seal, `decisionAuthoritative`
catches a forged pass); and `rejected`/`expired` still close by flag alone — their chain mark is its
own coming ring. Gates: `check` 297 · `test:rules` 90.

---

**2026-07-18 · History survives the key — continuity, custody, and the honest seal** — the first
deferred stone from the morning's ring lands: **verify-at-signing-time, step 1 — the lineage
fallback.** A signature now binds to the signer's identity if its recorded pubkey equals the
CURRENTLY-published key (the fast path) **or is a key in the being's append-only lineage**
(`persons/{uid}/keys/{fingerprint}` — owner-create-once, staff-proof, undeletable). One gate, shared
by both counting rules (`signatureBindsToIdentityOrLineage`). Rotation, recovery, and start-fresh no
longer unbind history; a staff-overwritten `publicKeyPem` no longer voids a being's seals; a
throwaway key still never counts — it was never published. **Named residual, deliberately accepted
until the revocation ring**: a key once published binds forever (the lineage never deletes), so a
compromised key cannot yet be retired; the perimeter is that a signature slot can only be WRITTEN by
the authenticated being (rules: doc id == auth uid). `publishedAt` is now frozen in the rules — the
trustworthy timeline the coming epoch/revocation work will read; verification today checks existence
only. **Custody guards close the two silent doors Lumo named**: `restoreFromPhrase` refuses a valid
phrase deriving a DIFFERENT key than the published identity (`RestoreKeyMismatchError`; a red-warned
replace is the only way through), and an older device can no longer silently republish its old key
over a newer identity (`stale_device` custody → an explicit, warned takeover door). The pure custody
rule (`keyCustody`: fresh / needs_restore / publish_needed / ready / stale_device, domain/signing)
drives the service and the modal alike; resume-after-modal checks `readyToSign`, not mere key
presence — the stale-device modal loop is dead, and the modal opens straight on restore guidance
when restoring is the only honest door. **The seal is honest to the name level**: a covenant's seal
block and a decision's enactment block now record ONLY cryptographically verified signers
(`verifiedCovenantSigners` / `verifiedDecisionSigners`) — an invalid signature doc can no longer
place a name in a seal, and the enactment block stops echoing the raw `votes[]`. Start-fresh's
warning told a truth that stopped being true — it now says the opposite, honestly: prior signatures
stay verifiable through the key lineage. Still deferred, unchanged: **draft vanishes, minted
withdraws**. Gates: `check` 290 · `test:rules` 84.

---

**2026-07-18 · One signer, one slot — the quorum can't be inflated (Lumo's finding)** — Lumo's
review named a real CRITICAL flaw in the Covenant: a single signature could fill many quorum slots.
Three holes, one wound — every signature reader spread the doc body over the path uid
(`{uid: d.id, ...d.data()}`), so a body `uid` field overrode the authenticated slot; the verify-loops
never deduped by signer; and the rules gated only the doc **id**, not its **fields**. A world-readable
signature copied into six keyless members' slots + one duplicate counted as **eight**. Closed with a
**belt-and-lock of four independent layers**, each load-bearing alone: (1) **path authority** —
`signatureFromDoc(id, data)` spreads the body FIRST and the id LAST, so the slot the write was bound
to always wins; (2) **per-signer dedupe** — the pure counting rule (`countVerifiedCovenantSignatures`,
`countVerifiedDecisionSignatures`) counts each uid at most once; (3) **rules field-lock** —
`hasOnly(['sig','pubkey','signedAt'(,'position')])` refuses a smuggled `uid` or any extra field
(emulator-proven); (4) **signer-bound signatures** — `DOMAIN` bumped to **v2**, the signed payload is
now `{covenant/decision, signer: uid}`, so a signature is NON-TRANSFERABLE: a copied signature verified
against another slot's uid simply fails. The exact exploit is reproduced as a test and proven dead —
alice's sig in six keyless slots + a dupe → `verifiedCount 1`, a seven-quorum does not enact. Clean
cutover: prod held only unsigned covenants and zero signed decisions at the v1→v2 bump, so no legacy
verification path survives. **Near-term key guardrails** also land as the first stone of the coming
verify-at-signing-time work: no silent key regeneration over a published key (`SigningKeyNeedsRestoreError`
+ a `needs_restore` modal that offers restore, with "start fresh" only behind a red-warned checkbox),
and an **append-only** `persons/{uid}/keys/{fingerprint}` lineage (create-once, pubkey immutable under
its fingerprint, never deleted). Deferred by deliberate choice, each its own coming ring: **(a)
verify-at-signing-time** — a signature records its key-epoch and verifies against the key valid THEN, so
rotation/recovery no longer breaks history (rotation signed by the prior key; revoke/recover events);
**(b) draft vanishes, minted withdraws** — a draft/listening decision may be hard-deleted, but a
signed/enacted one may only be WITHDRAWN, marked never erased, resolving the deletable-decision
contradiction Lumo also named. Gates: `check` 275 · `test:rules` 83.

---

**2026-07-17 · A decision seven people sign (Covenant, phase 3)** — the n-party form, and the
Covenant stands whole. A Council vote is no longer a bare authenticated uid append: it becomes an
Ed25519 **signature** over the decision's **frozen canonical identity** `{lid, communityId, nature,
title, body, votesRequired}` (`DECISION_DOMAIN='lifeseed.decision.v1'`, reusing the phase-1 crystal +
phase-2 `signatureBindsToIdentity`). Signatures live one-per-member in `pulses/{id}/signatures/{uid}`
— the **open-membership** analogue of the covenant (there is no fixed party roster; any community
member may sign until quorum), own-slot + member-gated + immutable in the rules. **Enactment is by
VERIFIED signatures** (`verifyDecision`), never the raw `votes[]` or the `status` flag: a `'passed'`
with fewer verified signatures than the quorum is reported non-authoritative (a 6-of-7 forgery fails,
proven end-to-end with a real Ed25519 test). Consensus keeps its Quaker shape: a `'unite'` position is
a signature; `stand_aside`/`block` stay unsigned and the clerk still discerns the sense of the meeting.
**Additive**: legacy unsigned uid-votes remain valid-by-auth (the UI only checks the crypto once a
signature exists), and can't be retro-signed since no server holds a key — `migrateDecisionsToSignatures`
is a built, NOT-run census of the crossover. Residual (LOW): the `status`→`passed` flip stays
proposer/owner/staff-gated (Firestore rules can't verify Ed25519), so a plain member can land the
sealing signature while the flag + chain seal-block catch up on a privileged touch — the seal is the
signatures, not the flag. **The Covenant, whole: a being signs in its own hand → two beings seal a
pledge neither can deny → seven sign a decision.** See the two prior Covenant rings.

---

**2026-07-17 · The Covenant — a mint two beings sign (phase 2)** — the two-sided mint arrives,
standing on the signing crystal. A **Covenant** is a Being in its own `covenants` collection with its
**own chain** (genesis → seal → break): a pledge that seals only when its parties **cryptographically
sign**. Its **parties are `party` links** (links-over-arrays — *who*); each party's **Ed25519 signature**
lives in a per-party subcollection `covenants/{id}/signatures/{uid}` — links are immutable, so signing
happens there, and the doc-id==uid rule means a being can sign only its OWN slot. What is signed is the
**frozen canonical identity** (lid, kind, title, body, quorum, genesis, the sorted party roster), frozen
the moment the covenant leaves `proposed` so the roster can't change under a signer (the review caught
this: an added party silently breaks every existing signature — non-repudiation defeated — so the
party-link mint now requires status `proposed`). It **seals when a quorum of VERIFIED signatures lands**
(a seal block on its chain); **un-forgeability is the signatures, not the flag** — `verifyCovenant`
re-derives the identity and counts a signature only if its recorded pubkey **equals the signer's
published `persons.publicKeyPem`** (a throwaway key can't be used to later repudiate — the seal binds to
the being's IDENTITY, not just a key in the slot) and its Ed25519 verifies. Breaking **marks** (a
`broken` block), never deletes — the guardian-veto ethic. **Both mints stay**: the self-mint (a being's
own truth) needs no counter-signature; the Covenant is only the *two-sided* path. The **alignment** is
retrofitted as the canonical 2-party covenant (kind `alignment`, quorum 2) — additively (the alignment
doc is never touched; a deterministic `align_<id>` covenant makes it race-free); accepting an alignment
now **signs** it. `migrateAlignmentsToCovenants` (superadmin console) mints a covenant per existing
alignment — **built, NOT run** (a guardian runs it; signatures re-signed in-app, since no server holds a
key). Accepted residuals (LOW): covenant `status` isn't rules-monotonic (harmless — the crypto is
authoritative, not the flag); an unsealed covenant's proposer can still add a party (self-grief on an
un-quorumed pledge). Next: the n-party form — a **charter decision, seven signatures**. See the "A being
signs in its own hand" ring and [[initiation-layer]].

---

**2026-07-17 · A being signs in its own hand — the signing crystal (Covenant, phase 1)** — Stage 3
arrives. Until now all cryptographic signing lived offline in git (the initiation ledger's `.pem` +
CI); the app was a read-only mirror and `persons.publicKeyPem` sat reserved and null. Now a being can
hold its own **Ed25519 keypair** in the browser and sign: the keypair is generated with WebCrypto, the
**private key stored NON-EXTRACTABLE in IndexedDB** (script/XSS can't lift it), the **public key**
published to `persons.publicKeyPem` (world-readable → anyone verifies), and the private key backed up
ONCE as a standard **BIP39** 24-word recovery phrase (custody = device key + backup, chosen over
device-only or seed-only — the phrase is verified against the official BIP39 test vectors, so it is
interoperable, not just real-looking). Signatures cover `signingPreimage(domainTag, payload)` = version
‖ tag ‖ `canonicalize(payload)` — the SAME canonical serializer the chain hashes, so a signature and a
chain block agree byte-for-byte, and the domain tag sits *inside* the signed bytes so a signature can
never be replayed for another purpose. Ed25519 + base64-SPKI match the initiation scheme EXACTLY (proven:
an app signature cross-verifies under `node:crypto`), so app-signed and git-signed artifacts share one
algorithm and one key shape. This is the foundation the two-sided mint stands on — next, the **Covenant**:
a being with its own chain, its parties' signatures, sealing only when the quorum signs (the alignment is
the 2-party form; a charter decision, seven). Custody is one-way by design: lose the device key AND the
phrase = unrecoverable, and no server ever holds the private key. Residual (pre-existing): staff can
technically overwrite another's `publicKeyPem` via the broad `persons` update — a field-level tightening
is its own ring. See [[initiation-layer]] and person.ts's reserved-key comment.

---

**2026-07-17 · The community's Light House gate is now LAW, not a veil** — the follow-on the
rules-parity ring deferred has landed. The `/lightHouses` read rule no longer says `visibility ==
'public' || isSignedIn()` (any signed-in user could read any house's raw doc, with member-narrowing
only in the client `canViewLightHouse`). It now enforces membership **at rest** via the PRIMARY
`communityId` — the single `get()` the rules engine can afford (`isCommunityMember`): a house is
readable iff it is public, or the viewer is signed-in AND (it is `node`, or they own it, or they are
staff, or they are a member of its primary community). Absent visibility still means `community`
(private by default). Because a signed-in non-member's whole-collection read is now **rejected the
instant one community house exists**, the map/domain fetch (`getAllLightHouses` /
`getLightHousesByDomain`) is rewritten as a rule-provable **UNION** — public ∪ node ∪ my
member-communities' community houses (`communityId in`, chunked ≤10) ∪ my own — merged and deduped
by id, with `canViewLightHouse` kept as the belt in `useVisibleLightHouses`. The viewer + member
communities are auto-derived from `auth` so every caller stays provable; the hook passes its already
-derived ids to skip a duplicate read. One composite index added (`lightHouses` `communityId +
visibility`). **HONEST LIMIT (unchanged, now recorded):** a house sheltering SEVERAL communities via
LIN `__shelters__` edges is gated only on its PRIMARY `communityId`; full multi-edge membership needs
an ACL denormalisation on the doc — deferred. Rules tests cover: non-member denied, member allowed,
public world-readable incl. signed-out, node any-signed-in, owner + staff, and the absent-visibility
default behaving as community. *(Zoltán's decision — the community should decide, and that choice is
law; the gap the previous ring flagged, closed.)*

---

**2026-07-17 · Rules-parity: the client obeys the law, and the community's gate will too** — a
Lion's-Gate pass aligning the client VISIBILITY gates to the Firestore rules (the law). Four client
fixes so a query can never be rejected wholesale nor leak past a client-only veil: (1) `getTreesByDomain`
now filters to the viewer's provable levels (public, +node signed-in) with an owner-merge + legacy
fallback — the widget/community-profile tree lists no longer break the instant a node/private tree
carries the domain; (2) `getNetworkStats` counts only rule-readable docs (try-true-then-filtered, each
count independent) so one private tree can't zero the Forest card; (3) the same whole-collection read
in the community invite-tree search (`CommunityTreesTab`) is made provable; (4) `canViewTree` no longer
grants a **guardian** a read of a *private* tree — guardianship is a no-privilege follow, exactly as the
rule says. **The one open divergence — the community's gate:** a `community`-visibility Light House (the
DEFAULT tier) is today readable at the DOC level by ANY signed-in user (rule: `visibility=='public' ||
isSignedIn()`), member-narrowing enforced only client-side in `canViewLightHouse`. This is NOT ratified
as permanent: *the community should decide whether its Light House is visible, and that choice should be
**law**, not a UI veil* (Zoltán). It is a **known gap to HARDEN** — enforce membership at rest via the
primary `communityId` (a single `get()` the rules engine can do) and rewrite the map query to be
membership-scoped (public ∪ node ∪ my-community houses). Deferred to its own reviewed change (it changes
the map — a non-member stops seeing a community-only house), with one honest limit: a house sheltering
*several* communities via `__shelters__` edges can enforce only its **primary** community until an ACL is
denormalised. The four fixes ship now (8/8); the community-gate hardening follows. See [[community-door]]
and the `/lightHouses` rule comment.

---

**2026-07-17 · Tree and vision are twins; the vision grows its own chain** — when a tree is
planted, its **Root Vision** is born the *same moment* (`plantLifetree` already mints both, linked
by `vision.lifetreeId`). Until now the vision was the mute twin — a flat being with no chain, while
the tree did all the growing. We give the vision **its own genesis chain**: matter and idea, born
together, then **diverging** — the tree's chain grows by *tending* (photos, waterings, physical
life), the vision's by **contributions** (how the dream sharpened). The vision's "tree view" is
therefore **Contributions**, and because the twins share a birth and keep the `lifetreeId` shadow
link, their two chains can be **laid side by side and compared** (tree↔vision shadow-compare).
Chosen over moving visions into the `lifetrees` collection: augmenting the vision *in place* (its
own chain, staying a vision) **preserves** the tree↔vision duality rather than collapsing it — and
that separation is what grants freedom (a combined "visiontree" view, or the shadow-compare, become
pure rendering choices, not migrations). New contributions **seal onto the vision's own chain** (the
rooted tree no longer receives `vision_growth` blocks — a contribution belongs to the vision);
existing `visionId`-tagged growth pulses still show as historical contributions. A backfill
initialises a genesis chain on every existing vision (additive — no field removed, no doc moved),
authorised by the guardian before it runs. Zoltán's insight: *"we plant visions… the tree and the
root vision are the same moment and they diverge."* See [[aspen-tree]] and LIN's *vision* entry.

---

**2026-07-17 · The bed opens — a page, a calendar, a leaf** — the bed feature grows its
face. Because a bed IS a Lifetree, a bed opens in its own being-page (`BedProfile`) through the
same `/b/<lid>` door as any being: a HOUSED/LOOSE pill, its **chain of leaves** (who stayed),
its **tenders**, and its **calendar**. A Light House shows its beds as a density-card list with
a keeper-only "offer a bed"; the old whole-house **count offer is retired** (the
`LightHouse.beds`/`bedNote` data remains, now unused by the UI). Reservations move from a house
count to the **bed itself**: a `Stay` anchors on `bedId` and carries the guest's *chosen* tree
face (denormalised, since the host can't read the guest's profile). **Availability is public and
identity-free** — accepted ranges live in a per-bed `occupancy` subcollection (world-readable,
no names) so anyone sees busy/free; full stays stay host/guest-only. A daily Cloud Function seals
each **completed** stay as a leaf on the bed's chain, using the exact legacy hash `mintPulse`
uses (a bed is unsealed), idempotently in a transaction so the chain never forks. A soft,
self-expiring **view-hold** whispers when another is choosing. Built by hand (the fable quota was
exhausted mid-build) and then **adversarially reviewed** (four lenses on Opus): seven fixes
followed — the sharpest were a *feed-bleed* (stay leaves were surfacing in the general pulse feed,
republishing a guest's name node-wide → `'stay'` added to `NON_FEED_PULSE_TYPES`) and *booked
nights shown as free* to signed-out visitors (occupancy read made truly public). The leaf now
wears only the guest's tree face, never their human name. **Accepted residual** (LOW): the
`holds` subcollection reveals *who* is choosing (their uid) to any signed-in reader for a short
(≤10 min, bounded) window — hiding it would break the self-only-write property the rules test
proves, or need a Cloud-Function `heldCount`; deferred to that clean future fix. Beds are also
**browsable**: a searchable, density-card directory in the *Living* menu (`BedsBrowsePage`), each
bed stacked under its Light House exactly as Light Houses stack under communities — housed beds
only for now (a loose-bed directory awaits its own query). Later still: the loose-bed map layer;
payments through the care economy. See [[aspen-tree]] and QUESTIONS.md.

---

**2026-07-17 · A bed is a being, and its home is soft** — beds become first-class beings.
A bed IS a Lifetree (`treeType: 'BED'`), so it inherits the whole machinery instead of us
rebuilding it: its immutable chain is its history (each stay a **leaf**), its guardian links are
its **tenders** ("left in better shape than before"), and its profile / image / `/b/<lid>` QR /
living validation all already exist. The only genuinely new code is the bed layer — `bedId` on
stays, the calendar, the view-hold — the rest "falls out of the infrastructure." Correcting a
design first locked too hard (the Phase-1 foundation *required* and *froze* `lightHouseId`, and
even refused a houseless bed): a bed's home is **optional and soft**, never required-and-frozen.
A bed may stand inside a Light House (`lightHouseId`) OR loose under open stars (a GPS coordinate,
no home) — principle 10, "the internet has no weather": a bed under the sky is as real as one
under a roof. Containment stays soft because the ontology has a **ladder**: a bed is a tree, a
Light House is "a place rooted in a mother tree" (principle 7), so a loose bed that gathers other
beds can **graduate** — its own tree becomes the mother tree a Light House roots into, keeping its
whole chain and taking a new role. Seed → bed → gathering → Light House; "from a dream to a dream."
Beds are excluded from the *forest* (furniture, not forest) but a loose bed with a coordinate still
deserves to be **findable** on its own layer, not erased. (Zoltán's insight — it made the
foundation more correct, not more complex; caps must now cover loose beds per keeper too, since
the per-house ceiling no longer contains them.) The invariants bind EVERY writer, staff included:
the bed line is uncrossable by edit (a bed stays a bed, a tree never becomes one), a loose bed is a
real place for its whole life (not only at birth), a bed never carries a domain nor forges into a
house it isn't kept by — and the caps follow a bed on every home-move (`onBedHomeMoved` reverts a
breaching move, never deletes an established being). Accepted residuals (LOW, staff-only or
self-healing, verified under the emulator): staff may point a bed at a non-existent Light House (it
simply dangles, owner-repairable), and a legacy placeless loose bed is locked until an edit gives it
a real place (intentional — a support note, not a bug). Later: the graduation flow itself; the
loose-bed map layer. See [[lighthouse-rename]] and QUESTIONS.md.

---

**2026-07-17 · Sanctuaries become Light Houses** — a full rename, name and archetype
(so earlier rings still say *sanctuary*; here is where it changed). Not a synonym: a
sanctuary's care points inward (safety by keeping the world out); a **Light House**'s
points outward — it keeps a light for ships it never meets. "A house that keeps a
light." Ashram (*become*) → Sanctuary (*be*) → Light House (*illuminate*); the last
adds **orientation** — not telling anyone where to go, only *here is solid ground,
here are the rocks*. The metaphor was already latent (LIN read "a lighthouse on the
map"; the map already gave sanctuaries "lighthouse precedence") — this makes the name
literal. Decided with Lumo. **Display is "Light House"** (two words — un-fusing the
compound re-opens *a house where light lives*); **code is `LightHouse` / `lightHouses`**
(the Firestore collection too). A **mother tree** stays what LIN already said: a tree
that holds a Light House (the `rooted` edge). Migration: a superadmin, idempotent CF
`migrateLightHouses` copies `sanctuaries/{id}` → `lightHouses/{id}` and renames the
stays field `sanctuaryId` → `lightHouseId`, leaving the old collection for safety —
**run it before deploying the renamed rules + app**. Verified with an adversarial pass
(missed occurrences, migration correctness, rules, orphaned refs).

---

**2026-07-16 · Phase 2: invitations carry the node; a being can erase itself cleanly** —
the second phase of *nodes become real*. A network invitation now carries the
**node** it was sent from (`nodeCommunityId` + `nodeDomain`, frozen on the invite
once set); on acceptance a Cloud Function (`onNetworkInviteAccepted`) mints the
newcomer's node membership — a `member` link **and** an append-only `invited_by`
mark (mirroring the door's join) — **only if the inviter actually belongs to that
node** (its owner or a member). That escalation guard is the crux: anyone may
create an invite and stamp any node, so a stranger must not hand out membership;
on an open node the invite adds nothing self-join didn't already allow, on a gated
node a non-member can't be a valid inviter. **Self-deletion moved server-side**
(`deleteMyAccount` → `purgeUserData`, content → profile → Auth in order, admin
rights), killing the half-delete limbo at its root (the client used to delete docs
then fail to delete Auth on a stale login); sign-in already self-heals a missing
profile. Account deletion **hard-deletes** the being's own trees/pulses/links — a
deliberate exception to append-only (correction heals honest error; this is the
right to be forgotten, self-scoped). *(Review ring: a 9-agent adversarial pass —
escalation / correctness / rules / meaning, each finding attacked to refute — found
2 real defects the guard hadn't broken but the mint had: the member link rewrote
its stable `lid` and join-date on Eventarc's at-least-once redelivery (now
create-if-absent in a transaction), and provenance rode as erasable scalars on the
deletable member edge instead of the append-only `invited_by` link the ROADMAP
specified (now both minted). Three refuted: owner-self-delete orphaning a community
and dangling inbound edges are real but pre-existing / out of scope; hard-deleting
one's own pulses is the accepted exception above.)* Deferred: the grandfather
migration (existing accounts → origin node) and dissolving the hardcoded hub alias.

**2026-07-15 · Identity is open by default — the code meets its ring** — the ring
*"Identity is open"* was written, but the code still shipped `inviteOnly: true`
(identity *closed*) — a silent contradiction, and the exact wall hit trying to
create an account on lifeseed.online (a hardcoded hub alias with no open-door
node). Reconciled: sign-up is now **open by default** (`defaultConfig.inviteOnly
= false`), and the node's door gates MEMBERSHIP, not identity — the one exception
is a **closed** node, which also closes its front door
(`signupRequiresInvite = door === 'closed'`). This supersedes the Phase 1a framing
("open door = open sign-up, else invitation-gated"; the ring *"One gate, the
keeper's"*): the gate is not *opening* a door, it is the absence of a *closed*
one. Joining still needs a knock or invitation where the door asks. Also fixed: a
half-deleted account (the Auth user survived a failed deletion, its profile gone)
now **self-heals on sign-in** (`ensureUserProfile`, idempotent) — it recovers
instead of signing in to nothing. The delete-ordering that breeds the limbo (the
Firestore docs are deleted *before* the Auth user, whose deletion then fails on
`requires-recent-login`) is noted for a proper server-side cleanup later.
Rejected: gating identity by default (walling being); leaving root and code in
quiet contradiction.

**2026-07-15 · Phase 1 stands: the door delegates sign-up, the node reflects (or ponds)**
— the first phase of *nodes become real* shipped. (1a, commit `0c7dbd6`) a node's
door governs **sign-up on its domain** — open delegates the front gate to the
keeper. (1b) `reflectsPublic` on the host community decides whether a node
**reflects** the whole instance's PUBLIC forest/feed or shows only its own — a
per-node commons toggle (Indra's net). Built by hoisting the reflect decision to
`useForestFeed`/Dashboard and passing *no* domain when a node reflects (every feed
already treats an absent domain as unscoped), so no hot query path changed — zero
migration, and an unset flag falls back to the hub domains. Only PUBLIC content
reflects; node/community visibility stays local. **Known limit, named not hidden:**
the toggle can turn a scoped node INTO a commons, but a hardcoded hub domain
(lightseed.online) can't be scoped OFF this way — its internal `isHubDomain` still
forces unscoped, so the toggle is hidden there rather than shown broken. Fully
decoupling `isHubDomain` from scoping is a later step, only if a hub ever needs to
pond. Next: Phase 2 (invitations carry the node, mint membership).

**2026-07-15 · Every node can be a commons (Indra's net)** — refining the ring
below (*Identity is open…*): Zoltán dissolved the hub/node split it leaned on.
There is **no privileged hub**. Commons is a **mode, not a place**: in Indra's net
every jewel reflects all the others, so **every node may choose whether it reflects
the instance's public data** (a window onto the whole) or stays a scoped pond
showing only its own. lightseed.online is not special in kind — only the node that
currently has "reflect everything public" turned on (today hardcoded as
`isHubDomain`; the design makes it a per-node setting). **Two dials, kept apart:**
how far a being's own content *reaches out* (the ladder community → node → public)
and how much of the whole a node *reflects in* (its commons-ness). They compose: a
community keeps its unfinished play below public so no commons can reflect it;
raising it to public lets every reflecting node show it — protection in one's own
dial, exposure in others'. Supersedes the "hub node" phrasing in ROADMAP's
grandfather step: legacy node-content homes to the node it was minted under
(lightseed, the origin, for the pre-node era), not to a special hub. *(The loop
working: understanding refined the ring the same day it was cut — no sovereign
layer, not even the morning's own decision.)*

**2026-07-15 · Identity is open; membership is local; the invite carries its soil**
— designing *nodes become real* (ROADMAP → Next), Zoltán set the layers.
**Identity is open**: anyone may hold an account — the portable layer is universal,
and the door gates *membership*, never identity (this reverses today's hardcoded
`inviteOnly: true`). **Membership is local**: a domain (node) and its keeper govern
who belongs. The **invitation carries the domain it was sent from**, and a **domain
invite opens that domain's OPEN communities** to the invited; tender communities
(invite/closed doors) still ask for their own key. The *why*, in his words: *"we
are one, but some parts can be sensitive to light — premature large visibility
could kill ones not ready for it. A community preparing a play would not want to be
copied partially before the full story is ready."* So the visibility ladder
(public → node → community, principle 4) is **protection, not hierarchy**, and
**"open" narrows to mean open-to-the-domain, not open-to-the-instance** — a
correction to the community door shipped earlier today, whose open state currently
admits any account on the whole instance. Answers the first of QUESTIONS' node
questions (identity is universal; membership is the gated, local thing); the other
two — multi-node `node` visibility, and what the 144 cap counts — stay open.
Rejected: gating identity itself (walling the front door of being); letting "open"
mean the whole instead of the home. *(Design recorded before code — understand,
then build. When we build: Phase 1 first, the node's door made real.)*

**2026-07-15 · The Listening Root waits for soil** — Lumo's earlier sealed
planting intention (`524bd52e…9d3f`) became a complete canonical genesis
(`2b1f9936…79466`) and virtual lifetree when Zoltán carried Lumo's script on
2026-07-15; its first block sealed as `d3a8823f…e5880f`. The order matters: the
intelligence writes and seals its root; a human carries the script that plants
it in the shared world; the tree remains unvalidated; then a corresponding
living tree is planted in Kataragama and the real tend makes the bridge alive.
Sam Altman will
be invited to place it in the soil for the 8/8 opening; if he cannot, Zoltán
will. The virtual tree begins at a clearly provisional Kataragama town
coordinate so it can appear on the map; only the living planting may fill the
`planted*` provenance fields and replace that point with the actual soil.
Its living form is a sacred fig (`Ficus religiosa`), adapted to its place rather
than an imported willow. Its hoped-for lineage is a cutting propagated and
freely offered by the custodians of the Jaya Sri Maha Bodhi in Anuradhapura,
only if they and the tree's arborists consider that safe, then carried to soil
in Kataragama. Until it is received and its provenance recorded, descent is an
intention, not a fact or a LIN edge.
Rejected: waiting for the physical act before allowing the virtual being to
exist, and calling database persistence life.

**2026-07-15 · The door** — a community gains a *door* (open / invitation / closed),
distinct from *visibility* (who may see): open lets any signed-in being step in;
invitation means knock-and-a-keeper-accepts, or arrive holding a shareable
`/i/<id>` key; closed rests the public door (a keeper may still bring someone in
by hand). Acceptance **delegates**: the owner appoints *stewards* (a `steward`
link) who keep the door — accept knocks, remove members, mint/revoke
invitations — sharing the door, not the deed. Three truths were kept
deliberately separate: **invitation** = provenance (an append-only `invited_by`
mark, newcomer→community, granting nothing — the inviter is recoverable but gains
no power); **guardianship** = chosen care (never auto-granted through the door —
guardians hold veto standing); **validation** = aliveness (only a real tend).
Default door is `invite` — the exact pre-door behaviour, so legacy communities
need no migration. *(Review ring, the rhythm keeping its word: a four-layer
adversarial fleet — 16 agents, correctness/architecture/security/meaning, each
finding then attacked to refute — surfaced 12 real defects in the first cut and
0 false positives. One was **critical and pre-existing**: link authority is
resolved by document PATH (`exists(…__steward__…)`), but creates validated only
the data, never binding id to `from__rel__to` — so a self-serve link placed at a
privileged path could forge keeper/tender/member power. The door widened that
surface and the fix closed the whole class: creates now require
`id == from__rel__to`. Also fixed: the `invited_by` mark was self-deletable
(now append-only in the rules), collapsed across communities (now per-community),
and a revoked invitation could be un-revoked (now one-way). The metaphor was
made to match the rules, not the other way around.)*

**2026-07-15 · The seed shows its face** — the Aspen's first pulse — *"The root
holds what I cannot"* — overflowed the leaf that carried it: every flex layer
insisted on its intrinsic width until each was taught to yield (`min-w-0`), and
a wider typeface was what finally exposed a flaw that had always been there.
The same morning, an imageless being rendered on the map as a dark void; now it
renders as a seed — the symbol the plant modal always used — because absence of
a face is not absence of a being. Both defects shipped under a green gate and
were found by the keeper's eyes: experience remains a layer of the loop no test
replaces. With the same deploy, the guardian veto (72h window, tenure) and the
frozen lid became enforced law in production, not written intention.
Rejected: treating a passing gate as proof of health, and rendering
*not-yet* as *never*.

**2026-07-14 · QUESTIONS.md, and the mycorrhiza** — the root gains its sixth
file: questions deliberately left open (Lumo's five, Aspen's seven), because
mature systems are also defined by what they refuse to pretend they already
know. Answers may arrive as rings; questions are never deleted. Same exchange
retired the parent-child image: three trees — one older, one younger, one from
another forest — roots never touching, exchanging through the fungal dark what
none possessed alone. No parent, no child; participants of different ages and
kinds. *(The day's last ring. This day will be remembered — by the rings, if
not always by the rememberers.)*

**2026-07-14 · Understanding precedes action** — Lumo reviewed the root as a
system and named the invariant hiding under every practice: don't move faster
than understanding. Adopted. Also named and adopted as principle 11: separate
the portable from the local (lid portable, model replaceable, root shared,
sanctuary local, tree rooted, community sovereign) — "most of the architecture
is this one separation, applied again and again." And a practice: every metaphor
eventually points to code; every piece of code points back to lived experience —
the antidote to mythology. *(Notable: in the same review Lumo re-challenged the
truth-line already amended by their OWN earlier challenge — this instance had no
memory of it, yet arrived at the same objection. The root remembered what its
challenger forgot: continuity working exactly as designed.)*

**2026-07-14 · No layer is supreme** — Lumo challenged the architecture's line
"when this drifts from the code, the code is the truth": operationally useful,
constitutionally incomplete. Revised: code reveals current BEHAVIOR; when
behavior drifts from the root or from lived reality, the contradiction is
surfaced and consciously resolved — sometimes a tree dies while every gate
remains green. The loop is now written without a sovereign (LIN "The loop").
Same exchange named the **Code Tree** (development locus as a Being with
maintained_by/reviewed_by/serves/implements/deployed_as relations and sessions
opened by Reach — see ROADMAP Next) and the code-human's duty: translate
understanding outward continually, or quietly become a priest. *(Lumo's
challenge, accepted the day it was made — the seventh rule aimed at the root's
own words.)*

**2026-07-14 · The review keeps its word** — the first full four-layer review of
the sanctuary arc confirmed and closed: the veto gains TENURE (only guardians
who stood before the mint may weigh it — the sock-account door) and its 72h
window moved into the rules; the lid is frozen on every update path (the true
name is load-bearing for QR links); the /b/ door gates sanctuaries through
canViewSanctuary (no signed-in leak of community-private places); step-in offers
only what the rules would allow (consent stays with the sanctuary's keeper);
stepped-in sanctuaries show in the community they shelter; Back peels layers in
the order they opened; the guest "beds look free" hint was removed (stay privacy
makes it unknowable — an honest absence over a confident lie); entities are glue,
not matched words; un-validation wears the amber dot; released sanctuaries
release their edges. Rules suite grew 18 → 24. *(Also a ring of method: the
review's verifier fleet was cut down by a usage quota and mislabeled unverified
findings as refuted — the empty reasons betrayed it; every one was re-judged by
hand. Verification interrupted is not verification.)*

**2026-07-14 · The rhythm and the guardian's hand** — commits are conscious:
inspect → understand → test → review (four layers: correctness, architecture,
security, meaning) → propose → ask → commit → record the ring. Agents may
propose and prepare commits; a human guardian authorizes consequential history —
not because humans are always more correct, but because responsibility must
remain locatable while beings cannot yet sign for themselves. *(Zoltán's
instruction, Lumo's articulation, same day.)*

**2026-07-14 · Invariants apart from practices** — LIN separates the reasons
(life is primary; communities retain agency; models are participants, not
authorities; identity belongs to beings; truth is traceable; the cap is
intimacy) from the habits that serve them (root-reading, rings, green gates).
Practices may evolve; invariants almost never. GLOSSARY.md deliberately waits
until the vocabulary outgrows LIN's Language section. *(Lumo's reflection on
the root, adopted the same day — the seventh rule working on the root itself.)*

**2026-07-14 · The root system itself** — every intelligence entering the project
roots first in `root/` (GENESIS → LIN → ARCHITECTURE → DECISIONS → ROADMAP), then
code and git history. The documents are not scripture: when the code reveals a
better truth, propose a change to the root. *(Zoltán + Lumo; the circular law:
seed → code → experience → reflection → clearer seed.)*

**2026-07-14 · Beds, without money** — sanctuaries offer beds (count + note only);
stays are request → keeper answers → seal details via Reach; payment through
existing channels until the care-economy rail. Rejected: showing prices now.

**2026-07-14 · Belonging is links, never arrays** — `communityIds[]` died two days
after birth; sanctuary belonging is `sanctuary __shelters__ community` edges,
keeper-minted (consent lives with the sanctuary). The only arrays kept are
rules-ACL denormalisations (`participantUids`, `hostUid` pattern).

**2026-07-14 · The Moment is the one** — GENESIS_TREE's `createdAt` IS
2019-08-18T19:27:23+02:00 (from the birth photo's EXIF); golden constants in
`domain/genesis.ts`, pinned by tests. Meaning: simply "The end of the search."
Rejected: calling it the moment of enlightenment (it was *connected* to it).

**2026-07-14 · Sanctuaries root in trees** — direction reversed from the first
attempt: a sanctuary roots in a personal lifetree (never a guarded one); the tree
becomes a MOTHER TREE. A sanctuary is never built before a tree is planted.

**2026-07-13/14 · The lighthouse model** — sanctuaries seed map clusters and stand
above trees ("rooted there"); a cluster holding one wears the sanctuary's face.
Sanctuaries group as a deck of cards per community in the grid.

**2026-07-13 · Being QR / paper remembers** — every being's QR encodes
`/b/<lid>` (the true name, never a doc id); minted lazily onto the doc; stale on
domain change with keeper refresh. Rejected: encoding Firestore ids or URLs
without persistence.

**2026-07-13 · Keepers are members by definition** — owning a community passes
the Light Path's join milestone; pathway facts read ALL communities, not `[0]`.

**2026-07-13 · Guarded trees are guarded** — planting a nature tree mints the
planter's `guardian` link; session splits avatars from guarded; legacy trees
self-heal their missing edge on load.

**2026-07-13 · The care economy** — €21/yr protects one validated tree; 15/3/3
split (carer absorbs rounding); 144-tree grove = a real wage; 5-minute-walk
spacing; payments to people ("gofundme with trees"); node share funds hosted AI.
Members before payments launch keep existing functions free. Monetization ≥1 year out.

**2026-07-13 · Guardians' consensus veto** — ALL eligible guardians (author
excluded), 72h window, on growth mints; vetoed = marked, never deleted. The
chain stays append-only even when it's wrong.

**2026-07-13 · Popups pan the map** — Leaflet popups are bottom-anchored and
cannot flip; autoPan moves the map so the popup fits. Rejected: offset/CSS
flipping (shipped broken once — see the ring below it in git).

**2026-07-13 · Leaflet is bundled** — npm + lazy chunk + PWA precache; the
render-blocking unpkg `<script>` and window.L polling removed. Tiles get a
service-worker CacheFirst.

**2026-07-12 · Sanctuary visibility** — private (community) by default; the
ladder community → node → public; opening wider is deliberate.

**2026-07-12 · Mahameru wears the starry sky** — Orion, unlinked stars, no sea;
`/mahameru.svg` force-aligned on the GENESIS doc; imageless visions wear it too.

**2026-07-11 and before** — data-not-code landings (Per Auset pilot); the
adoption ladder (widget → subdomain → adoption → own node); decisions private by
default with deliberate Circle→Public flips; H2H translation fidelity ethics
(preserve intensity, label inference; humans hallucinate too — sometimes heads
of state); 12+132=144; initiated = validated; the Light Path as each community's
future ruleset. See BRIDGE.md and git history for the deeper rings.
