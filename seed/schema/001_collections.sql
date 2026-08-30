-- THE COLLECTIONS, AS THE TRAVEL PLAN NAMES THEM (src/domain/bundle.ts TRAVEL_PLAN).
-- JSONB-first: each table carries the doc verbatim, so the port begins truthful and hot
-- fields graduate to real columns later (links already did — see 002_links.sql).
-- Excluded collections (providerCredentials, mail, mailThrottle, usage, domainChallenges,
-- lifetrees/*/holds) have NO table by law: secrets, queues and transient tokens stay
-- behind. tests/seedSchema.test.ts keeps this file and the plan mirrored.

-- Identity & custody
create table if not exists users               (id text primary key, doc jsonb not null);
create table if not exists persons             (id text primary key, doc jsonb not null);
create table if not exists person_keys         (person_id text not null, id text not null, doc jsonb not null, primary key (person_id, id));
create table if not exists person_key_events   (person_id text not null, id text not null, doc jsonb not null, primary key (person_id, id));
create table if not exists person_key_recoveries (person_id text not null, id text not null, doc jsonb not null, primary key (person_id, id));
create table if not exists person_key_recovery_witnesses (person_id text not null, recovery_id text not null, id text not null, doc jsonb not null, primary key (person_id, recovery_id, id));
create table if not exists admins              (id text primary key, doc jsonb not null);
create table if not exists config              (id text primary key, doc jsonb not null);
-- Witness-mode collections: on a LIVE seed these exist, but they are REBUILT (beings from
-- the six kind collections; initiates from the git ledger), never imported as truth.
create table if not exists beings              (id text primary key, doc jsonb not null);
create table if not exists initiates           (id text primary key, doc jsonb not null);

-- The living beings and their chains
create table if not exists lifetrees           (id text primary key, doc jsonb not null);
create table if not exists lifetree_occupancy  (lifetree_id text not null, id text not null, doc jsonb not null, primary key (lifetree_id, id));
create table if not exists visions             (id text primary key, doc jsonb not null);
create table if not exists pulses              (id text primary key, doc jsonb not null);
create table if not exists pulse_signatures    (pulse_id text not null, id text not null, doc jsonb not null, primary key (pulse_id, id));
create table if not exists pulse_witnesses     (pulse_id text not null, id text not null, doc jsonb not null, primary key (pulse_id, id));
create table if not exists covenants           (id text primary key, doc jsonb not null);
create table if not exists covenant_signatures (covenant_id text not null, id text not null, doc jsonb not null, primary key (covenant_id, id));
create table if not exists communities         (id text primary key, doc jsonb not null);
create table if not exists light_houses        (id text primary key, doc jsonb not null);

-- Loves: five identical Firestore subcollections become ONE table — the parent kind is a
-- column, the own-slot law (one love per uid per being) is the primary key itself.
create table if not exists loves (
  parent_kind text not null check (parent_kind in ('lifetrees', 'visions', 'pulses', 'communities', 'lightHouses')),
  parent_id   text not null,
  uid         text not null,
  doc         jsonb not null,
  primary key (parent_kind, parent_id, uid)
);

-- The graph (links live in 002_links.sql — real columns, the id law as schema)
create table if not exists alignments          (id text primary key, doc jsonb not null);

-- Light & the care economy
create table if not exists rays                (id text primary key, doc jsonb not null);
create table if not exists glow                (id text primary key, doc jsonb not null);
create table if not exists stays               (id text primary key, doc jsonb not null);
create table if not exists supports            (id text primary key, doc jsonb not null);

-- Doors & invitations (auto-ids that ARE unguessable keys — preserved verbatim)
create table if not exists network_invites         (id text primary key, doc jsonb not null);
create table if not exists community_invites       (id text primary key, doc jsonb not null);
create table if not exists community_tree_invites  (id text primary key, doc jsonb not null);
create table if not exists community_keeper_invites (id text primary key, doc jsonb not null);
create table if not exists tree_ownership_invites  (id text primary key, doc jsonb not null);
create table if not exists invite_requests         (id text primary key, doc jsonb not null);

-- Node fabric
create table if not exists collabs             (id text primary key, doc jsonb not null);
create table if not exists intelligences       (id text primary key, doc jsonb not null);
create table if not exists personas            (id text primary key, doc jsonb not null);
create table if not exists memories            (id text primary key, doc jsonb not null);
create table if not exists subscriptions       (id text primary key, doc jsonb not null);
