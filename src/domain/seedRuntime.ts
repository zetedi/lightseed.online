// The API's database hand is separate from migration custody. Only the graph operations
// whose policies are already tested are granted. This is NOT an end-user identity: the
// eventual API must verify the caller before setting transaction-local seed.uid.
// New roles only: never repair/reuse an existing name whose grants may be unknown.
export function seedRuntimeSql(role: string, verifier: string): string | null {
  if (!/^lightseed_api_[a-f0-9]{16}$/.test(role)
    || !/^SCRAM-SHA-256\$4096:[A-Za-z0-9+/]{22}==\$[A-Za-z0-9+/]{43}=[\:][A-Za-z0-9+/]{43}=$/.test(verifier)) return null;
  return `\\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL search_path = pg_catalog;
DO $ready$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM seed.schema_migrations WHERE name = '061_repairs.sql') THEN
    RAISE EXCEPTION 'Run seed:migrate before provisioning a runtime account.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity) THEN
    RAISE EXCEPTION 'Runtime provisioning requires RLS on every application table.';
  END IF;
END
$ready$;
CREATE ROLE ${role} LOGIN PASSWORD '${verifier}'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
ALTER ROLE ${role} SET search_path = pg_catalog, public;
ALTER ROLE ${role} SET row_security = on;
ALTER ROLE ${role} SET statement_timeout = '15s';
ALTER ROLE ${role} SET idle_in_transaction_session_timeout = '10s';
DO $connect$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO ${role}', current_database());
END
$connect$;
GRANT USAGE ON SCHEMA public, seed TO ${role};
GRANT EXECUTE ON FUNCTION seed.person_lid_candidates(text) TO ${role};
GRANT EXECUTE ON FUNCTION seed.uid() TO ${role};
GRANT SELECT, INSERT, DELETE ON public.links TO ${role};
GRANT SELECT ON public.lifetrees TO ${role};
GRANT EXECUTE ON FUNCTION seed.is_staff(), seed.can_read_tree(text,jsonb), seed.keeps_secret_tree(text) TO ${role};
GRANT SELECT ON public.community_keeper_invites TO ${role};
GRANT EXECUTE ON FUNCTION seed.keeper_offer_command(jsonb,text,text,text,text) TO ${role};
GRANT SELECT ON public.communities TO ${role};
GRANT SELECT ON public.secret_links TO ${role};
GRANT EXECUTE ON FUNCTION seed.can_form_circle(text,jsonb), seed.form_circle(jsonb) TO ${role};
GRANT EXECUTE ON FUNCTION seed.media_write_allowed(text), seed.media_get(text), seed.media_publish(text,jsonb) TO ${role};
GRANT EXECUTE ON FUNCTION seed.people(text,text,text,integer) TO ${role};
GRANT EXECUTE ON FUNCTION seed.tree_invites(text,text,boolean,text,integer), seed.tree_invite_command(jsonb,text,text[]) TO ${role};
GRANT EXECUTE ON FUNCTION seed.is_tree_keeper(text,jsonb), seed.tree_resign(jsonb) TO ${role};
GRANT EXECUTE ON FUNCTION seed.tree_pictures(jsonb) TO ${role};
GRANT EXECUTE ON FUNCTION seed.profile_picture(jsonb) TO ${role};
GRANT EXECUTE ON FUNCTION seed.link_command(jsonb,text) TO ${role};
GRANT EXECUTE ON FUNCTION seed.community_attestation(jsonb,text) TO ${role};
GRANT EXECUTE ON FUNCTION seed.garden_command(jsonb,text) TO ${role};
GRANT EXECUTE ON FUNCTION seed.tree_keeper_request(jsonb,text,text,text[]) TO ${role};
GRANT EXECUTE ON FUNCTION seed.participation_command(jsonb,text) TO ${role};
GRANT EXECUTE ON FUNCTION seed.event_circle_context(text), seed.apply_event_circle(text,jsonb,jsonb) TO ${role};
GRANT EXECUTE ON FUNCTION seed.event_draft_context(jsonb), seed.apply_event_write(jsonb,jsonb,jsonb,text) TO ${role};
GRANT EXECUTE ON FUNCTION seed.event_copy_context(text), seed.apply_event_copy(text,jsonb,jsonb,text) TO ${role};
GRANT SELECT ON public.alignments TO ${role};
GRANT EXECUTE ON FUNCTION seed.can_read_alignment(jsonb), seed.alignment_command(jsonb,text,text) TO ${role};
GRANT SELECT ON public.pulses TO ${role};
GRANT EXECUTE ON FUNCTION seed.can_read_pulse(jsonb) TO ${role};
GRANT EXECUTE ON FUNCTION seed.offering_twin_party(text,jsonb), seed.offering_twin_access(text,jsonb) TO ${role};
GRANT EXECUTE ON FUNCTION seed.offering_lifecycle(jsonb) TO ${role};
GRANT EXECUTE ON FUNCTION seed.offering_birth_context(jsonb), seed.apply_offering_birth(jsonb,jsonb,jsonb,jsonb), seed.offering_recipient(jsonb) TO ${role};
GRANT EXECUTE ON FUNCTION seed.offering_context(text), seed.apply_offering_acceptance(text,jsonb,jsonb,bigint,bigint) TO ${role};
GRANT EXECUTE ON FUNCTION seed.alignment_context(text), seed.apply_alignment_acceptance(text,jsonb,jsonb,bigint,bigint), seed.alignment_twin_party(text,jsonb), seed.alignment_twin_access(text,jsonb) TO ${role};
GRANT EXECUTE ON FUNCTION seed.block_context(text,text,boolean), seed.apply_block(text,text,jsonb,jsonb,bigint) TO ${role};
GRANT EXECUTE ON FUNCTION seed.recovery_witnesses(text,text,text,integer) TO ${role};
GRANT EXECUTE ON FUNCTION seed.prepare_recovery_activation(text), seed.apply_recovery_activation(text,text[]) TO ${role};
GRANT EXECUTE ON FUNCTION seed.prepare_recovery_witness(jsonb), seed.apply_recovery_witness(jsonb) TO ${role};
GRANT EXECUTE ON FUNCTION seed.recovery_context(), seed.apply_recovery_proposal(jsonb), seed.recovery_proposal(text,text) TO ${role};
GRANT EXECUTE ON FUNCTION seed.apply_key_rotation(jsonb) TO ${role};
GRANT EXECUTE ON FUNCTION seed.signing_freeze(jsonb), seed.signing_history(text,text,text,integer) TO ${role};
GRANT EXECUTE ON FUNCTION seed.signing_identity(text), seed.signing_anchor(jsonb) TO ${role};
GRANT EXECUTE ON FUNCTION seed.vision_release(jsonb) TO ${role};
GRANT EXECUTE ON FUNCTION seed.vision_pictures(jsonb) TO ${role};
GRANT EXECUTE ON FUNCTION seed.vision_command(jsonb,text,text) TO ${role};
GRANT SELECT ON public.visions TO ${role};
GRANT EXECUTE ON FUNCTION seed.can_read_vision(jsonb), seed.vision_moment(jsonb) TO ${role};
GRANT EXECUTE ON FUNCTION seed.can_edit_tree(text,jsonb) TO ${role};
GRANT EXECUTE ON FUNCTION seed.tree_command(jsonb,text,text,text,text) TO ${role};
GRANT EXECUTE ON FUNCTION seed.keeper_request_command(jsonb,text,text) TO ${role};
GRANT EXECUTE ON FUNCTION seed.community_role_command(jsonb,text) TO ${role};
GRANT EXECUTE ON FUNCTION seed.resolve_identity(text,text,text,boolean,text) TO ${role};
GRANT EXECUTE ON FUNCTION seed.community_invites(text,text,text,integer), seed.invite_command(jsonb,text,text,text,text) TO ${role};
GRANT EXECUTE ON FUNCTION seed.community_command(jsonb,text,text) TO ${role};
GRANT EXECUTE ON FUNCTION seed.my_profile(), seed.save_profile(text, text) TO ${role};
-- THE DOCUMENT DOOR (ring 2026-11-02): the four entry points, the rules the row policies call, and
-- SELECT on every table whose read law now stands (the law filters each row; DML stays closed).
GRANT EXECUTE ON FUNCTION seed.doc_get(text,text,text), seed.doc_list(text,text,jsonb,jsonb,jsonb,boolean,jsonb,integer), seed.doc_write(jsonb,text), seed.love_toggle(text,text) TO ${role};
GRANT EXECUTE ON FUNCTION seed.rule_users(text,text,text,jsonb,jsonb,text[],timestamptz), seed.rule_push_subscriptions(text,text,text,jsonb,jsonb,text[],timestamptz),
  seed.rule_admins(text,text,text,jsonb,jsonb,text[],timestamptz), seed.rule_config(text,text,text,jsonb,jsonb,text[],timestamptz),
  seed.rule_light_houses(text,text,text,jsonb,jsonb,text[],timestamptz), seed.rule_loves(text,text,text,jsonb,jsonb,text[],timestamptz),
  seed.rule_bed_holds(text,text,text,jsonb,jsonb,text[],timestamptz), seed.rule_stays(text,text,text,jsonb,jsonb,text[],timestamptz),
  seed.rule_rays(text,text,text,jsonb,jsonb,text[],timestamptz), seed.rule_gifts(text,text,text,jsonb,jsonb,text[],timestamptz),
  seed.rule_network_invites(text,text,text,jsonb,jsonb,text[],timestamptz), seed.rule_intelligences(text,text,text,jsonb,jsonb,text[],timestamptz),
  seed.rule_memories(text,text,text,jsonb,jsonb,text[],timestamptz), seed.rule_subscriptions(text,text,text,jsonb,jsonb,text[],timestamptz) TO ${role};
GRANT SELECT ON public.users, public.persons, public.admins, public.config, public.initiates, public.light_houses, public.covenants, public.covenant_signatures,
  public.pulse_signatures, public.pulse_witnesses, public.loves, public.lifetree_occupancy, public.stays, public.supports, public.rays, public.glow, public.gifts,
  public.spends, public.network_invites, public.community_tree_invites, public.invite_requests, public.collabs, public.intelligences, public.personas,
  public.memories, public.subscriptions, public.person_keys, public.person_key_events, seed.bed_holds, seed.push_subscriptions TO ${role};
-- THE ORGANS (ring 2026-11-02): context/apply pairs the API drives; appoint_keeper stays the installation's (seed:keeper, never the API's).
GRANT EXECUTE ON FUNCTION seed.witness_context(text), seed.apply_witness(text,jsonb), seed.appreciation_context(text), seed.apply_appreciation(text,jsonb,jsonb),
  seed.spend_context(text), seed.apply_spend(text,jsonb), seed.reset_light(), seed.unmint_context(text), seed.apply_unmint(text,jsonb,text[]),
  seed.staff_command(jsonb), seed.delete_account(text,text), seed.domain_challenge(text,text,numeric), seed.domain_verified(text,text,numeric),
  seed.door_claim(text,text,text,text,numeric), seed.door_claims(text), seed.door_open(text,text,boolean,text,numeric), seed.door_withdraw(text,text) TO ${role};
-- THE MAIL ORGAN (ring 2026-11-03): what a hand may ask, the courier's server-only doors, the public doors (unsubscribe by token, an invitation request), the login's address.
GRANT EXECUTE ON FUNCTION seed.mail_quota(integer), seed.mail_place(text), seed.mail_enqueue(jsonb), seed.mail_status(text),
  seed.mail_take(integer,integer), seed.mail_settle(text,text,text,numeric), seed.mail_sweep(), seed.outbox_take(integer,integer), seed.outbox_settle(bigint,text,numeric), seed.apply_courier(bigint,jsonb,text[]),
  seed.reach_context(text), seed.knock_context(text), seed.welcome_context(text), seed.push_drop(text,text),
  seed.newsletter_context(text), seed.apply_newsletter(text,jsonb,jsonb,text,boolean), seed.unsubscribe(text,text[]), seed.request_invite(text,text,text),
  seed.record_login_email(text,text), seed.my_email() TO ${role};
-- THE AI ORGAN (ring 2026-11-03): a key kept, removed or taken for one call (ciphertext only), the node-key gate's facts and the day's count.
GRANT EXECUTE ON FUNCTION seed.credential_save(text,text,text,text,text,text,text), seed.credential_remove(text,text,text,text), seed.credential_take(text,text,text),
  seed.ai_gate(), seed.ai_quota(text,integer) TO ${role};
-- THE CLOCK (ring 2026-11-03): the ledger's take and settle, the thirst's facts and touch, the leaves' due list and seal — server-only doors the clock alone drives.
GRANT EXECUTE ON FUNCTION seed.clock_take(timestamptz,integer), seed.clock_settle(text,timestamptz,text,jsonb), seed.thirst_trees(), seed.thirst_apply(text,jsonb,text,jsonb,boolean),
  seed.stay_leaves_due(text), seed.stay_leaf_apply(text,jsonb) TO ${role};
-- THE FACE OF THE NODE (ring 2026-11-03): the face feed's door; the card and the sitemap read as a stranger under the row policies.
GRANT EXECUTE ON FUNCTION seed.face_events(text) TO ${role};
-- THE RELEASE OF A PICTURE (ring 2026-11-03): the facts and the release the API drives for a hand, the hashes' lock a publish
-- takes before checking its files, and the sweep's server-only doors; the holder's standing and the naming check stay the soil's.
GRANT EXECUTE ON FUNCTION seed.media_lock(text[]), seed.picture_context(text,text,text), seed.picture_release(text,text,text),
  seed.media_orphans_due(integer), seed.media_orphan_take(text), seed.media_orphan_settle(text) TO ${role};
-- THE LAST HANDS (ring 2026-11-03): the keeper's audits and repairs; every statement judges the keeper itself (seed.repair_gate).
GRANT EXECUTE ON FUNCTION seed.repair_pulse_visibility(), seed.repair_pulse_type_casing(), seed.repair_tree_visibility(),
  seed.repair_vision_chains_due(), seed.repair_vision_chain(text,text), seed.repair_lids_due(), seed.repair_lid(text,text,text),
  seed.repair_match_ids_due(), seed.repair_alignments_of_tree(text), seed.repair_match_id(text,text), seed.repair_lid_index() TO ${role};
COMMIT;
`;
}
