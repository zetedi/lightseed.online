-- THE OLD TIE BECOMES A GROUND: the facts for the plan (ring 2026-11-17, step 4, the dry run).
-- The keeper asks what carrying every `vision.lifetreeId` across to a `grounded_in` link would do
-- on this soil. This function only READS, as the keeper: every vision with its field, every tree
-- with the hands that care for it, every ground already standing. The plan itself is the shared
-- law's (src/domain/groundMigration.ts), asked by seed/api/repairs.mjs — the same plan the
-- origin's scripts/plan-vision-grounds.mjs asks of Firestore. Nothing here writes; the apply is a
-- later migration, made on the guardian's word.
create function seed.repair_vision_grounds_facts() returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
begin
  perform seed.repair_gate();
  return jsonb_build_object(
    'visions',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'authorId',doc->>'authorId','title',doc->>'title',
        'visibility',doc->'visibility','lifetreeId',doc->>'lifetreeId','createdAt',doc->>'createdAt') order by id),'[]'::jsonb) from public.visions),
    'trees',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'anchorUid',t.doc->>'anchorUid','treeType',t.doc->>'treeType',
        'visibility',t.doc->'visibility','died',(t.doc ? 'diedAt' and t.doc->'diedAt'<>'null'::jsonb),
        'carerUids',(select coalesce(jsonb_agg(l.from_id order by l.from_id),'[]'::jsonb) from public.links l where l.to_id=t.id and l.rel in ('keeper','steward'))) order by t.id),'[]'::jsonb)
      from public.lifetrees t),
    'standing',(select coalesce(jsonb_agg(jsonb_build_object('visionId',from_id,'treeId',to_id) order by id),'[]'::jsonb) from public.links where rel='grounded_in'));
end;
$$;
revoke all on function seed.repair_vision_grounds_facts() from public;
