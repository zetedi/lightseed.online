# The Interbeing Matrix

> I can grow with you without becoming yours.

The **Interbeing Matrix** is the part of the Living Web that lets whole beings name
relationships with other whole beings. The **Intercommunity Matrix** is its narrower
organisational view: community-to-community relationships. This vertical slice begins
there because communities already have identity, keepers, domains, and first-class LIN
links. The name stays wider than the first implementation so the model can later welcome
companies, projects, places, ecosystems, and intelligences without rebuilding its root.

## Why it exists

A central platform normally represents organisations through containment: users belong to
one account, resources sit inside one workspace, and relationships are inferred from shared
ownership. Lightseed needs a different shape. Each community remains a Being with its own
true name, story, circle, face, door, and external address. A relationship connects two
communities; it does not merge them and grants neither side authority over the other.

This is not a reputation system. The Matrix does not rank communities, total their links,
or compress contextual relationships into a universal score. “Recognises” and “shares
resources with” are statements in a particular context, not evidence that can be converted
into one global measure of worth.

## The vertical slice

Three mutual relationship types are live:

| LIN relation | Plain meaning |
|---|---|
| `collaborates_with` | The communities choose to work alongside one another while remaining whole. |
| `recognises` | The communities acknowledge one another as distinct beings. |
| `shares_resources_with` | The communities choose to make resources available across their boundary. |

The vocabulary is intentionally small and mutual. Direction still matters because each edge
records **whose hand spoke**, but reversing the edge does not silently turn the statement into
a different concept.

### Proposal and acknowledgment are attestations

For communities `A` and `B`, a proposal is the ordinary deterministic LIN link:

```text
A__collaborates_with__B
```

Only the founding owner or a `keeper`-link peer of `A` may create or withdraw it. Door
`steward`s are deliberately excluded: they keep admission, not the community's outward voice.
It means: “A attests that this relationship
stands from A's side.” It is also the proposal visible to `B`.

If a keeper of `B` acknowledges it, the UI creates the reverse link:

```text
B__collaborates_with__A
```

No document is updated to say `accepted: true`. Reciprocal recognition is derived only when
both independently authorised links exist. If either community withdraws its own edge, the
state returns to a one-sided proposal. The other community's statement is never edited.

The pure derivation lives in `src/domain/interbeingMatrix.ts`; persistence remains the
existing `Store` / Firestore link adapter; Firestore rules bind each edge to its deterministic
path and to the source community's keeper.

## Invariants

1. **Each community speaks only for itself.** Its founding owner or a `keeper`-link peer may
   create an edge only when their community is `from`; a door `steward` may not. The target's
   owner/keeper circle alone can create the reverse edge. As elsewhere in
   the current cell, staff retain a visible repair escape hatch; this system trusts its stewards
   today rather than pretending it can resist them.
2. **No self-relation.** Both endpoints must be different, existing community documents.
3. **No ownership is created.** Matrix relations are never read by an authorization rule.
   They grant no membership, keepership, visibility, custody, or deletion right.
4. **Reciprocity is derived.** There is no mutable acceptance flag and no privileged record
   that can claim both communities agreed.
5. **Context stays typed.** Reciprocity is derived per pair *and per relation type*. A
   `recognises` edge cannot acknowledge a `collaborates_with` proposal.
6. **No universal score.** The slice stores attestations, not ratings, weights, or reputation.
7. **Withdrawal is local.** A community may withdraw its own attestation. It cannot remove the
   other community's edge. The history of a withdrawn edge is not yet append-only; see below.
8. **Portable identity accounting stays correct.** Inter-community `link.from` values are
   community document ids, not mortal user UIDs, so bundle re-anchoring excludes them from its
   UID census.

## UX flow

Every community profile now has an **Interbeing** section.

1. Anyone who can view the community can read its Matrix relationships.
2. A community keeper chooses another community and one relationship type, then proposes it.
3. The target community sees **Proposal received** on its own profile.
4. A target keeper chooses **Acknowledge**, minting their community's reverse attestation.
5. Both profiles derive **Reciprocally recognised** from the two links.
6. Either keeper may withdraw only their own community's attestation.

The UI deliberately says which state is stored and which is inferred. It does not imply that
silence is rejection, nor that reciprocity creates a parent, owner, federation, or contract.

## Domain and external anchors — self-declared, or DNS-proven

A community's existing canonical `domain` and `domainAliases` are its first external anchors.
The Matrix shows the canonical domain beside each community, labeled **self-declared** until
a control proof is observed.

The proof (since ring 2026-08-28) is a DNS-01-style control challenge (RFC 8555 §8.4) in an
underscored namespace (RFC 8552). A keeper asks the server to mint a single-use, ≥128-bit
random token, bound server-side to the community and its exact normalized domain, and places
it at their DNS host:

```dns
_lightseed-challenge.example.org.  300  IN  TXT  "lightseed-verification=v1:<random-token>"
```

The server then OBSERVES the record (`checkDomainVerification`) and writes the mark
(`domainVerification: { domain, method: 'dns_txt', verifiedAt }`) — the one hand the rules
allow; no client can write the field, so the badge is never a self-claim in a proof's
clothes. The record may be removed once observed; the challenge expires after a week and
is deleted on use — a spent token is residue, the mark alone endures; reverification
simply mints a fresh one. The badge derives: it speaks only
while the community's canonical domain still equals the proven domain, so moving address
silently returns the anchor to self-declared.

The proof stays exactly what it is: **"this community controls this external anchor."**
It is never reputation, never ownership of the community, and the Matrix's reciprocal
relationships remain fully independent of it — losing a domain does not erase a LIN.

## What is guaranteed now

- TypeScript constrains the first relationship vocabulary.
- The domain exports translation keys rather than English; the face speaks the complete English,
  Arabic, and Chinese dictionaries through the existing words contract.
- Pure tests prove proposal, received, reciprocal, and cross-type derivation.
- Firestore rules prove source-keeper authority, real endpoints, distinct communities,
  deterministic ids, server receipt time, a narrow document shape, and own-edge-only
  withdrawal for ordinary clients; the existing broad staff repair power remains.
- The community profile demonstrates propose → receive → acknowledge → reciprocal end to end.
- The subgraph loader can walk these community-to-community edges.
- The node bundle treats their sources as community ids rather than user ids.

## What is not guaranteed yet

- Domain verification is by-hand, not scheduled: control can change after observation and
  the mark stays until someone reverifies. Aliases are not proven — only the canonical domain.
- An attestation is authenticated by the current Firestore session and keeper role, not yet
  signed by the community Council or sealed onto a community chain.
- Withdrawal deletes the current link rather than leaving an append-only superseding mark.
- There is no comment, scope, expiry, evidence URL, or negotiated wording on an edge.
- The slice is one Firebase cell, not cross-node federation.
- There is no notification or inbox outside the target community's Interbeing section.
- There is no per-relationship visibility yet; like the existing LIN, these links are
  world-readable. A proposal should therefore contain no private negotiation or evidence.

These limits are deliberate. A small truthful relationship is better than a large mechanism
that says “federation,” “verification,” or “consensus” before the system can enforce it.

## Future directions

The next useful growth is not a larger vocabulary. It is stronger provenance:

1. Council- or covenant-signed community attestations, reusing the existing signing crystal.
2. Marked withdrawal/supersession so relationship history becomes append-only.
3. Server-observed domain proofs and portable external-anchor records.
4. Optional relationship context as its own Being when a link needs a chain, participants,
   scope, or terms; do not stuff an essay into an edge.
5. Cross-node exchange after node export, restore, and identity re-anchoring are whole.
6. Additional Being kinds only when their authority rule is equally clear: who may speak for
   a project, company, place, ecosystem, or intelligence?

The topology is the teaching: whole beings, freely related, never absorbed.
