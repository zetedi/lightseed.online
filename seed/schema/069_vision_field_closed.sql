-- THE OLD TIE IS RETIRED (ring 2026-11-18; the origin's rule of the same day). A vision stands in a
-- tree by a `grounded_in` link the node mints (064), never by a `lifetreeId` field: no hand,
-- staff included, writes the field on a new vision or changes it on an old one. A record that
-- still carries it (a soil that has not yet run the repair `vision_tree_field`, 068) can be
-- edited as long as the field is left as it is; the keeper's repairs remove it. The rest of the
-- rule is 064's, unchanged.
create or replace function seed.rule_visions(action text, doc_id text, parent text, old_doc jsonb, new_doc jsonb, changed text[], moment timestamptz) returns boolean
language plpgsql stable security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); head text[]:=array['latestHash','blockHeight','genesisHash'];
begin
  case action
    when 'get','list' then return coalesce(seed.can_read_vision(old_doc),false);
    when 'create' then return actor is not null and (seed.is_staff() or new_doc->>'authorId'=actor)
      and not (new_doc ? 'lifetreeId')
      and (not (new_doc ? 'latestHash') or (new_doc->>'latestHash'=coalesce(new_doc->>'genesisHash','') and seed.doc_num(new_doc->'blockHeight',0)=0));
    when 'update' then return actor is not null and (old_doc->>'authorId'=actor or seed.is_staff())
      and not seed.changed_any(changed,array['lid','loveCount','lifetreeId'])
      and (seed.is_staff() or not seed.changed_any(changed,array['authorId']))
      and (not seed.changed_any(changed,head) or (not (old_doc ? 'genesisHash')
        and coalesce(new_doc->>'latestHash','')=coalesce(new_doc->>'genesisHash','') and seed.doc_num(new_doc->'blockHeight',0)=0));
    when 'delete' then return actor is not null and (old_doc->>'authorId'=actor or seed.is_staff());
    else return false;
  end case;
end;
$$;
