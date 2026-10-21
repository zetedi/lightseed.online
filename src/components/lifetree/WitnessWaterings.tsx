import React, { useState } from 'react';
import { showAlert, showConfirm } from '../ui/Dialog';
import { Icons } from '../ui/Icons';
import { useLanguage } from '../../contexts/LanguageContext';
import { witnessWatering, unmintLastPulse } from '../../services/firebase';
import { unmintRefusal } from '../../domain/unmint';
import { say } from '../../utils/translations';
import type { Pulse } from '../../types';

import { Picture } from '../ui/Picture';
import { FullViewButton } from '../ui/FullView';
// The waterings of a tree no human has witnessed yet, and the circle's hand to witness them —
// the sun ring's mint, judged on server ground (witnessWatering). One face, shown wherever
// care is read: the Care tab beside "last watered", and the Circle. Who may witness is the
// circle minus the carer: the keeper, a keeper, a steward or a guardian — never one's own
// care (ring 2026-09-03, "the circle witnesses"). The server judges standing and tenure; this
// only offers the button where it can succeed, and names the state of each watering honestly.
// THE CARER'S OWN DOOR (ring 2026-10-21): while no one has witnessed it, the hand that watered may
// take the watering back here — the unmint law (domain/unmint) judges: only the newest link, only
// while no other being holds it; the tree's clock and face return with the link (the mint's touch).
export const awaitingWitness = (pulses: Pulse[]): Pulse[] =>
    pulses.filter(p => p.care === 'watering' && p.wateringConfirmedBy !== 'guardian');

interface WitnessWateringsProps {
    treeName?: string;
    // The tree's growth blocks (newest first); the un-witnessed waterings are read from them.
    pulses: Pulse[];
    currentUserId?: string;
    // The viewer stands in the circle (owner / keeper / steward / guardian).
    canWitness: boolean;
    // Reload the chain after a witness landed (the block now carries its confirmation).
    onWitnessed?: () => void;
    // The tree's head — a watering is the carer's to take back only while it is the newest link.
    latestHash?: string;
    // Reload the chain after the carer took a watering back.
    onUnminted?: () => void;
    className?: string;
}

export const WitnessWaterings: React.FC<WitnessWateringsProps> = ({ treeName, pulses, currentUserId, canWitness, onWitnessed, latestHash, onUnminted, className = '' }) => {
    const { t } = useLanguage();
    const [witnessing, setWitnessing] = useState<string | null>(null);
    const [unminting, setUnminting] = useState<string | null>(null);
    const waiting = awaitingWitness(pulses).slice(0, 8);
    if (waiting.length === 0) return null;

    const handleUnmint = async (p: Pulse) => {
        if (unminting || !(await showConfirm('unmint_confirm', { title: 'unmint', confirmText: 'unmint', danger: true }))) return;
        setUnminting(p.id);
        try {
            await unmintLastPulse(p);
            onUnminted?.();
        } catch (e) { showAlert(e instanceof Error ? e.message : String(e)); }
        setUnminting(null);
    };

    const handleWitness = async (p: Pulse) => {
        setWitnessing(p.id);
        try {
            const res = await witnessWatering(p.id);
            showAlert(res.secret
                ? say('witness_secret', { tree: treeName || t('tree') })
                : res.kindled
                    ? say('witness_kindled', { tree: treeName || t('tree') })
                    : 'witness_already_lit');
            onWitnessed?.();
        } catch (e) { showAlert(e instanceof Error ? e.message : String(e)); }
        setWitnessing(null);
    };

    return (
        <div className={`rounded-2xl border border-sky-100 bg-sky-50/60 p-4 dark:border-sky-900 dark:bg-sky-950/60 ${className}`}>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-sky-600 dark:text-sky-300">{t('witness_waterings')}</p>
            <div className="space-y-1.5">
                {waiting.map(p => {
                    const mine = !!currentUserId && p.authorId === currentUserId;
                    // The door is honest in both states: live while the law allows, disabled with the reason.
                    const refusal = mine && latestHash ? unmintRefusal(p, { latestHash }, currentUserId) : 'unmint_not_author';
                    const when = p.createdAt?.toMillis ? new Date(p.createdAt.toMillis()).toLocaleDateString() : t('a_watering');
                    return (
                        <div key={p.id} className="flex items-center gap-3 rounded-xl border border-sky-100 bg-white p-2 shadow-sm dark:bg-slate-900 dark:border-sky-900">
                            {p.imageUrl
                                ? <FullViewButton wrap src={p.imageUrl} className="shrink-0"><Picture size={480} src={p.imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover" /></FullViewButton>
                                : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-500 [&>svg]:h-5 [&>svg]:w-5 dark:bg-sky-950/40"><Icons.Droplet /></span>}
                            <span className="min-w-0 flex-1 text-xs text-slate-600 dark:text-slate-300">
                                <span className="block truncate">{when}{p.authorPersonName ? ` · ${p.authorPersonName}` : ''}{p.wateringConfirmation?.note ? ` · ${p.wateringConfirmation.note}` : ''}</span>
                                <span className="block text-[10px] font-bold uppercase tracking-wide text-sky-500">
                                    {p.wateringConfirmedBy === 'ai' ? t('confirmed_by_ai') : t('awaiting_confirmation')}
                                </span>
                            </span>
                            {canWitness && !mine && (
                                <button
                                    onClick={() => handleWitness(p)}
                                    disabled={witnessing === p.id}
                                    className="shrink-0 rounded-full btn-theme px-3.5 py-1.5 text-xs font-bold text-white transition-colors disabled:opacity-50"
                                >
                                    {witnessing === p.id ? '…' : t('witness')}
                                </button>
                            )}
                            {mine && refusal !== 'unmint_not_author' && (
                                <button
                                    type="button"
                                    onClick={() => handleUnmint(p)}
                                    disabled={!!refusal || unminting === p.id}
                                    title={refusal ? t(refusal) : t('unmint_confirm')}
                                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-bold text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:bg-slate-900 dark:text-rose-300"
                                >
                                    <span className="[&>svg]:h-3 [&>svg]:w-3"><Icons.Trash /></span>{unminting === p.id ? '…' : t('unmint')}
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-sky-700/80">{t('witness_hint')}</p>
        </div>
    );
};
