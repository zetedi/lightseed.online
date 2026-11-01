-- THE DOCUMENT LAW (ring 2026-11-02): firestore.rules, collection by collection, as one rule
-- function each. Every rule answers the same question — may THIS hand do THIS action to THIS
-- document — for actions get, list, create, update, delete; `old_doc` is the stored document
-- (null at creation), `new_doc` the document as it would stand (null at deletion), `changed`
-- the top-level keys an update touches (the rules' affectedKeys), `moment` the server's clock
-- (request.time). The row-level policies below call the rules' `list`; seed.doc_get asks `get`;
-- seed.doc_write asks create / update / delete. Love is its own atomic gesture (seed.love_toggle),
-- so every love branch here is the slot's read alone. The alignment, link, invitation and
-- chain writes keep their own commands (006–049); the rules here refuse what those own.

-- ── Identity & custody ────────────────────────────────────────────────────────────────────
create function seed.rule_users(action text, doc_id text, parent text, old_doc jsonb, new_doc jsonb, changed text[], moment timestamptz) returns boolean
language plpgsql stable security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid();
begin
  if actor is null then return false; end if;
  case action
    when 'get','list','create','delete' then return doc_id=actor or seed.is_staff();
    when 'update' then return seed.is_staff() or (doc_id=actor
      and (not (new_doc ? 'invitesRemaining') or jsonb_typeof(new_doc->'invitesRemaining')='number')
      and (seed.doc_num(new_doc->'invitesRemaining',0)<=seed.doc_num(old_doc->'invitesRemaining',0) or seed.doc_num(new_doc->'invitesRemaining',0)<=144));
    else return false;
  end case;
end;
$$;
create policy users_own_read on public.users for select using(seed.rule_users('list',id,null,doc,null,null,now()));

create function seed.rule_push_subscriptions(action text, doc_id text, parent text, old_doc jsonb, new_doc jsonb, changed text[], moment timestamptz) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select seed.uid() is not null and (parent=seed.uid() or seed.is_staff());
$$;
create policy push_subscriptions_own on seed.push_subscriptions for select using(seed.rule_push_subscriptions('list',id,uid,doc,null,null,now()));

create function seed.rule_persons(action text, doc_id text, parent text, old_doc jsonb, new_doc jsonb, changed text[], moment timestamptz) returns boolean
language plpgsql stable security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid();
  signing text[]:=array['publicKeyPem','signingKeyFingerprint','signingEpochId','signingState','signingAnchoredAt','signingFrozenAt','signingFreezeEventId'];
begin
  case action
    when 'get','list' then return true;
    when 'create' then return actor is not null and actor=doc_id and seed.doc_text(new_doc->'uid',doc_id)=doc_id
      and (not (new_doc ? 'lid') or seed.doc_is_lid(new_doc->>'lid'))
      and (not (new_doc ? 'publicKeyPem') or new_doc->'publicKeyPem'='null'::jsonb)
      and not (new_doc ?| signing[2:7]);
    when 'update' then return actor is not null and (actor=doc_id or seed.is_staff())
      and not seed.changed_any(changed,signing)
      and seed.doc_text(new_doc->'uid',doc_id)=doc_id
      and case when old_doc ? 'lid' then new_doc->'lid' is not distinct from old_doc->'lid'
        else (not (new_doc ? 'lid') or seed.doc_is_lid(new_doc->>'lid')) end;
    else return false;
  end case;
end;
$$;
create policy persons_world_read on public.persons for select using(true);

create function seed.rule_admins(action text, doc_id text, parent text, old_doc jsonb, new_doc jsonb, changed text[], moment timestamptz) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select action in ('get','list') and seed.uid() is not null;
$$;
create policy admins_signed_read on public.admins for select using(seed.rule_admins('list',id,null,doc,null,null,now()));

create function seed.rule_config(action text, doc_id text, parent text, old_doc jsonb, new_doc jsonb, changed text[], moment timestamptz) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select case when action in ('get','list') then doc_id in ('superadmin','limits','dataAuthority') or seed.is_staff()
    else (doc_id='limits' and seed.is_staff()) or (doc_id='staffHands' and seed.is_superadmin()) end;
$$;
create policy config_read on public.config for select using(seed.rule_config('list',id,null,doc,null,null,now()));

create function seed.rule_initiates(action text, doc_id text, parent text, old_doc jsonb, new_doc jsonb, changed text[], moment timestamptz) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select action in ('get','list') or seed.is_staff();
$$;
create policy initiates_world_read on public.initiates for select using(true);

-- Append-only key history: world-readable lineage, written only by the signing commands.
create function seed.rule_person_keys(action text, doc_id text, parent text, old_doc jsonb, new_doc jsonb, changed text[], moment timestamptz) returns boolean
language sql immutable set search_path=pg_catalog as $$ select action in ('get','list'); $$;
create policy person_keys_world_read on public.person_keys for select using(true);
create policy person_key_events_world_read on public.person_key_events for select using(true);

-- ── The living beings ─────────────────────────────────────────────────────────────────────
create function seed.rule_lifetrees(action text, doc_id text, parent text, old_doc jsonb, new_doc jsonb, changed text[], moment timestamptz) returns boolean
language plpgsql stable security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); staff boolean; head text[]:=array['latestHash','blockHeight','genesisHash'];
  house text; old_house text; bed boolean; carer boolean;
begin
  case action
    when 'get','list' then return coalesce(seed.can_read_tree(doc_id,old_doc),false);
    when 'create' then
      if actor is null or not seed.born_with_anchor(new_doc) then return false; end if;
      staff:=seed.is_staff();
      -- A secret tree is born private, houseless, in no community.
      if coalesce(new_doc->>'treeType','')='SECRET' and not (new_doc->>'visibility'='private' and coalesce(new_doc->>'lightHouseId','')='' and not (new_doc ? 'communityId')) then return false; end if;
      -- Born at its root, unvalidated (staff alone plant a standing tree).
      if new_doc ? 'latestHash' and not (new_doc->>'latestHash'=coalesce(new_doc->>'genesisHash','') and seed.doc_num(new_doc->'blockHeight',0)=0) then return false; end if;
      if not staff and not (seed.doc_bool(new_doc->'validated',false)=false and (not (new_doc ? 'validatorId') or new_doc->'validatorId'='null'::jsonb)) then return false; end if;
      if coalesce(new_doc->>'treeType','')<>'BED' then return true; end if;
      -- A BED: domainless, housed or at a real place, by its house's keeper or its own; bounded per house / per keeper.
      house:=coalesce(new_doc->>'lightHouseId','');
      if coalesce(new_doc->>'domain','')<>'' or not (house<>'' or seed.real_place(new_doc)) then return false; end if;
      if not (seed.staff_hand('tree_edit') or (new_doc->>'anchorUid'=actor and (house='' or exists(select 1 from public.light_houses h where h.id=house and h.doc->>'anchorUid'=actor)))) then return false; end if;
      if staff then return true; end if;
      if house='' then return (select count(*) from public.lifetrees where doc->>'treeType'='BED' and doc->>'anchorUid'=actor and coalesce(doc->>'lightHouseId','')='')<32;
      else return (select count(*) from public.lifetrees where doc->>'treeType'='BED' and doc->>'lightHouseId'=house)<64; end if;
    when 'update' then
      if actor is null then return false; end if;
      bed:=coalesce(old_doc->>'treeType','')='BED';
      if (coalesce(new_doc->>'treeType','')='BED')<>bed then return false; end if;
      -- Secret stays secret: never another kind, private forever, never validated.
      if (coalesce(new_doc->>'treeType','')='SECRET')<>(coalesce(old_doc->>'treeType','')='SECRET') then return false; end if;
      if coalesce(old_doc->>'treeType','')='SECRET' and not (new_doc->>'visibility'='private' and seed.doc_bool(new_doc->'validated',false)=false) then return false; end if;
      house:=coalesce(new_doc->>'lightHouseId',''); old_house:=coalesce(old_doc->>'lightHouseId','');
      if bed and house='' and not seed.real_place(new_doc) then return false; end if;
      -- A bed's home-move re-consults the destination's ceiling (functions/onBedHomeMoved), refused rather than reverted.
      if bed and house<>old_house and not seed.is_staff() then
        if house='' then if (select count(*) from public.lifetrees where doc->>'treeType'='BED' and doc->>'anchorUid'=old_doc->>'anchorUid' and coalesce(doc->>'lightHouseId','')='' and id<>doc_id)>=32 then return false; end if;
        elsif (select count(*) from public.lifetrees where doc->>'treeType'='BED' and doc->>'lightHouseId'=house and id<>doc_id)>=64 then return false; end if;
      end if;
      staff:=seed.is_staff(); carer:=seed.is_tree_carer(doc_id);
      return (
        (carer or staff)
        and not seed.changed_any(changed,array['validated','validatorId','anchorUid','lid','loveCount'])
        and not seed.changed_any(changed,head)
        and (not bed or not seed.changed_any(changed,array['domain']))
        and (not seed.changed_any(changed,array['lightHouseId']) or house='' or exists(select 1 from public.light_houses h where h.id=house and h.doc->>'anchorUid'=actor))
      ) or (
        seed.changed_only(changed,array['validated','validatorId','updatedAt']) and seed.doc_bool(new_doc->'validated',false)
        and seed.is_kept_validated_tree(new_doc->>'validatorId')
      ) or (
        seed.changed_only(changed,array['validated','validatorId','updatedAt']) and seed.doc_bool(new_doc->'validated',false)
        and new_doc->>'validatorId'=actor and exists(select 1 from public.initiates where doc_id=actor)
      ) or (
        seed.staff_hand('tree_edit') and (not bed or not seed.changed_any(changed,array['domain'])) and not seed.changed_any(changed,head)
      );
    when 'delete' then return actor is not null and (seed.is_tree_keeper(doc_id,old_doc) or seed.is_staff());
    else return false;
  end case;
end;
$$;

create function seed.rule_visions(action text, doc_id text, parent text, old_doc jsonb, new_doc jsonb, changed text[], moment timestamptz) returns boolean
language plpgsql stable security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); head text[]:=array['latestHash','blockHeight','genesisHash'];
begin
  case action
    when 'get','list' then return coalesce(seed.can_read_vision(old_doc),false);
    when 'create' then return actor is not null and (seed.is_staff() or new_doc->>'authorId'=actor)
      and (not (new_doc ? 'latestHash') or (new_doc->>'latestHash'=coalesce(new_doc->>'genesisHash','') and seed.doc_num(new_doc->'blockHeight',0)=0));
    when 'update' then return actor is not null and (old_doc->>'authorId'=actor or seed.is_staff())
      and not seed.changed_any(changed,array['lid','loveCount'])
      and (not seed.changed_any(changed,head) or (not (old_doc ? 'genesisHash')
        and coalesce(new_doc->>'latestHash','')=coalesce(new_doc->>'genesisHash','') and seed.doc_num(new_doc->'blockHeight',0)=0));
    when 'delete' then return actor is not null and (old_doc->>'authorId'=actor or seed.is_staff());
    else return false;
  end case;
end;
$$;

create function seed.rule_light_houses(action text, doc_id text, parent text, old_doc jsonb, new_doc jsonb, changed text[], moment timestamptz) returns boolean
language plpgsql stable security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid();
begin
  case action
    when 'get','list' then return coalesce(seed.can_read_light_house(old_doc),false);
    when 'create' then return actor is not null and seed.born_with_anchor(new_doc);
    when 'update' then return actor is not null and (
      (seed.changed_only(changed,array['lastCaredAt','updatedAt']) and seed.is_community_keeper(old_doc->>'communityId'))
      or ((old_doc->>'anchorUid'=actor or seed.is_staff()) and not seed.changed_any(changed,array['lid','loveCount'])));
    when 'delete' then return actor is not null and (old_doc->>'anchorUid'=actor or seed.is_staff());
    else return false;
  end case;
end;
$$;
create policy light_houses_visible on public.light_houses for select using(seed.rule_light_houses('list',id,null,doc,null,null,now()));

create function seed.rule_communities(action text, doc_id text, parent text, old_doc jsonb, new_doc jsonb, changed text[], moment timestamptz) returns boolean
language plpgsql stable security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid();
  frozen text[]:=array['lid','loveCount','anchorUid','bornOn','domainVerification','formedAt','formedBy','keeperUids','newsletterLastSentAt','newsletterLastSubject','newsletterLastSent','domainAliases'];
begin
  case action
    when 'get','list' then return true;
    when 'create' then return seed.papers_sound(new_doc) and actor is not null and seed.born_with_anchor(new_doc)
      and (seed.is_staff() or (new_doc->>'anchorUid'=actor and not (new_doc ? 'keeperUids') and not (new_doc ? 'domainAliases')))
      -- THE FULLNESS GATE (domain/limits): a node hosts at most its cap of communities; tree circles do not count.
      and (select count(*) from public.communities where doc->>'formation' is distinct from 'tree_keeping')<seed.community_cap();
    when 'update' then return seed.papers_sound(new_doc) and actor is not null
      and (old_doc->>'anchorUid'=actor or exists(select 1 from public.links where from_id=actor and rel='keeper' and to_id=doc_id) or seed.staff_hand('community_edit'))
      and not seed.changed_any(changed,frozen);
    when 'delete' then return actor is not null and (old_doc->>'anchorUid'=actor
      or exists(select 1 from public.links where from_id=actor and rel='keeper' and to_id=doc_id) or seed.is_staff());
    else return false;
  end case;
end;
$$;

-- Love: a being may read only its OWN mark; the slot moves only through seed.love_toggle.
create function seed.rule_loves(action text, doc_id text, parent text, old_doc jsonb, new_doc jsonb, changed text[], moment timestamptz) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select action in ('get','list') and seed.uid() is not null and doc_id=seed.uid();
$$;
create policy loves_own_slot on public.loves for select using(seed.rule_loves('list',uid,parent_id,doc,null,null,now()));

-- A bed's occupancy: public and identity-free; written by the bed's keeper or staff (the stays mirror writes it as the owner).
create function seed.rule_lifetree_occupancy(action text, doc_id text, parent text, old_doc jsonb, new_doc jsonb, changed text[], moment timestamptz) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select action in ('get','list') or (seed.uid() is not null and (seed.is_staff()
    or exists(select 1 from public.lifetrees where id=parent and doc->>'anchorUid'=seed.uid())));
$$;
create policy occupancy_world_read on public.lifetree_occupancy for select using(true);

create function seed.rule_bed_holds(action text, doc_id text, parent text, old_doc jsonb, new_doc jsonb, changed text[], moment timestamptz) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select seed.uid() is not null and case
    when action in ('get','list') then true
    when action in ('create','update') then doc_id=seed.uid() and seed.doc_text(new_doc->'holderUid',doc_id)=doc_id
      and jsonb_typeof(new_doc->'expiresAt')='number' and (new_doc->>'expiresAt')::numeric<=floor(extract(epoch from moment)*1000)+600000
    when action='delete' then doc_id=seed.uid() or seed.is_staff()
    else false end;
$$;
create policy bed_holds_signed_read on seed.bed_holds for select using(seed.rule_bed_holds('list',id,bed_id,doc,null,null,now()));

-- ── The one ledger: pulses and their subcollections ───────────────────────────────────────
-- A client births only a STANDALONE record (the chain is the server's — the block command).
create function seed.client_born_standalone(doc jsonb) returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select (not (doc ? 'previousHash') or seed.is_chain_root(doc->>'previousHash'))
    and ((not (doc ? 'lifetreeId') and not (doc ? 'visionId'))
      or (doc->>'type'='reach' and doc->>'previousHash' in ('PERSON_REACH','OFFER_NOTICE'))
      or (doc->>'type'='reach' and doc->>'previousHash' in ('WATER_ALERT','WATER_NOTICE')
        and (seed.is_staff() or seed.is_tree_carer(doc->>'lifetreeId')
          or exists(select 1 from public.links where from_id=seed.uid() and rel='guardian' and to_id=doc->>'lifetreeId'))))
    and coalesce(doc->>'care','')<>'watering';
$$;
revoke all on function seed.client_born_standalone(jsonb) from public;

create function seed.rule_pulses(action text, doc_id text, parent text, old_doc jsonb, new_doc jsonb, changed text[], moment timestamptz) returns boolean
language plpgsql stable security definer set search_path=pg_catalog as $$
declare actor text:=seed.uid(); staff boolean; kind text; readable boolean;
  event_fields text[]:=array['title','body','content','imageUrl','imageUrls','eventDate','eventEndDate','eventLocation','eventMaxParticipants','webLinks','visibility','updatedAt'];
  spend_marks text[]:=array['spend','spentAt','spentBy','spendId','offeringSuspendedLight','offeringAppreciations'];
begin
  case action
    when 'get','list' then return coalesce(seed.can_read_pulse(old_doc),false);
    when 'create' then
      if actor is null then return false; end if;
      staff:=seed.is_staff(); kind:=coalesce(new_doc->>'type','');
      return (staff or new_doc->>'authorId'=actor) and seed.client_born_standalone(new_doc) and seed.web_links_in_shape(new_doc)
        and (kind<>'event' or not (new_doc ? 'communityId') or staff or seed.keeps_community(new_doc->>'communityId'))
        and (kind<>'offering' or (coalesce(new_doc->>'offeringStatus','open')='open'
          and (staff or not (new_doc ? 'offeringFromTreeId') or seed.is_tree_carer(new_doc->>'offeringFromTreeId'))))
        and not (new_doc ?| array['offeringSuspendedLight','offeringAppreciations','spentAt','spentBy','spendId'])
        and (not (new_doc ? 'spend') or (kind='decision' and new_doc->>'nature'='purchase' and jsonb_typeof(new_doc->'spend')='object'
          and seed.doc_keys_only(new_doc->'spend',array['offeringId','units'])
          and jsonb_typeof(new_doc->'spend'->'offeringId')='string' and new_doc->'spend'->>'offeringId'<>''
          and jsonb_typeof(new_doc->'spend'->'units')='number' and (new_doc->'spend'->>'units')::numeric>0
          and (new_doc->'spend'->>'units')::numeric=trunc((new_doc->'spend'->>'units')::numeric)))
        and (kind<>'reach' or (not (new_doc ? 'recipientUid') and not (new_doc ? 'participantUids')) or new_doc->>'visibility'='private');
    when 'update' then
      if actor is null then return false; end if;
      staff:=seed.is_staff(); kind:=coalesce(old_doc->>'type',''); readable:=coalesce(seed.can_read_pulse(old_doc),false);
      return
        -- (a) the interaction overlays, gated by the same sight as reading; seenBy appends only oneself
        (readable and seed.changed_only(changed,array['seenBy','aiInterpretation','updatedAt'])
          and (not seed.changed_any(changed,array['seenBy']) or seed.uid_list_append(old_doc->'seenBy',new_doc->'seenBy',actor)))
        -- (d) governance on a decision: the circle's own business
        or (kind='decision' and (staff or seed.pulse_community_member(old_doc->>'communityId'))
          and seed.changed_only(changed,array['votes','concerns','positions','listening','status','passedAt','enactedHash','withdrawnAt','rejectedAt','withdrawnHash','updatedAt'])
          and (not seed.changed_any(changed,array['votes']) or (jsonb_typeof(new_doc->'votes')='array' and new_doc->'votes' @> coalesce(old_doc->'votes','[]'::jsonb)
            and (coalesce(old_doc->'votes','[]'::jsonb) || jsonb_build_array(actor)) @> (new_doc->'votes')))
          and (new_doc->'status' is not distinct from old_doc->'status' or staff or old_doc->>'proposedBy'=actor or seed.keeps_community(old_doc->>'communityId'))
          and (not seed.changed_any(changed,array['enactedHash','withdrawnHash']) or new_doc->'status' is distinct from old_doc->'status')
          and (not (seed.doc_bool(old_doc->'listening',false) and not seed.doc_bool(new_doc->'listening',false))
            or staff or old_doc->>'proposedBy'=actor or seed.keeps_community(old_doc->>'communityId')))
        -- (e) a decision's visibility flip
        or (kind='decision' and seed.changed_only(changed,array['visibility','updatedAt']) and coalesce(new_doc->>'visibility','') in ('public','community')
          and (staff or old_doc->>'proposedBy'=actor or seed.keeps_community(old_doc->>'communityId')))
        -- (f) event content edits
        or (kind='event' and (staff or old_doc->>'authorId'=actor or seed.keeps_community(old_doc->>'communityId'))
          and seed.web_links_in_shape(new_doc) and seed.changed_only(changed,event_fields))
        -- (f2) a keeper adopts a standalone event into the community rooted at its place of record
        or (kind='event' and not (old_doc ? 'communityId') and jsonb_typeof(new_doc->'communityId')='string' and new_doc->>'communityId'<>''
          and seed.keeps_community(new_doc->>'communityId')
          and exists(select 1 from public.communities c where c.id=new_doc->>'communityId' and coalesce(c.doc->>'domain','')=coalesce(old_doc->>'domain',''))
          and seed.web_links_in_shape(new_doc) and seed.changed_only(changed,event_fields || array['communityId']))
        -- (g) the guardians' veto within 72h, by a guardian whose tenure predates the mint
        or (kind='tree_growth' and moment<seed.vision_moment(old_doc)+interval '72 hours'
          and exists(select 1 from public.links l where l.from_id=actor and l.rel='guardian' and l.to_id=old_doc->>'lifetreeId' and l.created_at<=seed.vision_moment(old_doc))
          and seed.changed_only(changed,array['vetoes','updatedAt']) and seed.uid_list_append(old_doc->'vetoes',new_doc->'vetoes',actor))
        -- (h) the QR mint
        or ((staff or old_doc->>'authorId'=actor) and seed.changed_only(changed,array['qr','updatedAt']))
        -- (h2) one standing ask: a tree's thirst nudge rewritten by the hand that raised it
        or (old_doc->>'careAlert'='watering' and old_doc->>'authorId'=actor and seed.changed_only(changed,array['body','content','createdAt','updatedAt']))
        -- (i) the offering's lifecycle switch
        or (kind='offering' and old_doc->>'authorId'=actor and seed.changed_only(changed,array['offeringActive','updatedAt']) and jsonb_typeof(new_doc->'offeringActive')='boolean')
        -- (i2) offering content edits while unaccepted
        or (kind='offering' and (staff or old_doc->>'authorId'=actor) and coalesce(old_doc->>'offeringStatus','open')<>'accepted'
          and seed.changed_only(changed,array['title','body','content','imageUrl','imageUrls','offeringAppreciationLight','offeringUrl','visibility','updatedAt']))
        -- (i3) withdraw an open offering of care
        or (kind='offering' and old_doc->>'authorId'=actor and coalesce(old_doc->>'offeredToKind','') in ('tree','vision')
          and coalesce(old_doc->>'offeringStatus','open')='open' and new_doc->>'offeringStatus'='withdrawn'
          and seed.changed_only(changed,array['offeringStatus','offeringAnsweredAt','updatedAt']))
        -- (i4) decline, by a hand standing for the receiver
        or (kind='offering' and old_doc->>'authorId' is distinct from actor and coalesce(old_doc->>'offeringStatus','open')='open'
          and new_doc->>'offeringStatus'='declined' and new_doc->>'offeringAnsweredBy'=actor
          and seed.changed_only(changed,array['offeringStatus','offeringAnsweredAt','offeringAnsweredBy','updatedAt'])
          and ((old_doc->>'offeredToKind'='tree' and (staff or seed.is_tree_carer(old_doc->>'offeredToId')))
            or (old_doc->>'offeredToKind'='vision' and coalesce(old_doc->>'offeredToId','')<>''
              and exists(select 1 from public.visions v where v.id=old_doc->>'offeredToId' and (staff or v.doc->>'authorId'=actor)))))
        -- (h3) retraction: the mark, never the erasure
        or (kind='reach' and old_doc->>'authorId'=actor and seed.changed_only(changed,array['retractedAt','updatedAt']))
        -- (i5) the place-of-record mend
        or (staff and kind='event' and seed.changed_only(changed,array['domain','updatedAt','rehomedAt'])
          and jsonb_typeof(new_doc->'domain')='string' and new_doc->>'domain'<>'')
        -- (j) staff mend anything — except the marks of moved light
        or (staff and not seed.changed_any(changed,spend_marks));
    when 'delete' then
      if actor is null or seed.is_chain_block(old_doc) then return false; end if;
      return seed.is_staff() or (
        (old_doc->>'authorId'=actor or seed.keeps_community(old_doc->>'communityId'))
        and coalesce(old_doc->>'type','')<>'reach'
        and (coalesce(old_doc->>'type','')<>'decision' or (
          coalesce(old_doc->>'status','')<>'passed'
          and (not (old_doc ? 'votes') or (jsonb_typeof(old_doc->'votes')='array' and jsonb_build_array(old_doc->>'proposedBy') @> (old_doc->'votes')))
          and (not (old_doc ? 'positions') or (jsonb_typeof(old_doc->'positions')='array' and jsonb_array_length(old_doc->'positions')=0)))));
    else return false;
  end case;
end;
$$;

-- A decision's signatures: one slot per member (the doc id IS the signer), frozen the moment it lands.
create function seed.rule_pulse_signatures(action text, doc_id text, parent text, old_doc jsonb, new_doc jsonb, changed text[], moment timestamptz) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select case
    when action in ('get','list') then seed.uid() is not null
    when action='create' then seed.uid() is not null and doc_id=seed.uid()
      and seed.doc_keys_only(new_doc,array['sig','pubkey','version','keyFingerprint','epochId','recordedAt','position'])
      and seed.is_current_epoch_signature(doc_id,new_doc,moment)
      and exists(select 1 from public.pulses p where p.id=parent and p.doc->>'type'='decision' and seed.pulse_community_member(p.doc->>'communityId'))
    when action='delete' then seed.is_staff()
    else false end;
$$;
create policy pulse_signatures_signed_read on public.pulse_signatures for select using(seed.uid() is not null);

-- The keeper's observation of a Light House care: one witness slot, the true name aboard.
create function seed.rule_pulse_witnesses(action text, doc_id text, parent text, old_doc jsonb, new_doc jsonb, changed text[], moment timestamptz) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select case
    when action in ('get','list') then seed.uid() is not null
    when action='create' then seed.uid() is not null and doc_id=seed.uid()
      and seed.doc_keys_only(new_doc,array['uid','lid','name','witnessedAt'])
      and new_doc->>'uid'=seed.uid()
      and new_doc->>'lid'=(select coalesce(doc->>'lid','__none__') from public.persons where doc_id=seed.uid())
      and new_doc->'witnessedAt'=seed.doc_stamp(moment)
      and exists(select 1 from public.pulses p where p.id=parent and p.doc->'care'='true'::jsonb and coalesce(p.doc->>'lightHouseId','')<>''
        and p.doc->>'authorId' is distinct from seed.uid() and seed.is_community_keeper(p.doc->>'communityId'))
    when action='delete' then seed.is_staff()
    else false end;
$$;
create policy pulse_witnesses_signed_read on public.pulse_witnesses for select using(seed.uid() is not null);

-- ── Stays, light, support ─────────────────────────────────────────────────────────────────
create function seed.rule_stays(action text, doc_id text, parent text, old_doc jsonb, new_doc jsonb, changed text[], moment timestamptz) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select seed.uid() is not null and case
    when action in ('get','list','delete') then old_doc->>'uid'=seed.uid() or old_doc->>'hostUid'=seed.uid() or seed.is_staff()
    when action='create' then new_doc->>'uid'=seed.uid() and coalesce(new_doc->>'status','')='requested' and coalesce(new_doc->>'bedId','')<>''
      and jsonb_typeof(new_doc->'fromDate')='string' and jsonb_typeof(new_doc->'toDate')='string' and new_doc->>'fromDate'<new_doc->>'toDate'
      and exists(select 1 from public.lifetrees b where b.id=new_doc->>'bedId' and b.doc->>'treeType'='BED' and coalesce(new_doc->>'hostUid','')=b.doc->>'anchorUid')
    when action='update' then (old_doc->>'hostUid'=seed.uid() or seed.is_staff())
      and seed.changed_only(changed,array['status','updatedAt']) and coalesce(new_doc->>'status','') in ('requested','accepted','declined')
    else false end;
$$;
create policy stays_parties_read on public.stays for select using(seed.rule_stays('list',id,null,doc,null,null,now()));

-- THE OCCUPANCY MIRROR (functions/onStayWritten): an accepted stay publishes its identity-free
-- nights on the bed; anything else withdraws them; a double-booking is refused at the write.
create function seed.stays_occupancy_mirror() returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare stay jsonb; stay_id text; bed_id text;
begin
  stay:=case when tg_op='DELETE' then null else new.doc end;
  stay_id:=coalesce(new.id,old.id); bed_id:=coalesce(stay->>'bedId',old.doc->>'bedId','');
  if bed_id='' then return null; end if;
  if stay is null or stay->>'status' is distinct from 'accepted' then
    delete from public.lifetree_occupancy where lifetree_id=bed_id and id=stay_id;
    return null;
  end if;
  if exists(select 1 from public.stays s where s.id<>stay_id and s.doc->>'bedId'=bed_id and s.doc->>'status'='accepted'
    and s.doc->>'fromDate'<stay->>'toDate' and stay->>'fromDate'<s.doc->>'toDate') then
    raise exception 'Bed already holds a guest for these nights' using errcode='LS046'; end if;
  insert into public.lifetree_occupancy(lifetree_id,id,doc) values(bed_id,stay_id,jsonb_build_object('fromDate',stay->>'fromDate','toDate',stay->>'toDate'))
    on conflict(lifetree_id,id) do update set doc=excluded.doc;
  return null;
end;
$$;
revoke all on function seed.stays_occupancy_mirror() from public;
create trigger stays_occupancy after insert or update or delete on public.stays for each row execute function seed.stays_occupancy_mirror();

create function seed.rule_supports(action text, doc_id text, parent text, old_doc jsonb, new_doc jsonb, changed text[], moment timestamptz) returns boolean
language sql stable security definer set search_path=pg_catalog as $$ select action in ('get','list') and seed.uid() is not null; $$;
create policy supports_signed_read on public.supports for select using(seed.uid() is not null);
create function seed.rule_rays(action text, doc_id text, parent text, old_doc jsonb, new_doc jsonb, changed text[], moment timestamptz) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select action in ('get','list') and seed.uid() is not null and (old_doc->>'holderUid'=seed.uid() or seed.is_staff());
$$;
create policy rays_holder_read on public.rays for select using(seed.rule_rays('list',id,null,doc,null,null,now()));
create function seed.rule_glow(action text, doc_id text, parent text, old_doc jsonb, new_doc jsonb, changed text[], moment timestamptz) returns boolean
language sql stable security definer set search_path=pg_catalog as $$ select action in ('get','list') and seed.uid() is not null; $$;
create policy glow_signed_read on public.glow for select using(seed.uid() is not null);
create function seed.rule_gifts(action text, doc_id text, parent text, old_doc jsonb, new_doc jsonb, changed text[], moment timestamptz) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select action in ('get','list') and seed.uid() is not null and (old_doc->>'giverUid'=seed.uid() or seed.is_staff());
$$;
create policy gifts_giver_read on public.gifts for select using(seed.rule_gifts('list',id,null,doc,null,null,now()));
create function seed.rule_spends(action text, doc_id text, parent text, old_doc jsonb, new_doc jsonb, changed text[], moment timestamptz) returns boolean
language sql stable security definer set search_path=pg_catalog as $$ select action in ('get','list') and seed.uid() is not null; $$;
create policy spends_signed_read on public.spends for select using(seed.uid() is not null);

-- ── Agreements ────────────────────────────────────────────────────────────────────────────
-- Alignments are negotiated through their own command (045); the door reads them to their parties.
create function seed.rule_alignments(action text, doc_id text, parent text, old_doc jsonb, new_doc jsonb, changed text[], moment timestamptz) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select case when action in ('get','list') then coalesce(seed.can_read_alignment(old_doc),false)
    when action in ('update','delete') then seed.is_staff() else false end;
$$;
create function seed.rule_covenants(action text, doc_id text, parent text, old_doc jsonb, new_doc jsonb, changed text[], moment timestamptz) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select seed.uid() is not null and case
    when action in ('get','list') then true
    when action='create' then seed.is_staff() or new_doc->>'proposedBy'=seed.uid()
    when action='update' then (seed.is_covenant_party(doc_id) or old_doc->>'proposedBy'=seed.uid() or seed.is_staff())
      and seed.changed_only(changed,array['status','latestHash','blockHeight','sealedAt']) and coalesce(new_doc->>'status','') in ('proposed','sealed','broken')
    when action='delete' then seed.is_staff()
    else false end;
$$;
create policy covenants_signed_read on public.covenants for select using(seed.uid() is not null);
create function seed.rule_covenant_signatures(action text, doc_id text, parent text, old_doc jsonb, new_doc jsonb, changed text[], moment timestamptz) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select case
    when action in ('get','list') then seed.uid() is not null
    when action='create' then seed.uid() is not null and doc_id=seed.uid()
      and seed.doc_keys_only(new_doc,array['sig','pubkey','version','keyFingerprint','epochId','recordedAt'])
      and seed.is_current_epoch_signature(doc_id,new_doc,moment)
      and exists(select 1 from public.links where from_id=seed.uid() and rel='party' and to_id=parent)
    when action='delete' then seed.is_staff()
    else false end;
$$;
create policy covenant_signatures_signed_read on public.covenant_signatures for select using(seed.uid() is not null);

-- ── Doors & invitations ───────────────────────────────────────────────────────────────────
create function seed.rule_invite_requests(action text, doc_id text, parent text, old_doc jsonb, new_doc jsonb, changed text[], moment timestamptz) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select case when action='create' then new_doc->>'status'='pending' else seed.is_staff() end;
$$;
create policy invite_requests_staff_read on public.invite_requests for select using(seed.is_staff());
-- The invitation id is the unguessable token: one may be fetched by anyone holding it; lists stay with the inviter and staff.
create function seed.rule_network_invites(action text, doc_id text, parent text, old_doc jsonb, new_doc jsonb, changed text[], moment timestamptz) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select case
    when action='get' then true
    when action='list' then seed.uid() is not null and (old_doc->>'invitedByUserId'=seed.uid() or seed.is_staff())
    when action='create' then seed.uid() is not null and new_doc->>'invitedByUserId'=seed.uid()
    when action='update' then seed.uid() is not null and old_doc->>'status'='pending' and new_doc->>'status'='accepted'
      and new_doc->>'acceptedByUserId'=seed.uid()
      and new_doc->'email' is not distinct from old_doc->'email' and new_doc->'invitedByUserId' is not distinct from old_doc->'invitedByUserId'
      and coalesce(new_doc->>'nodeCommunityId','')=coalesce(old_doc->>'nodeCommunityId','') and coalesce(new_doc->>'nodeDomain','')=coalesce(old_doc->>'nodeDomain','')
    when action='delete' then seed.is_staff()
    else false end;
$$;
create policy network_invites_inviter_read on public.network_invites for select using(seed.rule_network_invites('list',id,null,doc,null,null,now()));
create function seed.rule_community_tree_invites(action text, doc_id text, parent text, old_doc jsonb, new_doc jsonb, changed text[], moment timestamptz) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select seed.uid() is not null and case
    when action in ('get','list') then true
    when action='create' then new_doc->>'invitedByUserId'=seed.uid()
    when action='update' then old_doc->>'invitedUserId'=seed.uid() or old_doc->>'invitedByUserId'=seed.uid()
    when action='delete' then seed.is_staff()
    else false end;
$$;
create policy community_tree_invites_signed_read on public.community_tree_invites for select using(seed.uid() is not null);
create function seed.rule_community_keeper_invites(action text, doc_id text, parent text, old_doc jsonb, new_doc jsonb, changed text[], moment timestamptz) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select seed.uid() is not null and case
    when action in ('get','list') then true
    when action='create' then new_doc->>'invitedByUserId'=seed.uid() and seed.keeps_community(new_doc->>'communityId')
    when action='update' then (old_doc->>'invitedUserId'=seed.uid() or old_doc->>'invitedByUserId'=seed.uid())
      and not seed.changed_any(changed,array['communityId','invitedUserId','invitedByUserId'])
    when action='delete' then seed.is_staff()
    else false end;
$$;

-- ── The node fabric ───────────────────────────────────────────────────────────────────────
create function seed.rule_collabs(action text, doc_id text, parent text, old_doc jsonb, new_doc jsonb, changed text[], moment timestamptz) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select case
    when action in ('get','list') then true
    when action='create' then seed.is_staff() or (seed.uid() is not null and new_doc->>'createdBy'=seed.uid())
    when action='update' then seed.is_staff() or (seed.uid() is not null and old_doc->>'createdBy'=seed.uid() and seed.changed_only(changed,array['communityId','logoUrl','blurb']))
    when action='delete' then seed.is_staff() or (seed.uid() is not null and old_doc->>'createdBy'=seed.uid())
    else false end;
$$;
create policy collabs_world_read on public.collabs for select using(true);
create function seed.rule_intelligences(action text, doc_id text, parent text, old_doc jsonb, new_doc jsonb, changed text[], moment timestamptz) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select case
    when action in ('get','list') then old_doc->'public'='true'::jsonb or (seed.uid() is not null and (old_doc->>'authorId'=seed.uid() or seed.is_staff()))
    when action='create' then seed.uid() is not null and (seed.is_staff() or new_doc->>'authorId'=seed.uid()
      or (new_doc->>'credentialScope'='community' and seed.is_community_keeper(new_doc->>'credentialHolderUid')
        and new_doc->>'authorId'=(select doc->>'anchorUid' from public.communities where id=new_doc->>'credentialHolderUid')))
    when action in ('update','delete') then seed.uid() is not null and (old_doc->>'authorId'=seed.uid() or seed.is_staff())
    else false end;
$$;
create policy intelligences_visible on public.intelligences for select using(seed.rule_intelligences('list',id,null,doc,null,null,now()));
create function seed.rule_personas(action text, doc_id text, parent text, old_doc jsonb, new_doc jsonb, changed text[], moment timestamptz) returns boolean
language sql stable security definer set search_path=pg_catalog as $$ select action in ('get','list') or seed.is_staff(); $$;
create policy personas_world_read on public.personas for select using(true);
create function seed.rule_memories(action text, doc_id text, parent text, old_doc jsonb, new_doc jsonb, changed text[], moment timestamptz) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select case
    when action in ('get','list') then old_doc->>'visibility'='public' or seed.is_staff() or (seed.uid() is not null and old_doc->>'visibility'='community')
    when action='create' then seed.uid() is not null and (seed.is_staff() or new_doc->>'authorId'=seed.uid())
      and (not (new_doc ? 'communityId') or seed.is_staff() or seed.keeps_community(new_doc->>'communityId'))
    when action in ('update','delete') then seed.uid() is not null and (seed.is_staff() or seed.keeps_community(old_doc->>'communityId'))
    else false end;
$$;
create policy memories_visible on public.memories for select using(seed.rule_memories('list',id,null,doc,null,null,now()));
-- The letter of a place: anyone subscribes an address; a being re-sets the rows it wrote itself
-- (the node binds no email claim, so the row's own `uid` stands where the token's email stood).
create function seed.rule_subscriptions(action text, doc_id text, parent text, old_doc jsonb, new_doc jsonb, changed text[], moment timestamptz) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select case
    when action in ('get','list') then seed.is_staff() or (seed.uid() is not null and old_doc->>'uid'=seed.uid())
    when action='create' then jsonb_typeof(new_doc->'domain')='string' and new_doc->>'domain'<>'' and jsonb_typeof(new_doc->'email')='string' and new_doc->>'email'<>''
      and not (new_doc ? 'unsubToken') and (not (new_doc ? 'uid') or new_doc->>'uid'=seed.uid())
    when action='update' then seed.is_staff() or (seed.uid() is not null and old_doc->>'uid'=seed.uid() and not seed.changed_any(changed,array['unsubToken','email','domain','uid']))
    when action='delete' then seed.is_staff()
    else false end;
$$;
create policy subscriptions_own_read on public.subscriptions for select using(seed.rule_subscriptions('list',id,null,doc,null,null,now()));

-- Every rule is the door's alone: callable through doc_get / doc_write / the policies, never granted to a hand.
do $revoke$
declare f record;
begin
  for f in select p.oid::regprocedure::text as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='seed' and p.proname like 'rule\_%' loop
    execute 'revoke all on function ' || f.signature || ' from public';
  end loop;
end
$revoke$;
