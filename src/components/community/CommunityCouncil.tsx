import React, { useState, useEffect, useCallback } from 'react';
import { SuperDot } from '../ui/SuperDot';
import { Icons } from '../ui/Icons';
import { showAlert, showConfirm } from '../ui/Dialog';
import { useLanguage } from '../../contexts/LanguageContext';
import { SectionTitle } from '../ui/SectionTitle';
import { Community } from '../../types';
import { createDecision, getDecisions, raiseConcern, resumeDecision, withdrawDecision, recordPosition, discernDecision, setDecisionVisibility, deleteDecision, signDecision, getDecisionSignatureState } from '../../services/firebase';
import { hasSigningKey } from '../../services/keys';
import { SigningKeyModal } from '../modals/SigningKeyModal';
import { DECISION_NATURES, decisionStatusLabels, consensusStanceLabels, votesRequired, type Decision, type DecisionNature, type DecisionMode, type ConsensusStance } from '../../domain/decision';
import { councilView } from '../../domain/views/council';
import type { PulseVisibility } from '../../domain/pulse';

// The crypto standing of a decision — how many signatures verify against its frozen identity, whether a
// claimed 'passed' is honest, and who has signed. Re-run from the raw signatures so the seal is PROVEN.
interface SigState { verifiedCount: number; valid: boolean; signedUids: Set<string> }

interface CommunityCouncilProps {
  community: Community;
  canEdit: boolean;
  currentUserId?: string;
  // The visibility levels this viewer may query at community scope.
  communityLevels: PulseVisibility[];
}

// Council — governance decisions: proposing, voting (threshold) and Quaker consensus.
export const CommunityCouncil: React.FC<CommunityCouncilProps> = ({ community, canEdit, currentUserId, communityLevels }) => {
  const { t } = useLanguage();

  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [decTitle, setDecTitle] = useState('');
  const [decNature, setDecNature] = useState<DecisionNature>('intention');
  const [decBody, setDecBody] = useState('');
  const [decMode, setDecMode] = useState<DecisionMode>('threshold');
  const [proposing, setProposing] = useState(false);
  const [votingId, setVotingId] = useState<string | null>(null);
  // The crypto standing of each decision (id → verified signatures), re-run from the raw signatures.
  const [sigStates, setSigStates] = useState<Record<string, SigState>>({});
  // Signing-key setup: if the being has no device key yet, we open the modal and resume the pending
  // signing action once a key exists (mirrors CovenantProfile's onSignClick → doSign flow).
  const [showKey, setShowKey] = useState(false);
  const [pendingSign, setPendingSign] = useState<(() => Promise<void>) | null>(null);
  const [phrase, setPhrase] = useState<string[] | null>(null);

  const refreshDecisions = useCallback(() => {
    getDecisions(community.id, communityLevels).then(async (ds) => {
      setDecisions(ds);
      // Re-verify each decision's signatures (best-effort; a failure just leaves it unproven).
      const entries = await Promise.all(ds.map(async (d) => {
        try {
          const s = await getDecisionSignatureState(d);
          return [d.id, { verifiedCount: s.verifiedCount, valid: s.valid, signedUids: new Set(s.signatures.map(x => x.uid)) }] as const;
        } catch { return [d.id, { verifiedCount: 0, valid: true, signedUids: new Set<string>() }] as const; }
      }));
      setSigStates(Object.fromEntries(entries));
    }).catch(() => {});
  }, [community.id, communityLevels]);
  useEffect(() => { refreshDecisions(); }, [refreshDecisions]);

  // Run a signing action, routing through SigningKeyModal first if the being has no device key yet.
  // On return, surface a freshly-born recovery phrase once, and refresh the crypto standing.
  const withSigningKey = useCallback(async (id: string, run: () => Promise<void>) => {
    if (!currentUserId) { showAlert('Sign in to add your voice.'); return; }
    if (!(await hasSigningKey(currentUserId))) { setPendingSign(() => run); setShowKey(true); return; }
    setVotingId(id);
    try { await run(); }
    catch (e: any) { showAlert(e?.message || 'Could not record your voice.'); }
    setVotingId(null);
  }, [currentUserId]);

  // Circle ↔ public square: decisions are community-visible by default; showing one to the
  // public is a deliberate act (proposer / keeper / staff — mirrored in the rules).
  const handleFlipVisibility = async (id: string, currentlyPublic: boolean) => {
    try { await setDecisionVisibility(id, currentlyPublic ? 'community' : 'public'); refreshDecisions(); }
    catch (e: any) { showAlert(e?.message || 'Could not change the visibility.'); }
  };

  const handleDeleteDecision = async (id: string, title: string) => {
    if (!(await showConfirm(`Remove the decision "${title}" from the record entirely? This cannot be undone.`, { title: 'Delete decision', confirmText: 'Delete', danger: true }))) return;
    try { await deleteDecision(id); refreshDecisions(); }
    catch (e: any) { showAlert(e?.message || 'Could not delete the decision.'); }
  };

  const handlePropose = async () => {
    if (!currentUserId || !decTitle.trim()) return;
    setProposing(true);
    try {
      await createDecision(community, { nature: decNature, title: decTitle.trim(), body: decBody.trim(), proposedBy: currentUserId, mode: decMode });
      setDecTitle(''); setDecBody(''); setDecNature('intention');
      refreshDecisions();
    } catch (e: any) { showAlert(e?.message || 'Could not propose the decision.'); }
    setProposing(false);
  };

  // A threshold vote is now a SIGNATURE over the decision's frozen identity (Covenant, phase 3): it
  // signs, denormalises the uid onto votes[], and enacts by the VERIFIED quorum — routing through the
  // key modal if the being has no device key yet.
  const handleVote = (id: string) => withSigningKey(id, async () => {
    const res = await signDecision({ id });
    if (res.recoveryPhrase) setPhrase(res.recoveryPhrase); // a key was born mid-sign — surface it once
    if (res.outcome === 'listening') showAlert('This proposal is in listening — a concern was raised. It can continue once the concern is tended.');
    else if (res.outcome === 'enacted') showAlert(t('decision_enacted_toast'));
    refreshDecisions();
  });

  const handleRaiseConcern = async (id: string) => {
    if (!currentUserId) { showAlert('Sign in to raise a concern.'); return; }
    if (!(await showConfirm('Raise a concern? This pauses the proposal and opens a reflective listening — it does not reject it.', { title: 'Raise a concern', confirmText: 'Raise concern' }))) return;
    setVotingId(id);
    try { await raiseConcern(id, currentUserId); refreshDecisions(); }
    catch (e: any) { showAlert(e?.message || 'Could not raise the concern.'); }
    setVotingId(null);
  };

  const handleResume = async (id: string) => {
    setVotingId(id);
    try { await resumeDecision(id); refreshDecisions(); }
    catch (e: any) { showAlert(e?.message || 'Could not resume.'); }
    setVotingId(null);
  };

  const handleWithdraw = async (id: string) => {
    if (!(await showConfirm('Withdraw this proposal?', { title: 'Withdraw', confirmText: 'Withdraw', danger: true }))) return;
    setVotingId(id);
    try { await withdrawDecision(id); refreshDecisions(); }
    catch (e: any) { showAlert(e?.message || 'Could not withdraw.'); }
    setVotingId(null);
  };

  // --- Quaker consensus handlers ---
  // A 'unite' position is an affirmative SIGNATURE (position:'unite') — it signs the frozen identity and
  // records the uniting position, routing through the key modal if needed. stand_aside / block are NOT
  // signed (we never force-sign a block): they stay plain positions, recorded as before.
  const handlePosition = async (id: string, stance: ConsensusStance) => {
    if (!currentUserId) { showAlert('Sign in to take a position.'); return; }
    if (stance === 'unite') {
      await withSigningKey(id, async () => {
        const res = await signDecision({ id }, 'unite');
        if (res.recoveryPhrase) setPhrase(res.recoveryPhrase);
        refreshDecisions();
      });
      return;
    }
    let note: string | undefined;
    if (stance === 'block') {
      const reason = window.prompt('A block is a principled objection that halts unity. What is your concern?');
      if (reason === null) return; // cancelled
      note = reason.trim();
    }
    setVotingId(id);
    try {
      const outcome = await recordPosition(id, currentUserId, stance, note);
      if (outcome === 'closed') showAlert('This proposal is already settled.');
      refreshDecisions();
    } catch (e: any) { showAlert(e?.message || 'Could not record your position.'); }
    setVotingId(null);
  };

  const handleDiscern = async (id: string, outcome: 'passed' | 'rejected') => {
    const msg = outcome === 'passed'
      ? 'Discern that the meeting is in unity and adopt this proposal? A block would prevent this.'
      : 'Record that the meeting did not reach unity (not adopted)?';
    if (!(await showConfirm(msg, { title: outcome === 'passed' ? 'Sense of the meeting: unity' : 'Not in unity', confirmText: outcome === 'passed' ? 'Adopt' : 'Set aside', danger: outcome === 'rejected' }))) return;
    setVotingId(id);
    try { await discernDecision(id, outcome); refreshDecisions(); }
    catch (e: any) { showAlert(e?.message || 'Could not discern the sense of the meeting.'); }
    setVotingId(null);
  };

  return (
    <div>
      <SectionTitle title={t('council')} sub={t('council_sub')} />

      {currentUserId && (
        <div className="mb-8 space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
          <h4 className="text-sm font-bold text-slate-700">{t('propose_decision')}</h4>
          <input value={decTitle} onChange={e => setDecTitle(e.target.value)} placeholder={t('decision_title_ph')} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <label className="block space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-400">{t('decision_nature')}</span>
            <select value={decNature} onChange={e => setDecNature(e.target.value as DecisionNature)} className="h-11 w-full rounded-xl border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 sm:max-w-xs">
              {DECISION_NATURES.map(n => <option key={n.id} value={n.id}>{t(('nature_' + n.id) as any)} · {n.votes} {t('voices')}</option>)}
            </select>
          </label>
          <textarea value={decBody} onChange={e => setDecBody(e.target.value)} placeholder={t('decision_body_ph')} className="min-h-20 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase text-slate-400">How the circle decides</span>
            <div className="flex rounded-full border border-slate-200 bg-white p-0.5 text-xs font-bold w-full sm:max-w-md">
              <button type="button" onClick={() => setDecMode('threshold')} className={`flex-1 rounded-full px-3 py-1.5 transition-colors ${decMode === 'threshold' ? 'bg-emerald-600 text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}>Voices ({votesRequired(decNature)})</button>
              <button type="button" onClick={() => setDecMode('consensus')} className={`flex-1 rounded-full px-3 py-1.5 transition-colors ${decMode === 'consensus' ? 'bg-emerald-600 text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}>Consensus (Quaker)</button>
            </div>
            <p className="text-[11px] text-slate-500">{decMode === 'consensus' ? 'No counting — the meeting seeks unity. Each voice may unite, stand aside, or block; the clerk discerns the sense of the meeting.' : `Passes when ${votesRequired(decNature)} voice(s) unite. A concern opens a reflective pause.`}</p>
          </div>
          <button onClick={handlePropose} disabled={proposing || !decTitle.trim()} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">{proposing ? '…' : t('propose')}</button>
        </div>
      )}

      {decisions.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-400">{t('no_decisions')}</p>
      ) : (
        <div className="space-y-3">
          {councilView(decisions, currentUserId).map(d => {
            const consensus = d.mode === 'consensus';
            const open = !d.passed && !d.closed;
            const clerk = d.isProposer || !!canEdit;
            return (
              <div key={d.id} className={`rounded-2xl border p-4 ${d.passed ? 'border-emerald-200 bg-emerald-50/40' : (consensus && d.blocked) ? 'border-rose-200 bg-rose-50/40' : d.listening ? 'border-indigo-200 bg-indigo-50/40' : d.closed ? 'border-slate-200 bg-slate-50' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-800">{d.title}</h4>
                      {/* Circle/public standing + the clerk's controls. */}
                      {(() => {
                        const raw = decisions.find(x => x.id === d.id) as (Decision & { visibility?: string }) | undefined;
                        const isPublic = raw?.visibility === 'public';
                        return (
                          <>
                            {clerk ? (
                              <button
                                onClick={() => handleFlipVisibility(d.id, isPublic)}
                                title={isPublic ? 'Public — click to keep it in the circle' : 'Circle only — click to make it public'}
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase transition-colors ${isPublic ? 'bg-sky-600 text-white hover:bg-sky-500' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                              >
                                {isPublic ? 'Public' : 'Circle'}
                              </button>
                            ) : isPublic && (
                              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-700">Public</span>
                            )}
                            {canEdit && (
                              <button
                                onClick={() => handleDeleteDecision(d.id, d.title)}
                                title="Delete this decision"
                                aria-label="Delete this decision"
                                className="relative rounded-full px-1.5 py-0.5 text-[10px] font-bold text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
                              >
                                {currentUserId !== community.ownerId && !d.isProposer && <SuperDot />}
                                ✕
                              </button>
                            )}
                          </>
                        );
                      })()}
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-500">{t(('nature_' + d.nature) as any)}</span>
                      {consensus && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase text-sky-700">Consensus</span>}
                      {d.passed
                        ? <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">{t('passed')}</span>
                        : d.closed
                          ? <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">{decisionStatusLabels[d.status] || 'Closed'}</span>
                          : consensus
                            ? (d.blocked
                                ? <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase text-rose-700">Blocked</span>
                                : <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">In discernment</span>)
                            : d.listening
                              ? <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-700">Listening</span>
                              : <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-700">{t('decision_open')}</span>}
                    </div>
                    {d.body && <p className="mt-1 text-xs italic text-slate-500">{d.body}</p>}

                    {/* The seal PROVEN, not asserted — verified signatures against the frozen proposal. */}
                    {(() => {
                      const sig = sigStates[d.id];
                      if (!sig) return null;
                      // A forgery alarm fires ONLY once the crypto era was actually entered — i.e. at
                      // least one signature was cast (signedUids) yet the claimed 'passed' still doesn't
                      // reach a verified quorum. A 'passed' with ZERO signatures is not a forgery: it is
                      // a LEGACY uid-vote decision or a one-voice intention (createDecision auto-passes an
                      // intention without a signature). Those keep their valid-by-auth standing and simply
                      // show no crypto line — never a red "unverified" warning that would invalidate them.
                      const forged = !sig.valid && sig.signedUids.size > 0;
                      if (sig.verifiedCount === 0 && !forged) return null; // nothing signed yet (legacy/voices only)
                      return (
                        <div className={`mt-2 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium ${
                          forged ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-800'
                        }`}>
                          <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{forged ? <Icons.Shield /> : <Icons.ShieldCheck />}</span>
                          <span>{forged
                            ? t('decision_verified_forged')
                            : t('decision_verified').replace('{n}', String(sig.verifiedCount)).replace('{q}', String(d.voicesRequired))}</span>
                        </div>
                      );
                    })()}

                    {consensus ? (
                      <>
                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-bold">
                          <span className="text-emerald-600">{d.unites} unite</span>
                          <span className="text-slate-300">·</span>
                          <span className="text-slate-500">{d.standAsides} stand aside</span>
                          <span className="text-slate-300">·</span>
                          <span className={d.blocks ? 'text-rose-600' : 'text-slate-400'}>{d.blocks} block</span>
                          {d.myStance && <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-500">you: {consensusStanceLabels[d.myStance].toLowerCase()}</span>}
                        </div>
                        {d.blocked && (
                          <div className="mt-2 rounded-xl border border-rose-100 bg-rose-50 p-2.5 text-[11px] text-rose-800">
                            <p className="font-semibold">A block stands — the meeting is not in unity. Tend it before adopting.</p>
                            {d.positions.filter(p => p.stance === 'block' && p.note).slice(-3).map((p, i) => <p key={i} className="mt-1 italic">“{p.note}”</p>)}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="mt-2 text-[11px] font-bold text-slate-400">{d.voiceCount} / {d.voicesRequired} {t('voices')}</div>
                        {d.listening && (
                          <div className="mt-2 rounded-xl border border-indigo-100 bg-indigo-50 p-2.5 text-[11px] text-indigo-800">
                            <p className="font-semibold">A concern was raised. This proposal has entered listening.</p>
                            {d.concerns.filter(c => c.note).slice(-3).map((c, i) => <p key={i} className="mt-1 italic">“{c.note}”</p>)}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {consensus ? (
                      <>
                        {open && currentUserId && (
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <button onClick={() => handlePosition(d.id, 'unite')} disabled={votingId === d.id} className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${d.myStance === 'unite' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>Unite</button>
                            <button onClick={() => handlePosition(d.id, 'stand_aside')} disabled={votingId === d.id} className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${d.myStance === 'stand_aside' ? 'bg-slate-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Stand aside</button>
                            <button onClick={() => handlePosition(d.id, 'block')} disabled={votingId === d.id} className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${d.myStance === 'block' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-600 hover:bg-rose-100'}`}>Block</button>
                          </div>
                        )}
                        {open && clerk && (
                          <div className="mt-0.5 flex items-center gap-2">
                            <button onClick={() => handleDiscern(d.id, 'passed')} disabled={votingId === d.id || d.blocked} title={d.blocked ? 'A block must be tended before the meeting can find unity' : 'Discern the sense of the meeting and adopt'} className="rounded-full bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50">Adopt (unity)</button>
                            <button onClick={() => handleDiscern(d.id, 'rejected')} disabled={votingId === d.id} className="rounded-full px-3 py-1 text-[11px] font-medium text-slate-400 transition-colors hover:text-red-500 disabled:opacity-50">Not adopted</button>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {open && !d.listening && (
                          <button onClick={() => handleVote(d.id)} disabled={votingId === d.id || d.voted} className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${d.voted ? 'bg-slate-100 text-slate-400' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
                            {d.voted ? t('voted') : (votingId === d.id ? '…' : t('vote'))}
                          </button>
                        )}
                        {open && !d.listening && currentUserId && (
                          <button onClick={() => handleRaiseConcern(d.id)} disabled={votingId === d.id} className="rounded-full px-3 py-1 text-[11px] font-bold text-indigo-600 hover:bg-indigo-50 disabled:opacity-50">Raise a concern</button>
                        )}
                        {d.listening && clerk && (
                          <button onClick={() => handleResume(d.id)} disabled={votingId === d.id} className="rounded-full bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-indigo-700 disabled:opacity-50">Tend &amp; resume</button>
                        )}
                      </>
                    )}
                    {open && clerk && (
                      <button onClick={() => handleWithdraw(d.id)} disabled={votingId === d.id} className="rounded-full px-3 py-1 text-[11px] font-medium text-slate-400 transition-colors hover:text-red-500">Withdraw</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Signing-key setup — opened when a being tries to sign a vote without a device key yet.
          On close, if a key now exists, resume the signing action they set out to do. */}
      {showKey && currentUserId && (
        <SigningKeyModal
          uid={currentUserId}
          notify={m => showAlert(m)}
          onClose={async () => {
            setShowKey(false);
            const run = pendingSign;
            setPendingSign(null);
            if (run && await hasSigningKey(currentUserId)) {
              setVotingId('key');
              try { await run(); } catch (e: any) { showAlert(e?.message || 'Could not record your voice.'); }
              setVotingId(null);
            }
          }}
        />
      )}

      {/* A freshly-born recovery phrase (only if a device key was created mid-sign) — shown once. */}
      {phrase && (
        <div className="fixed inset-x-0 bottom-4 z-50 mx-auto max-w-md rounded-xl border border-amber-200 bg-amber-50 p-3 shadow-lg">
          <p className="mb-2 text-xs font-semibold text-amber-800">{t('signing_phrase_warn')}</p>
          <ol className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {phrase.map((w, i) => (
              <li key={i} className="flex items-baseline gap-2 rounded-lg border border-amber-100 bg-white px-2.5 py-1.5">
                <span className="w-5 shrink-0 text-right text-[10px] font-bold text-slate-400">{i + 1}</span>
                <span className="font-mono text-sm text-slate-800">{w}</span>
              </li>
            ))}
          </ol>
          <button type="button" onClick={() => setPhrase(null)} className="mt-2 text-xs font-bold text-amber-700 underline">{t('signing_phrase_done')}</button>
        </div>
      )}
    </div>
  );
};
