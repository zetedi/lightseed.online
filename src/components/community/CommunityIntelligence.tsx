import React, { useCallback } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Community } from '../../types';
import { updateCommunity } from '../../services/firebase';
import { IntelligenceSection, type IntelligenceSelection } from '../sections/IntelligenceSection';

interface CommunityIntelligenceProps {
  community: Community;
  canEdit: boolean;
  currentUserId?: string;
  onUpdate?: (updates: Partial<Community>) => void;
}

// Intelligence tab — a thin community binding over the entity-generic IntelligenceSection:
// it supplies the community-scoped persistence, panel ownership and headings; everything
// else (selection, curation list, save flow) is shared.
export const CommunityIntelligence: React.FC<CommunityIntelligenceProps> = ({ community, canEdit, currentUserId, onUpdate }) => {
  const { t } = useLanguage();

  // Memoized so the section's quick-select and save paths hold a stable persist binding.
  const saveSelection = useCallback(
    (selection: IntelligenceSelection) => updateCommunity(community.id, selection),
    [community.id],
  );

  return (
    <IntelligenceSection
      scope="community"
      canEdit={canEdit}
      currentUserId={currentUserId}
      entityId={community.id}
      credentialOwnerId={community.id}
      intelligenceOwnerUid={community.ownerId}
      canManageAll={!!canEdit}
      defaultIntelligenceId={community.defaultIntelligenceId}
      availableIntelligenceIds={community.availableIntelligenceIds}
      onSave={saveSelection}
      onSaved={onUpdate}
      title="Community Intelligence"
      sub="Choose which intelligences serve this community and which is the default. An intelligence is a participant, never an authority — and always replaceable."
      panelTitle={t('intel_community_title')}
      panelSubtitle={t('intel_community_sub')}
    />
  );
};
