import React from 'react';
import { Community, Sanctuary } from '../../types';
import { tabTone } from '../../utils/tabTheme';
import { SanctuarySection } from '../sections/SanctuarySection';

interface CommunitySanctuaryProps {
  community: Community;
  // The first sanctuary rooted in this domain (earliest), shown as "The Sanctuary".
  sanctuary: Sanctuary | null;
}

// The Sanctuary tab — a thin community binding over the entity-generic SanctuarySection:
// the shell loads the domain's first sanctuary; this supplies it plus headings and accent.
export const CommunitySanctuary: React.FC<CommunitySanctuaryProps> = ({ community, sanctuary }) => (
  <SanctuarySection
    title="The Sanctuary"
    sub="The first sacred place that holds this community's lifetrees."
    sanctuary={sanctuary}
    emptyMessage="No sanctuary has been consecrated for this community yet."
    placeholderColor={community.theme?.primary || tabTone('communities')}
  />
);
