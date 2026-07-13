import React, { useState, useEffect } from 'react';
import { showConfirm } from '../ui/Dialog';
import { Icons } from '../ui/Icons';
import { MahameruAvatar } from '../ui/MahameruAvatar';
import { Community, Lifetree } from '../../types';
import { getTreesByDomain, getPulsesByTreeId, updateCommunity } from '../../services/firebase';
import { isCanonicallySealed, verifyBlockSeal, type ChainBlock } from '../../domain/chain';
import { setTokenisationEnabled } from '../../domain/tokenisation';
import { VisionSection } from '../sections/VisionSection';

interface CommunityVisionProps {
  community: Community;
  canEdit: boolean;
  isSuperAdmin: boolean;
  currentUserId?: string;
  // The featured (earliest) domain tree — its latest hash is shown under the seal.
  firstTree: Lifetree | null;
  // Trees already loaded by the shell; verification reuses them instead of refetching.
  linkedTrees: Lifetree[];
  // The vision draft lives in the shell: it is persisted by the shared Save (which also
  // runs from the Appearance tab), so this tab only edits it.
  editVision: string;
  onVisionChange: (value: string) => void;
  onSave: () => void;
  isSaving: boolean;
  saveDisabled: boolean;
  status: string | null;
  onUpdate?: (updates: Partial<Community>) => void;
}

// Vision tab — a community binding over the entity-generic VisionSection: the vision editor
// itself is shared; the chain seal and tokenisation toggle are node-level commitments
// (community.chainLocked / community.tokenisationEnabled), so they stay here and ride in
// through the section's `extras` slot.
export const CommunityVision: React.FC<CommunityVisionProps> = ({
  community,
  canEdit,
  isSuperAdmin,
  currentUserId,
  firstTree,
  linkedTrees,
  editVision,
  onVisionChange,
  onSave,
  isSaving,
  saveDisabled,
  status,
  onUpdate,
}) => {
  // The chain seal ("big red stamp") — mirrors community.chainLocked. Sealing is one-way for owners.
  const [chainSealed, setChainSealed] = useState(!!community.chainLocked);
  const [isSealing, setIsSealing] = useState(false);
  const [sealStatus, setSealStatus] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ sealed: number; intact: number; legacy: number; trees: number } | null>(null);

  // The tokenisation toggle — mirrors community.tokenisationEnabled (the AI-token economy).
  const [tokenisationOn, setTokenisationOn] = useState(!!community.tokenisationEnabled);
  const [isTogglingTokens, setIsTogglingTokens] = useState(false);

  // Keep the mirrors in sync whenever the community prop changes (e.g. after refresh).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- prop→state sync of optimistic toggles; deriving would lose the optimistic flips made while a save is in flight
    setChainSealed(!!community.chainLocked);
    setTokenisationOn(!!community.tokenisationEnabled);
  }, [community.chainLocked, community.tokenisationEnabled]);

  // The chain seal ("big red stamp", About → Vision). Sealing persists community.chainLocked so new
  // blocks are hashed with the canonical, reproducible scheme (src/domain/chain). When this is the
  // active node, App re-syncs the in-memory lock from the flag (onUpdate → hostCommunity → the effect
  // that calls setChainLocked). One-way for owners; only a super-admin can unseal (a testing escape).
  const handleToggleSeal = async (next: boolean) => {
    const confirmed = next
      ? await showConfirm(
          'Seal this chain? From now on, every new block this node mints is sealed with the canonical, reproducible hash — so anyone can verify the chain end to end. Blocks minted before now keep their original hashes. This is a commitment.',
          { title: 'Seal the chain', confirmText: 'Seal it' },
        )
      : await showConfirm(
          'Unseal this chain? New blocks return to the legacy hash and can no longer be verified end to end. Blocks already sealed stay sealed.',
          { title: 'Unseal the chain', confirmText: 'Unseal', danger: true },
        );
    if (!confirmed) return;
    setIsSealing(true);
    setSealStatus(null);
    try {
      await updateCommunity(community.id, { chainLocked: next });
      setChainSealed(next);
      onUpdate?.({ chainLocked: next });
      setSealStatus(next ? 'Chain sealed.' : 'Chain unsealed.');
      setTimeout(() => setSealStatus(null), 3000);
    } catch (e) {
      console.error(e);
      setSealStatus('Could not update the seal. Please try again.');
    }
    setIsSealing(false);
  };

  const handleToggleTokenisation = async (next: boolean) => {
    setIsTogglingTokens(true);
    setTokenisationOn(next); // optimistic
    try {
      await updateCommunity(community.id, { tokenisationEnabled: next });
      setTokenisationEnabled(next); // sync the in-memory flag so the UI reacts immediately
      onUpdate?.({ tokenisationEnabled: next });
    } catch (e) {
      console.error(e);
      setTokenisationOn(!next); // revert on failure
    }
    setIsTogglingTokens(false);
  };

  // Verify the node's sealed blocks: recompute each canonically-sealed block's hash and confirm it
  // still matches. Per-block (tamper-evident) rather than chain-walking, so off-chain tends don't
  // cause false failures; legacy blocks predate the scheme and are counted separately, not failed.
  const handleVerify = async () => {
    setIsVerifying(true);
    setVerifyResult(null);
    try {
      const trees = linkedTrees.length ? linkedTrees : await getTreesByDomain(community.domain, currentUserId);
      let sealed = 0, intact = 0, legacy = 0;
      for (const tree of trees) {
        let pulses: ChainBlock[] = [];
        try { pulses = await getPulsesByTreeId(tree.id) as unknown as ChainBlock[]; } catch { continue; } // skip trees this viewer can't read
        for (const p of pulses) {
          if (isCanonicallySealed(p)) { sealed++; if (await verifyBlockSeal(p)) intact++; }
          else legacy++;
        }
      }
      setVerifyResult({ sealed, intact, legacy, trees: trees.length });
    } catch (e) {
      console.error(e);
      setSealStatus('Could not verify right now.');
    }
    setIsVerifying(false);
  };

  // Node-level commitments injected under the shared vision — the chain seal and the
  // tokenisation toggle are community/node-only, so they live here, not in the section.
  const extras = (
    <>
      {/* The chain seal — this node's commitment to a verifiable chain. Sealed is a public
          mark of integrity (shown to all); sealing is the owner's one-way "big red stamp". */}
      {(chainSealed || canEdit) && (
        <div className="mt-8 border-t border-slate-100 pt-6">
          {chainSealed ? (
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-emerald-300"><Icons.ShieldCheck /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-emerald-900">Chain sealed</p>
                <p className="mt-0.5 text-sm text-emerald-800/80">Every new block this node mints is sealed with the canonical, reproducible hash — so its content can be verified against its hash.</p>
                {firstTree?.latestHash && (
                  <p className="mt-1 break-all font-mono text-xs text-emerald-700/60">head {firstTree.latestHash.slice(0, 16)}…</p>
                )}
                {canEdit && (
                  <div className="mt-3">
                    <button onClick={handleVerify} disabled={isVerifying} className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-white px-4 py-2 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50">
                      <Icons.ShieldCheck /> {isVerifying ? 'Verifying…' : 'Verify sealed blocks'}
                    </button>
                    {verifyResult && (
                      <p className="mt-2 text-xs">
                        {verifyResult.sealed === 0 ? (
                          <span className="text-emerald-800/70">No sealed blocks yet — the next pulse this node mints will be the first.{verifyResult.legacy > 0 ? ` ${verifyResult.legacy} earlier block${verifyResult.legacy === 1 ? '' : 's'} predate the seal.` : ''}</span>
                        ) : verifyResult.intact === verifyResult.sealed ? (
                          <span className="font-semibold text-emerald-700">✓ {verifyResult.sealed} sealed block{verifyResult.sealed === 1 ? '' : 's'} intact across {verifyResult.trees} tree{verifyResult.trees === 1 ? '' : 's'}.{verifyResult.legacy > 0 ? ` (${verifyResult.legacy} legacy, pre-seal.)` : ''}</span>
                        ) : (
                          <span className="font-bold text-red-600">⚠ {verifyResult.sealed - verifyResult.intact} of {verifyResult.sealed} sealed block{verifyResult.sealed === 1 ? '' : 's'} failed verification.</span>
                        )}
                      </p>
                    )}
                  </div>
                )}
                <div className="mt-2 flex items-center gap-3">
                  {isSuperAdmin && (
                    <button onClick={() => handleToggleSeal(false)} disabled={isSealing} className="text-xs font-semibold text-emerald-700/70 underline underline-offset-2 hover:text-red-600 disabled:opacity-50">
                      {isSealing ? 'Working…' : 'Unseal (admin)'}
                    </button>
                  )}
                  {sealStatus && <span className="text-xs text-slate-500">{sealStatus}</span>}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500"><Icons.Stamp /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-800">Seal the chain</p>
                <p className="mt-0.5 text-sm text-slate-500">Commit this node to a verifiable chain: from now on every new block carries the canonical, reproducible hash, so anyone can check it. Blocks minted before now keep their original hashes. A one-way step.</p>
                <div className="mt-3 flex items-center gap-3">
                  <button onClick={() => handleToggleSeal(true)} disabled={isSealing} className="inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-600/20 transition-all hover:bg-red-700 active:scale-95 disabled:opacity-50">
                    <Icons.Stamp /> {isSealing ? 'Sealing…' : 'Seal this chain'}
                  </button>
                  {sealStatus && <span className="text-sm text-slate-500">{sealStatus}</span>}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tokenisation toggle — turn the AI-token ("Attention-Energy") economy on/off for
          this node, the same way the chain seal is flipped. Owner/admin only. */}
      {canEdit && (
        <div className="mt-8 border-t border-slate-100 pt-6">
          <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <MahameruAvatar size={36} className="mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-800">AI-token economy</p>
              <p className="mt-0.5 text-sm text-slate-500">Turn on “Attention-Energy” tokens for this node — trees earn tokens and spend them on deep AI. While off, AI stays free and the token balance/cost UI is hidden.</p>
            </div>
            <button
              onClick={() => handleToggleTokenisation(!tokenisationOn)}
              disabled={isTogglingTokens}
              role="switch"
              aria-checked={tokenisationOn}
              title={tokenisationOn ? 'Tokenisation on' : 'Tokenisation off'}
              className={`relative mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${tokenisationOn ? 'bg-emerald-600' : 'bg-slate-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${tokenisationOn ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>
      )}
    </>
  );

  return (
    <VisionSection
      canEdit={canEdit}
      vision={community.vision}
      editValue={editVision}
      onChange={onVisionChange}
      onSave={onSave}
      isSaving={isSaving}
      saveDisabled={saveDisabled}
      status={status}
      title="Vision"
      sub="What this community is growing towards."
      placeholder="Share your community's vision..."
      extras={extras}
    />
  );
};
