import React from 'react';
import { Community, Sanctuary } from '../../types';
import { tabTone } from '../../utils/tabTheme';
import { SanctuarySection, type SanctuaryDraft } from '../sections/SanctuarySection';

interface CommunitySanctuaryProps {
  community: Community;
  // Every sanctuary rooted in this domain THAT THE VIEWER MAY SEE (gated by the shell).
  sanctuaries: Sanctuary[];
  // Keepers (and staff) may consecrate new sanctuaries for this community.
  canEdit?: boolean;
  onCreate?: (draft: SanctuaryDraft) => Promise<void>;
  onUploadImage?: (file: File) => Promise<string>;
  onOpen?: (sanctuary: Sanctuary) => void;
}

// The Sanctuaries tab — a thin community binding over the entity-generic SanctuarySection:
// the shell loads and visibility-gates the domain's sanctuaries; this supplies headings + accent.
export const CommunitySanctuary: React.FC<CommunitySanctuaryProps> = ({ community, sanctuaries, canEdit = false, onCreate, onUploadImage, onOpen }) => (
  <SanctuarySection
    title="Sanctuaries"
    sub="The sacred places that hold this community's lifetrees."
    sanctuaries={sanctuaries}
    emptyMessage="No sanctuary has been consecrated for this community yet."
    placeholderColor={community.theme?.primary || tabTone('communities')}
    canCreate={canEdit}
    onCreate={onCreate}
    onUploadImage={onUploadImage}
    onOpen={onOpen}
  />
);
