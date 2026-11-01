-- A paired record names both beings. Its visibility cannot disclose a private
-- counterpart. The recorded agreement parties retain access to their agreement.
create function seed.offering_twin_party(pulse_id text,pulse jsonb) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select seed.uid() is not null and exists(select 1 from public.pulses o
    where o.id=pulse->>'offeringId' and o.doc->>'type'='offering' and o.doc->>'offeringStatus'='accepted'
    and pulse->>'offeringRole' in ('from','to')
    and o.doc->'offeringAcceptedPulseIds'->>(pulse->>'offeringRole')=pulse_id
    and ((jsonb_typeof(o.doc->'authorId')='string' and o.doc->>'authorId'=seed.uid())
      or (jsonb_typeof(o.doc->'offeringAnsweredBy')='string' and o.doc->>'offeringAnsweredBy'=seed.uid())));
$$;
revoke all on function seed.offering_twin_party(text,jsonb) from public;

create function seed.offering_bearer_visible(kind text,bearer_id text) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select case when kind='tree' then exists(select 1 from public.lifetrees t where t.id=bearer_id
    and seed.can_read_tree(t.id,t.doc) and (coalesce(t.doc->>'visibility','public')<>'private' and coalesce(t.doc->>'treeType','')<>'SECRET'
      or seed.pulse_tree_circle(t.id)))
    when kind='vision' then exists(select 1 from public.visions v where v.id=bearer_id and seed.can_read_vision(v.doc))
    else false end;
$$;
revoke all on function seed.offering_bearer_visible(text,text) from public;

create function seed.offering_twin_access(pulse_id text,pulse jsonb) returns boolean
language sql stable security definer set search_path=pg_catalog as $$
  select not(pulse ? 'offeringRole') or seed.is_staff() or seed.offering_twin_party(pulse_id,pulse)
    or coalesce(pulse->>'offeringRole' in ('from','to')
      and seed.offering_bearer_visible(case when pulse ? 'visionId' then 'vision' else 'tree' end,
        case when pulse ? 'visionId' then pulse->>'visionId' else pulse->>'lifetreeId' end)
      and seed.offering_bearer_visible(pulse->>'offeringTwinKind',pulse->>'offeringTwinOf'),false);
$$;
revoke all on function seed.offering_twin_access(text,jsonb) from public;
create policy offering_twin_parties on public.pulses for select using(seed.offering_twin_party(id,doc));
create policy offering_twin_privacy on public.pulses as restrictive for select using(seed.offering_twin_access(id,doc));
