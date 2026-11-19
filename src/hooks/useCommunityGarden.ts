import { useEffect, useMemo, useState } from 'react';
import { getMySecretTreesAt } from '@backend/trees';
import { getTreesByDomain, treesStandingIn, getParticipatingTrees } from '@backend';
import type { Community, Lifetree } from '../types';
import { ownMergeUid } from '../domain/pulseVisibility';
import { canCareForTree } from '../domain/policy';
import { graphStore } from '../services/store';
import { showAlert } from '../components/ui/Dialog';

const bareDomain = (d?: string) => (d || '').toLowerCase().replace(/^www\./, '');

// A COMMUNITY'S GARDEN — the trees its face shows (rooted in its domain, standing in it,
// joined to it, and the viewer's own secret trees there) and the viewer's guardian hand over
// them. Lifted whole out of CommunityProfile (ring 2026-11-19).
export const useCommunityGarden = (community: Community, currentUserId: string | undefined) => {
  const [linkedTrees, setLinkedTrees] = useState<Lifetree[]>([]);
  // The viewer's SECRET trees rooted here (domain/secretTree): shown in the garden to their circle
  // alone, kept apart from linkedTrees so a secret tree never becomes the place's first tree or
  // flows into its vision.
  const [secretTrees, setSecretTrees] = useState<Lifetree[]>([]);
  useEffect(() => {
    let alive = true;
    if (currentUserId) getMySecretTreesAt(currentUserId, community.domain).then(ts => { if (alive) setSecretTrees(ts); }).catch(() => {});
    return () => { alive = false; };
  }, [currentUserId, community.domain]);
  // Trees that joined this community via 'participant' links (invited, or self-joined).
  const [participatingTrees, setParticipatingTrees] = useState<Lifetree[]>([]);

  const [togglingId, setTogglingId] = useState<string | null>(null);
  // Which trees the signed-in user guards — read from their outgoing 'guardian' links (the LIN),
  // not the legacy tree.guardians array (which writes no longer touch).
  const [guardedTreeIds, setGuardedTreeIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset-on-signout before the async links fetch below
    if (!currentUserId) { setGuardedTreeIds(new Set()); return; }
    let alive = true;
    graphStore.linksFrom(currentUserId, 'guardian')
      .then(links => { if (alive) setGuardedTreeIds(new Set(links.map(l => l.to))); })
      .catch(() => {});
    return () => { alive = false; };
  }, [currentUserId]);

  useEffect(() => {
    // Own-tree merge only where the place allows it (domain ownMergeUid): a STRICT face
    // shows this place's forest and nothing else — the viewer's off-domain trees stay home.
    // PLUS the standing trees (grows_in, ring 2026-08-24): trees from other places that
    // entered this garden through its door — one tree, many gardens, every edge explicit.
    const host = { reflectsPublic: community.reflectsPublic, strictScope: community.strictScope };
    Promise.all([
      getTreesByDomain(community.domain, ownMergeUid(currentUserId, host)).catch(() => [] as Lifetree[]),
      treesStandingIn(community.id).catch(() => [] as Lifetree[]),
    ]).then(([byDomain, standing]) => {
      const seen = new Set(byDomain.map(t => t.id));
      setLinkedTrees([...byDomain, ...standing.filter(t => !seen.has(t.id))]);
    }).catch(() => {});
  }, [community.id, community.domain, currentUserId, community.reflectsPublic, community.strictScope]);

  // The first lifetree rooted in this community's domain (earliest planted).
  const domainTrees = useMemo(() => {
    const d = bareDomain(community.domain);
    return linkedTrees
      .filter(tree => bareDomain(tree.domain) === d)
      .sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));
  }, [linkedTrees, community.domain]);
  const firstTree = domainTrees[0] || null;

  // Load the trees standing with this community via participant links.
  useEffect(() => {
    let alive = true;
    getParticipatingTrees(community.id).then(ts => { if (alive) setParticipatingTrees(ts); }).catch(() => {});
    return () => { alive = false; };
  }, [community.id]);

  // The trees tab shows domain trees + participating trees, deduped.
  const communityTrees = useMemo(() => {
    const byId = new Map<string, Lifetree>();
    domainTrees.forEach(t => byId.set(t.id, t));
    participatingTrees.forEach(t => byId.set(t.id, t));
    (currentUserId ? secretTrees : []).forEach(t => byId.set(t.id, t));
    return Array.from(byId.values());
  }, [domainTrees, participatingTrees, secretTrees, currentUserId]);

  const handleToggleGuardian = async (tree: Lifetree) => {
    if (!canCareForTree(currentUserId)) { showAlert('err_signin_guard'); return; }
    const join = !guardedTreeIds.has(tree.id);
    setTogglingId(tree.id);
    try {
      await (join ? graphStore.link(currentUserId, 'guardian', tree.id) : graphStore.unlink(currentUserId, 'guardian', tree.id));
      setGuardedTreeIds(prev => {
        const next = new Set(prev);
        if (join) next.add(tree.id); else next.delete(tree.id);
        return next;
      });
    } catch (e) {
      console.error(e);
      showAlert('err_guardianship');
    }
    setTogglingId(null);
  };

  return { linkedTrees, domainTrees, firstTree, communityTrees, guardedTreeIds, togglingId, handleToggleGuardian };
};
