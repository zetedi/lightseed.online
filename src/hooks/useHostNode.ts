import { useState, useEffect } from 'react';
import type { Community, DataAuthority } from '../types';
import { ensureGenesis, syncInitiatesMirror, getCommunityByDomain, getDataAuthority } from '../services/firebase';
import { isSeedShellHost } from './useConfig';
import { dataDomainFor } from '../domain/communityDoor';
import { setChainLocked } from '../domain/chain';
import { setTokenisationEnabled } from '../domain/tokenisation';
import { charter } from '../config/charter';

// THE GROUND THE SHELL STANDS ON (ring 2026-09-16, lifted out of App.tsx unchanged). The
// host community at this hostname and the backend's custody declaration, resolved once per
// session; the lightseed community as the About fallback; the superadmin's "community view"
// (impersonation) and the seed/landing switch; and the two flags a node's community sets on
// the whole shell (the chain lock, tokenisation). From these the ACTIVE community and the
// data domain every scoped read uses.
export function useHostNode(params: { uid: string | undefined; isSuperAdmin: boolean; selectedCommunity: Community | null }) {
  const { uid, isSuperAdmin, selectedCommunity } = params;
  const [hostCommunity, setHostCommunity] = useState<Community | null>(null);
  // The backend's public custody declaration. Until it resolves and matches a hosting
  // community, the crown stays "About" — sovereignty is never inferred from a hostname.
  const [dataAuthority, setDataAuthority] = useState<DataAuthority | null>(null);
  // Custom-landing domains: false = the organisation's own page fills the screen;
  // true = the visitor stepped through the corner seed-logo into the full app.
  const [seedView, setSeedView] = useState(false);
  // Outside the seed shell, hold the shell until we know whether this domain has a custom
  // landing — otherwise the seed flashes first and then jumps to the organisation's page.
  const [hostResolved, setHostResolved] = useState(() => isSeedShellHost(window.location.hostname));
  // The host community's answer has arrived (found or not) — the feed scopes only after this,
  // on every host (hostResolved above is the seed shell's paint gate, true from the start there).
  const [hostCommunityResolved, setHostCommunityResolved] = useState(false);
  // The lightseed community is the default "About" page when this node has none of its own.
  const [defaultCommunity, setDefaultCommunity] = useState<Community | null>(null);
  // Superadmin "switch to community view" — when set, the whole shell (theme, logo,
  // name, About page) renders as if this were the host community. Cleared via "Exit community".
  const [impersonatedCommunity, setImpersonatedCommunity] = useState<Community | null>(null);

  const activeCommunity = impersonatedCommunity || hostCommunity;
  const isDevHost = /localhost|127\.0\.0\.1|^192\.168\.|\.local$/.test(window.location.hostname);
  // The App-level scope shared by the home carousel, Light Houses and beds. Feed content
  // derives the same law inside useForestFeed because it also needs the raw domain for strict
  // owner-tree behavior.
  const activeDataDomain = (isDevHost && isSuperAdmin)
    ? undefined
    : dataDomainFor(activeCommunity?.domain || window.location.hostname, activeCommunity?.reflectsPublic);

  // Genesis + the host community depend only on the signed-in user, not the tab — so run them
  // once per session (and on login), not on every tab/view switch as they used to.
  useEffect(() => {
    ensureGenesis();
    syncInitiatesMirror(); // superadmin-gated inside; keeps initiates/{uid} true to the git ledger
    Promise.all([
      getCommunityByDomain(window.location.hostname).catch(() => null),
      getDataAuthority().catch(() => null),
    ]).then(([community, authority]) => {
      setHostCommunity(community);
      setDataAuthority(authority);
    }).finally(() => { setHostResolved(true); setHostCommunityResolved(true); });
  }, [uid]);

  // Load the lightseed community once as the default About page fallback.
  useEffect(() => {
    getCommunityByDomain(charter.domain).then(setDefaultCommunity).catch(() => {});
  }, []);

  // Sync the chain-lock flag from the node's community ("big red stamp"). Off until a node sets it.
  useEffect(() => {
    setChainLocked(!!(impersonatedCommunity || hostCommunity)?.chainLocked);
  }, [impersonatedCommunity, hostCommunity]);

  // The browser tab wears the community's name AS ITS PROPERTIES SAY IT — the community
  // being viewed first, then the one driving the whole site (impersonated/host).
  useEffect(() => {
    const c = selectedCommunity || impersonatedCommunity || hostCommunity;
    document.title = c?.name ? c.name : '.seed: Lightseed, life recognising life';
  }, [selectedCommunity, impersonatedCommunity, hostCommunity]);

  // Sync the tokenisation flag (AI-token economy) from the node's community. Off until enabled.
  useEffect(() => {
    setTokenisationEnabled(!!(impersonatedCommunity || hostCommunity)?.tokenisationEnabled);
  }, [impersonatedCommunity, hostCommunity]);

  return {
    hostCommunity, setHostCommunity, dataAuthority, seedView, setSeedView,
    hostResolved, hostCommunityResolved, defaultCommunity, setDefaultCommunity,
    impersonatedCommunity, setImpersonatedCommunity,
    activeCommunity, activeDataDomain,
  };
}
export type HostNode = ReturnType<typeof useHostNode>;
