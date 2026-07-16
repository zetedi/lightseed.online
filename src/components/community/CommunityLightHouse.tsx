import React from 'react';
import { Community, LightHouse } from '../../types';
import { tabTone } from '../../utils/tabTheme';
import { LightHouseSection, type LightHouseDraft } from '../sections/LightHouseSection';

interface CommunityLightHouseProps {
  community: Community;
  // Every lightHouse rooted in this domain THAT THE VIEWER MAY SEE (gated by the shell).
  lightHouses: LightHouse[];
  // Keepers (and staff) may consecrate new lightHouses for this community.
  canEdit?: boolean;
  onCreate?: (draft: LightHouseDraft) => Promise<void>;
  onUploadImage?: (file: File) => Promise<string>;
  onOpen?: (lightHouse: LightHouse) => void;
  adoptable?: LightHouse[];
  onAdopt?: (lightHouse: LightHouse) => Promise<void>;
}

// The LightHouses tab — a thin community binding over the entity-generic LightHouseSection:
// the shell loads and visibility-gates the domain's lightHouses; this supplies headings + accent.
export const CommunityLightHouse: React.FC<CommunityLightHouseProps> = ({ community, lightHouses, canEdit = false, onCreate, onUploadImage, onOpen, adoptable, onAdopt }) => (
  <LightHouseSection
    title="Light Houses"
    sub="The sacred places that hold this community's lifetrees."
    lightHouses={lightHouses}
    emptyMessage="No Light House has been consecrated for this community yet."
    placeholderColor={community.theme?.primary || tabTone('communities')}
    canCreate={canEdit}
    onCreate={onCreate}
    onUploadImage={onUploadImage}
    onOpen={onOpen}
    adoptable={adoptable}
    onAdopt={onAdopt}
  />
);
