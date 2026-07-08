import React, { useCallback } from 'react';
import { Community, Lifetree } from '../../types';
import { fetchAllLifetrees, inviteTreeToCommunity } from '../../services/firebase';
import { tabTone } from '../../utils/tabTheme';
import { TreesSection } from '../sections/TreesSection';

interface CommunityTreesTabProps {
  community: Community;
  currentUserId?: string;
  // Domain trees + participating trees, deduped (computed in the shell — shared with other tabs).
  communityTrees: Lifetree[];
  onViewTree?: (tree: Lifetree) => void;
  // Guardianship is shared state (also shown on the First Tree tab), so it lives in the shell.
  guardedTreeIds: Set<string>;
  togglingId: string | null;
  onToggleGuardian: (tree: Lifetree) => void;
}

// Community Trees tab — a thin community binding over the entity-generic TreesSection: it
// supplies the community-scoped invite search/send, headings and theme accent; the grid,
// guardianship pills and invite flow are shared.
export const CommunityTreesTab: React.FC<CommunityTreesTabProps> = ({
  community,
  currentUserId,
  communityTrees,
  onViewTree,
  guardedTreeIds,
  togglingId,
  onToggleGuardian,
}) => {
  // Both bindings are memoized so the section holds stable scope-bound loaders.
  const searchInvitable = useCallback(async (term: string) => {
    const all = await fetchAllLifetrees();
    const here = new Set(communityTrees.map(t => t.id));
    return all.filter(t => !t.isNature && !here.has(t.id) && (t.name || '').toLowerCase().includes(term)).slice(0, 8);
  }, [communityTrees]);

  const handleInvite = useCallback(async (tree: Lifetree) => {
    if (!currentUserId) throw new Error('Sign in to invite a tree.');
    await inviteTreeToCommunity({
      communityId: community.id, communityName: community.name || community.domain,
      lifetreeId: tree.id, lifetreeName: tree.name || 'A tree', treeOwnerId: tree.ownerId,
      invitedByUserId: currentUserId,
    });
  }, [community, currentUserId]);

  return (
    <TreesSection
      title="Community Trees"
      sub="Lifetrees rooted here or standing with this community. Join a guardianship to help tend one."
      currentUserId={currentUserId}
      trees={communityTrees}
      onViewTree={onViewTree}
      guardedTreeIds={guardedTreeIds}
      togglingId={togglingId}
      onToggleGuardian={onToggleGuardian}
      searchInvitable={searchInvitable}
      onInvite={handleInvite}
      noMatchesMessage="No matching trees (already-standing and nature trees are hidden)."
      emptyMessage="No lifetrees linked to this domain yet."
      placeholderColor={community.theme?.primary || tabTone('communities')}
    />
  );
};
