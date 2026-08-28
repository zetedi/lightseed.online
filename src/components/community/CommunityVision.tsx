import React, { useState, useEffect } from 'react';
import { showAlert, showConfirm } from '../ui/Dialog';
import { Icons } from '../ui/Icons';
import { MahameruAvatar } from '../ui/MahameruAvatar';
import { Community, Lifetree } from '../../types';
import { ownMergeUid } from '../../domain/pulseVisibility';
import { DOMAIN_CHALLENGE_LABEL, isDomainVerified } from '../../domain/domainVerification';
import { getTreesByDomain, getPulsesByTreeId, updateCommunity, startDomainVerification, checkDomainVerification, type DomainChallengeRecord } from '../../services/firebase';
import { isCanonicallySealed, verifyBlockSeal, type ChainBlock } from '../../domain/chain';
import { normalizePlaceOfRecord } from '../../domain/communityDoor';
import { setTokenisationEnabled } from '../../domain/tokenisation';
import { VisionSection } from '../sections/VisionSection';
import { useLanguage } from '../../contexts/LanguageContext';
import { spokenLine } from '../../utils/translations';

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
    const { t } = useLanguage();
  // The chain seal ("big red stamp") — mirrors community.chainLocked. Sealing is one-way for owners.
  const [chainSealed, setChainSealed] = useState(!!community.chainLocked);
  const [isSealing, setIsSealing] = useState(false);
  const [sealStatus, setSealStatus] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ sealed: number; intact: number; legacy: number; trees: number } | null>(null);

  // The tokenisation toggle — mirrors community.tokenisationEnabled (the AI-token economy).
  const [tokenisationOn, setTokenisationOn] = useState(!!community.tokenisationEnabled);
  const [isTogglingTokens, setIsTogglingTokens] = useState(false);

  // The commons toggle — mirrors community.reflectsPublic. Every domain community chooses;
  // no hostname inherits reflection.
  const [reflectsOn, setReflectsOn] = useState(!!community.reflectsPublic);
  const [isTogglingReflect, setIsTogglingReflect] = useState(false);
  const hasDomain = !!community.domain;

  // The name, as drafted — the being's own word for itself, keeper-editable like the address.
  const [nameDraft, setNameDraft] = useState(community.name || '');
  const [nameSaving, setNameSaving] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- re-keys the draft when the profile switches communities
  useEffect(() => { setNameDraft(community.name || ''); }, [community.id, community.name]);
  const handleSaveName = async () => {
    const name = nameDraft.trim();
    if (!name || name === community.name) return;
    setNameSaving(true);
    try {
      await updateCommunity(community.id, { name });
      onUpdate?.({ name });
    } catch (e: unknown) { showAlert((e as Error)?.message || 'err_action'); }
    setNameSaving(false);
  };

  // The address, as drafted — keyed to the community so switching profiles never carries
  // one circle's domain onto another.
  const [domainDraft, setDomainDraft] = useState(community.domain || '');
  const [domainSaving, setDomainSaving] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- re-keys the draft when the profile switches communities; a render-time derive would fight the user's typing
  useEffect(() => { setDomainDraft(community.domain || ''); }, [community.id, community.domain]);
  const handleSaveDomain = async () => {
    const home = normalizePlaceOfRecord(domainDraft);
    if (!home) { showAlert('place_of_record_invalid'); return; }
    if (!(await showConfirm(spokenLine('community_domain_confirm', { name: community.name, domain: home }), { title: 'community_domain', confirmText: 'save' }))) return;
    setDomainSaving(true);
    try {
      await updateCommunity(community.id, { domain: home });
      onUpdate?.({ domain: home });
      setDomainDraft(home);
    } catch (e: unknown) { showAlert((e as Error)?.message || 'err_action'); }
    setDomainSaving(false);
  };

  // Domain verification (domain/domainVerification): the server mints the challenge, the
  // keeper plants the TXT record at their DNS host, the server OBSERVES it. The badge is
  // derived, never stored client-side — it falls silent the moment the domain changes.
  const domainVerified = isDomainVerified(community);
  const [challenge, setChallenge] = useState<DomainChallengeRecord | null>(null);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const verifyError = (e: unknown): string => {
    const m = String((e as Error)?.message || '');
    if (m.includes('no_domain')) return 'domain_verify_no_domain';
    if (m.includes('no_challenge') || m.includes('challenge_used') || m.includes('challenge_expired')) return 'domain_verify_expired';
    if (m.includes('domain_changed')) return 'domain_verify_changed';
    if (m.includes('txt_not_found')) return 'domain_verify_txt_missing';
    if (m.includes('txt_mismatch')) return 'domain_verify_txt_mismatch';
    return m || 'err_action';
  };
  const handleStartVerification = async () => {
    setVerifyBusy(true);
    try { setChallenge(await startDomainVerification(community.id)); }
    catch (e: unknown) { showAlert(verifyError(e)); }
    setVerifyBusy(false);
  };
  const handleCheckVerification = async () => {
    setVerifyBusy(true);
    try {
      const res = await checkDomainVerification(community.id);
      onUpdate?.({ domainVerification: { domain: res.domain, method: 'dns_txt' } });
      setChallenge(null);
      showAlert(spokenLine('domain_verify_success', { domain: res.domain }));
    } catch (e: unknown) { showAlert(verifyError(e)); }
    setVerifyBusy(false);
  };

  // The strict-scope toggle — mirrors community.strictScope. Only bites while scoped (reflect off).
  const [strictOn, setStrictOn] = useState(!!community.strictScope);
  const [isTogglingStrict, setIsTogglingStrict] = useState(false);
  // The seed-cradle toggle — mirrors community.seedCradle (the hybrid shape's flag).
  const [cradleOn, setCradleOn] = useState(!!community.seedCradle);
  const [isTogglingCradle, setIsTogglingCradle] = useState(false);

  // Keep the mirrors in sync whenever the community prop changes (e.g. after refresh).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- prop→state sync of optimistic toggles; deriving would lose the optimistic flips made while a save is in flight
    setChainSealed(!!community.chainLocked);
    setTokenisationOn(!!community.tokenisationEnabled);
    setReflectsOn(!!community.reflectsPublic);
    setStrictOn(!!community.strictScope);
    setCradleOn(!!community.seedCradle);
  }, [community.chainLocked, community.tokenisationEnabled, community.reflectsPublic, community.strictScope, community.seedCradle]);

  // The chain seal ("big red stamp", About → Vision). Sealing persists community.chainLocked so new
  // blocks are hashed with the canonical, reproducible scheme (src/domain/chain). When this is the
  // active node, App re-syncs the in-memory lock from the flag (onUpdate → hostCommunity → the effect
  // that calls setChainLocked). One-way for owners; only a super-admin can unseal (a testing escape).
  const handleToggleSeal = async (next: boolean) => {
    const confirmed = next
      ? await showConfirm(
          'Seal this chain? From now on, every new block this node mints is sealed with the canonical, reproducible hash, so anyone can verify the chain end to end. Blocks minted before now keep their original hashes. This is a commitment.',
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

  const handleToggleReflect = async (next: boolean) => {
    setIsTogglingReflect(true);
    setReflectsOn(next); // optimistic
    try {
      await updateCommunity(community.id, { reflectsPublic: next });
      onUpdate?.({ reflectsPublic: next });
    } catch (e) {
      console.error(e);
      setReflectsOn(!next); // revert on failure
    }
    setIsTogglingReflect(false);
  };

  const handleToggleCradle = async (next: boolean) => {
    setIsTogglingCradle(true);
    setCradleOn(next); // optimistic
    try {
      await updateCommunity(community.id, { seedCradle: next });
      onUpdate?.({ seedCradle: next });
    } catch (e) {
      console.error(e);
      setCradleOn(!next); // revert on failure
    }
    setIsTogglingCradle(false);
  };

  const handleToggleStrict = async (next: boolean) => {
    setIsTogglingStrict(true);
    setStrictOn(next); // optimistic
    try {
      await updateCommunity(community.id, { strictScope: next });
      onUpdate?.({ strictScope: next });
    } catch (e) {
      console.error(e);
      setStrictOn(!next); // revert on failure
    }
    setIsTogglingStrict(false);
  };

  // Verify the node's sealed blocks: recompute each canonically-sealed block's hash and confirm it
  // still matches. Per-block (tamper-evident) rather than chain-walking, so off-chain cares don't
  // cause false failures; legacy blocks predate the scheme and are counted separately, not failed.
  const handleVerify = async () => {
    setIsVerifying(true);
    setVerifyResult(null);
    try {
      const trees = linkedTrees.length ? linkedTrees : await getTreesByDomain(community.domain, ownMergeUid(currentUserId, community));
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
                <p className="text-sm font-bold text-emerald-900">{t('chain_sealed')}</p>
                <p className="mt-0.5 text-sm text-emerald-800/80">{t('chain_sealed_note')}</p>
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
                          <span className="text-emerald-800/70">No sealed blocks yet; the next pulse this node mints will be the first.{verifyResult.legacy > 0 ? ` ${verifyResult.legacy} earlier block${verifyResult.legacy === 1 ? '' : 's'} predate the seal.` : ''}</span>
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
                <p className="text-sm font-bold text-slate-800">{t('chain_seal')}</p>
                <p className="mt-0.5 text-sm text-slate-500">{t('chain_seal_note')}</p>
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
              <p className="mt-0.5 text-sm text-slate-500">{t('tokens_note')}</p>
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

      {/* THE ADDRESS — the community's domain, keeper-editable (ring 2026-08-15; the rules
          already admitted keepers to every field but lid/loveCount/ownerId — this gives the
          field a face). Validated by the same law as the place-of-record mend; and honest
          about what it does NOT do: beings already stamped with the old domain keep their
          stamps (their re-homing is the staff mend / a migration, not a side effect). */}
      {canEdit && (
        <div className="mt-8 border-t border-slate-100 pt-6">
          {/* THE NAME — shown everywhere exactly as this property says it (the tab title
              included), so the keeper edits it here, at the source. */}
          <div className="mb-2 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500"><Icons.Users /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-800">{t('community_name')}</p>
              <p className="mt-0.5 text-sm text-slate-500">{t('community_name_hint')}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  dir="auto"
                  value={nameDraft}
                  onChange={e => setNameDraft(e.target.value)}
                  placeholder={t('community_name_ph')}
                  className="w-64 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-emerald-400"
                />
                <button
                  onClick={handleSaveName}
                  disabled={nameSaving || !nameDraft.trim() || nameDraft.trim() === community.name}
                  className="rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50">
                  {nameSaving ? t('saving') : t('save')}
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500"><Icons.Loc /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-800">{t('community_domain')}</p>
              <p className="mt-0.5 text-sm text-slate-500">{t('community_domain_hint')}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  dir="ltr"
                  value={domainDraft}
                  onChange={e => setDomainDraft(e.target.value)}
                  placeholder={t('domain_ph')}
                  className="w-64 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-sm outline-none focus:border-emerald-400"
                />
                <button
                  onClick={handleSaveDomain}
                  disabled={domainSaving || normalizePlaceOfRecord(domainDraft) === (community.domain || null)}
                  className="rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50">
                  {domainSaving ? t('saving') : t('save')}
                </button>
              </div>
              {/* Verification — server-observed control of the anchor, never reputation. */}
              <div className="mt-3">
                {domainVerified ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700">✓ {t('domain_verified')}</span>
                    <button onClick={handleStartVerification} disabled={verifyBusy}
                      className="text-[11px] font-bold text-slate-400 underline-offset-2 hover:text-emerald-700 hover:underline disabled:opacity-50">
                      {t('domain_reverify')}
                    </button>
                  </div>
                ) : !challenge && (
                  <button onClick={handleStartVerification} disabled={verifyBusy || !hasDomain}
                    className="rounded-full border border-emerald-200 bg-white px-3.5 py-1.5 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-50">
                    {verifyBusy ? '…' : t('domain_verify_start')}
                  </button>
                )}
                {challenge && (
                  <div className="mt-2 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
                    <p className="text-xs leading-relaxed text-slate-600">{t('domain_verify_hint')}</p>
                    {/* The four fields as a DNS dashboard asks for them — the Name is the bare
                        host label; the provider appends the domain itself. */}
                    <div className="mt-2 space-y-1.5 text-[11px]" dir="ltr">
                      {([
                        [t('domain_verify_dns_type'), 'TXT', false],
                        [t('domain_verify_dns_name'), DOMAIN_CHALLENGE_LABEL, true],
                        [t('domain_verify_dns_value'), challenge.recordValue, true],
                        [t('domain_verify_dns_ttl'), '300', false],
                      ] as const).map(([label, value, copyable]) => (
                        <div key={label} className="flex flex-wrap items-center gap-2">
                          <span className="w-24 shrink-0 font-bold uppercase tracking-wide text-slate-400">{label}</span>
                          <span className="break-all rounded border border-slate-200 bg-white px-2 py-1 font-mono text-slate-700">{value}</span>
                          {copyable && (
                            <button onClick={() => navigator.clipboard.writeText(value).catch(() => {})}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-50">
                              {t('copy')}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] italic leading-relaxed text-slate-500">
                      {t('domain_verify_name_note').replace('{full}', challenge.recordName)}
                    </p>
                    <p className="mt-1 text-[11px] italic leading-relaxed text-slate-500">
                      {t('domain_verify_resume')}
                    </p>
                    <button onClick={handleCheckVerification} disabled={verifyBusy}
                      className="mt-2 rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50">
                      {verifyBusy ? '…' : t('domain_verify_check')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Commons toggle — does this domain community reflect its authority backend's public
          forest, or show only its own domain? A community choice (Indra's net), for Nodes and
          Hosts alike. Reflects PUBLIC content only; sensitive-to-light content stays local. */}
      {canEdit && hasDomain && (
        <div className="mt-8 border-t border-slate-100 pt-6">
          <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500"><Icons.Globe /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-800">{t('reflect_commons')}</p>
              <p className="mt-0.5 text-sm text-slate-500">Show this backend's public forest here, a window onto every community it holds. While off, {community.domain} shows only its own trees and pulses. Either way, node- and community-only content stays private.</p>
            </div>
            <button
              onClick={() => handleToggleReflect(!reflectsOn)}
              disabled={isTogglingReflect}
              role="switch"
              aria-checked={reflectsOn}
              title={reflectsOn ? 'Reflecting the commons' : 'Scoped to this domain'}
              className={`relative mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${reflectsOn ? 'bg-emerald-600' : 'bg-slate-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${reflectsOn ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Strict scope — only offered while scoped (reflect off). Hides even the keeper's own
              off-domain trees, for a clean "this place only" forest. */}
          {!reflectsOn && (
            <div className="mt-2 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500"><Icons.Eye /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-800">{t('strict_scope')}</p>
                <p className="mt-0.5 text-sm text-slate-500">Show only {community.domain}'s own trees: hide even your own trees from other domains, for a clean single-place forest. No effect while reflecting the commons.</p>
              </div>
              <button
                onClick={() => handleToggleStrict(!strictOn)}
                disabled={isTogglingStrict}
                role="switch"
                aria-checked={strictOn}
                title={strictOn ? 'Strict: this place only' : 'Your own trees still show'}
                className={`relative mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${strictOn ? 'bg-emerald-600' : 'bg-slate-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${strictOn ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          )}

          {/* Seed cradle — the hybrid shape: the living web lives on a subdomain, the domain
              itself is the community's own site, and the portal wears a corner door home. */}
          {(
            <div className="mt-2 flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500"><Icons.Globe /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-800">{t('seed_cradle')}</p>
                <p className="mt-0.5 text-sm text-slate-500">{t('seed_cradle_hint')}</p>
              </div>
              <button
                onClick={() => handleToggleCradle(!cradleOn)}
                disabled={isTogglingCradle}
                role="switch"
                aria-checked={cradleOn}
                className={`relative mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${cradleOn ? 'bg-emerald-600' : 'bg-slate-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${cradleOn ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          )}
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
      placeholder={t('community_vision_ph')}
      extras={extras}
    />
  );
};
