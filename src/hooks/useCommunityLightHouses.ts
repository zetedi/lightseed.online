import { useEffect, useMemo, useState } from 'react';
import { getLightHousesByDomain, getLightHousesByCommunity, getAllLightHouses, createLightHouse, adoptLightHouse, uploadImage } from '@backend';
import type { Community, LightHouse } from '../types';
import { canViewLightHouse } from '../domain/lightHouse';
import { uploadFileName } from '../domain/imageBytes';
import { graphStore } from '../services/store';
import { announce } from '../services/refreshBus';
import { useRefreshSignal } from './useRefreshSignal';
import { notify } from '../services/toastBus';
import { speak, spokenLine } from '../utils/translations';

// A COMMUNITY'S LIGHT HOUSES — the ones rooted in its domain or stepped into it THAT THIS
// VIEWER MAY SEE, the ones a keeper could invite to step in, and the three hands of the tab
// (consecrate, upload a picture, adopt). Lifted whole out of CommunityProfile (ring 2026-11-19).
export const useCommunityLightHouses = (
  community: Community,
  viewer: { currentUserId: string | undefined; isSuperAdmin: boolean; isAdmin: boolean; isMember: boolean; canEdit: boolean },
) => {
  const { currentUserId, isSuperAdmin, isAdmin, isMember, canEdit } = viewer;
  const [lightHouses, setLightHouses] = useState<LightHouse[]>([]);
  const lightHouseSignal = useRefreshSignal(['lightHouses']);

  useEffect(() => {
    // Rooted here (by domain) PLUS stepped-into (by communityIds), deduped. Signed-out
    // viewers may only run public-provable queries — the read rule refuses the rest.
    const publicOnly = !currentUserId;
    Promise.all([
      getLightHousesByDomain(community.domain, { publicOnly }).catch(() => [] as LightHouse[]),
      publicOnly ? Promise.resolve([] as LightHouse[]) : getLightHousesByCommunity(community.id).catch(() => [] as LightHouse[]),
    ]).then(([byDomain, byBelonging]) => {
      const seen = new Set<string>();
      setLightHouses([...byDomain, ...byBelonging].filter(s => !seen.has(s.id) && seen.add(s.id) !== undefined));
    }).catch(() => {});
  }, [community.domain, community.id, currentUserId, lightHouseSignal]);

  // LightHouses elsewhere in the network this community could step into — keepers only.
  const [adoptable, setAdoptable] = useState<LightHouse[]>([]);
  useEffect(() => {
    if (!canEdit || !currentUserId) { return; }
    let alive = true;
    Promise.all([getAllLightHouses(), graphStore.linksByRel('shelters')])
      .then(([all, shelterLinks]) => {
        if (!alive) return;
        const homesOf = new Map<string, string[]>();
        for (const l of shelterLinks) homesOf.set(l.from, [...(homesOf.get(l.from) || []), l.to]);
        setAdoptable(all.filter(s => {
          const homes = [...(s.communityId ? [s.communityId] : []), ...(homesOf.get(s.id) || [])];
          // Consent lives with the lightHouse: only its keeper (or staff) may step it in —
          // the rules enforce this, so the panel offers only what would actually succeed.
          const mayStepIn = s.anchorUid === currentUserId || isSuperAdmin || isAdmin;
          return mayStepIn
            && !homes.includes(community.id)
            && s.domain !== community.domain
            && canViewLightHouse(s, { uid: currentUserId, isStaff: isSuperAdmin || isAdmin, memberCommunityIds: new Set<string>() }, homes);
        }));
      }).catch(() => {});
    return () => { alive = false; };
  }, [canEdit, currentUserId, isSuperAdmin, isAdmin, community.id, community.domain, lightHouseSignal]);

  // The lightHouses rooted in this domain THAT THIS VIEWER MAY SEE —
  // lightHouses are private (community-level) by default.
  // Homes come from the shelters links, so a stepped-in lightHouse is visible to members
  // of THIS community even when its primary home is elsewhere.
  const [shelterHomes, setShelterHomes] = useState<Map<string, string[]>>(new Map());
  useEffect(() => {
    let alive = true;
    graphStore.linksByRel('shelters').then(links => {
      if (!alive) return;
      const m = new Map<string, string[]>();
      for (const l of links) m.set(l.from, [...(m.get(l.from) || []), l.to]);
      setShelterHomes(m);
    }).catch(() => {});
    return () => { alive = false; };
  }, [lightHouseSignal]);
  const viewableLightHouses = useMemo(() => lightHouses.filter(s => canViewLightHouse(s, {
    uid: currentUserId,
    isStaff: isSuperAdmin || isAdmin,
    memberCommunityIds: isMember ? new Set([community.id]) : new Set(),
  }, [...(s.communityId ? [s.communityId] : []), ...(shelterHomes.get(s.id) || [])])), [lightHouses, shelterHomes, currentUserId, isSuperAdmin, isAdmin, isMember, community.id]);

  type LightHouseDraft = Omit<Parameters<typeof createLightHouse>[0], 'anchorUid' | 'domain' | 'communityId'>;
  const consecrate = async (draft: LightHouseDraft) => {
    if (!currentUserId) return;
    await createLightHouse({
      ...draft,
      anchorUid: currentUserId,
      domain: community.domain,
      communityId: community.id,
    });
    announce('lightHouses');
    notify(speak('lh_consecrated_toast'));
  };
  const uploadLightHouseImage = (file: File) =>
    uploadImage(file, `communities/${community.id}/lightHouses/${uploadFileName(file.name, Date.now())}`);
  const adopt = async (s: LightHouse) => {
    await adoptLightHouse(s.id, community.id);
    announce('lightHouses');
    notify(spokenLine('lh_holds_community_too', { name: s.name }));
  };

  return { viewableLightHouses, adoptable, consecrate, uploadLightHouseImage, adopt };
};
