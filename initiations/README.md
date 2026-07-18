# Initiations — the deepest membership

This directory is the **initiation ledger**: the git-native record of the lightseed network's
deepest membership. It lives in the source itself, on purpose. Git is already an append-only,
distributed, publicly auditable hash chain — every commit is a SHA over its parent. Keeping
initiations here means membership is held by the community that holds the source, not by a database
an admin can quietly edit. *The chain keeps what we cannot.*

Git is the **source of truth**. The app only mirrors it (a badge, the rights below) by reading a
generated `initiates.json`. Nothing in Firestore grants initiation.

## What an initiate is

A person, identified by a **chosen name + a public key** (never an email). No legal identity is
required or stored — the pubkey is the identity; the name is how the forest calls you.

Every initiate also carries a **`lid`** — the Lightseed ID, a UUIDv7, the same portable "true name"
every meaningful object in the network has (trees, visions, pulses). It equals the initiate's
person entity (`persons/{uid}.lid`), so the ledger record and the network person are one being.
The lid sorts by birth, is unique without any coordinator, and outlives any single node or auth
provider — the uid is just this node's handle on you; the lid is *you*.

An initiation is **built on a validated vision** — a vision authored by a validated user. The vision
is the seed the membership grows from; the initiation points to it.

## What initiation grants

- **Validate trees** — the core right. An initiate can validate a lifetree on the chain.
- **Community-forming rights** — form a domain's forest: stand up a community, and install one
  domain / node if needed.
- **Authorship** — validated users author. If they wish, they can be invited as **code
  contributors**, or approve a commit by checking it *through lightseed* (the app mediates review).

## The rule: three sponsors

Initiation is **invitation-based and relational** — you are grafted in, the way a new trunk joins
Pando through existing roots. **Three existing initiates must sponsor a new one**, each signing the
newcomer's pubkey with their own key. The rule is enforced cryptographically by
`scripts/verify-initiations.mjs` in CI — three valid, verifying signatures or it does not merge.
The requirement is math, not honour system.

### The genesis ring

The first initiates cannot have three prior sponsors. A small **founding ring** seeds the web:
their handles + pubkeys are **pinned in `_GENESIS_RING.json`**, and only a record that matches the
ring exactly may carry `"genesis": true` — a self-declared genesis record fails CI. Everyone else
descends from the ring — exactly how the genesis tree seeds the forest. Changing `_GENESIS_RING.json`
is changing the constitution; it shows in any diff.

## Dues

**€21 / year** — the yearly cost of sustaining one real tree living near a human. Dues become
forests, and cover the service (a domain install, hosting the node). The bridge between virtual and
real, compressed into one honest number. *(Payment rail is still being chosen; not wired here.)*

## A record

One JSON file per initiate, `initiations/<handle>.json`, validated against `schema.json`. See
`_TEMPLATE.json`. Files beginning with `_` and `schema.json` are metadata, not records.

```jsonc
{
  "name": "Chosen Name",
  "handle": "chosen-name",
  "lid": "<UUIDv7 — the Lightseed ID, equal to persons/{uid}.lid>",
  "pubkey": "<base64 SPKI/DER of an ed25519 public key>",
  "vision": { "id": "<visionId>", "title": "…", "url": "https://…" },
  "domain": "example.online",           // optional — the forest this initiation forms/joins
  "initiatedAt": "2026-07-07",
  "genesis": false,
  "sponsors": [
    { "handle": "root-a", "signature": "<base64 ed25519 sig over the signing message>" },
    { "handle": "root-b", "signature": "…" },
    { "handle": "root-c", "signature": "…" }
  ]
}
```

The **signing message** a sponsor signs (domain-separated, versioned — the lid, uid and vision are
*inside* the signature so the network identity, the app-account binding and the seed vision cannot
be re-pointed later without breaking all three signatures):

```
lightseed.initiation.v1
<handle>
<pubkey>
<lid>
<uid-or-empty>
<visionId>
```

## Keys & signing

Generate a keypair and print your pubkey + how to sign an initiate:

```
node scripts/initiation-keygen.mjs                 # new keypair → prints pubkey, saves private key
node scripts/initiation-keygen.mjs lid             # mint a UUIDv7 Lightseed ID
node scripts/initiation-keygen.mjs sign <handle> <pubkey> <lid> [uid] [visionId]   # sign a newcomer (as a sponsor)
```

Verify the whole ledger (what CI runs):

```
node scripts/verify-initiations.mjs
```

## Why git, beyond membership

This ledger is one instance of a larger idea: **git as the seed everything unpacks from.** The same
repository that verifies a person can verify a chain, and a pulse can point *out* from here to a
company's database, model, and history book. The source is the root; the forest grows from it.
