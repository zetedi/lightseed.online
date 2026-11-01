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
  IF NOT EXISTS (SELECT 1 FROM seed.schema_migrations WHERE name = '049_being_lookup.sql') THEN
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
COMMIT;
`;
}
