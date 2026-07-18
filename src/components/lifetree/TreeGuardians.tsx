import React, { useState, useEffect } from 'react';
import { showAlert } from '../ui/Dialog';
import { Icons } from '../ui/Icons';
import { firestoreStore } from '../../adapters/firestore';
import { canTendTree } from '../../domain/policy';
import { SectionCard } from '../ui/SectionCard';

interface TreeGuardiansProps {
    treeId: string;
    currentUserId?: string;
    // Tender powers (owner / co-owner / steward / staff) — reporting danger writes the tree's
    // status, which is a tender power, not a follow.
    canEdit: boolean;
    // The tree's status lives in the shell — the DANGER banner up top reads the same value.
    status: 'HEALTHY' | 'DANGER';
    // True while the shell is toggling danger (mirrors the old shared isSaving).
    busy: boolean;
    onToggleDanger: () => void;
    // Lets the shell re-read the circle so it stays in step with the guardian toggle.
    onGuardianChange: () => void;
}

// Guardians section — the tree's public circle of followers. Guardianship is a prism over the
// LIN: read this tree's incoming 'guardian' links. A guardian link is a LIGHTWEIGHT public
// follow and grants no powers — tending vests in the invited roles (co_owner/steward).
export const TreeGuardians: React.FC<TreeGuardiansProps> = ({
    treeId,
    currentUserId,
    canEdit,
    status,
    busy,
    onToggleDanger,
    onGuardianChange,
}) => {
    const [localIsGuardian, setLocalIsGuardian] = useState(false);
    const [guardianCount, setGuardianCount] = useState(0);
    const [guardianUids, setGuardianUids] = useState<string[]>([]);
    const [guardianNonce, setGuardianNonce] = useState(0);
    const [toggleBusy, setToggleBusy] = useState(false);
    useEffect(() => {
        let alive = true;
        firestoreStore.linksTo(treeId, 'guardian').then(links => {
            if (!alive) return;
            setLocalIsGuardian(!!currentUserId && links.some(l => l.from === currentUserId));
            setGuardianCount(links.length);
            setGuardianUids(links.map(l => l.from));
        }).catch(() => {});
        return () => { alive = false; };
    }, [treeId, currentUserId, guardianNonce]);

    const handleToggleGuardian = async () => {
        if (!canTendTree(currentUserId)) return;
        setToggleBusy(true);
        try {
            const isJoining = !localIsGuardian;
            await (isJoining ? firestoreStore.link(currentUserId, 'guardian', treeId) : firestoreStore.unlink(currentUserId, 'guardian', treeId));
            // The guardian link is the source of truth — reflect it immediately, then re-read.
            setLocalIsGuardian(isJoining);
            setGuardianCount(c => Math.max(0, c + (isJoining ? 1 : -1)));
            setGuardianNonce(n => n + 1);
            onGuardianChange();
        } catch (e) { showAlert(e instanceof Error ? e.message : String(e)); }
        setToggleBusy(false);
    };

    const isBusy = busy || toggleBusy;

    return (
        <SectionCard title="Guardians" icon={<Icons.Shield />}>
            <p className="text-sm mb-6 text-slate-500">
                This tree is protected by the community. Join the guardians to monitor its health and add memories.
            </p>

            {/* The circle of guardians, shown as cards (like My Trees in the profile). */}
            {guardianUids.length > 0 && (
                <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {guardianUids.map(uid => (
                        <div key={uid} className="flex items-center gap-3 rounded-xl border border-sky-100 bg-white/70 p-3 shadow-sm">
                            <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(uid.slice(0, 2))}&background=0ea5e9&color=fff`} className="h-10 w-10 shrink-0 rounded-full" alt="" />
                            <div className="min-w-0">
                                <p dir="ltr" className="truncate font-mono text-xs text-sky-900" title={uid}>{uid === currentUserId ? 'You' : `${uid.slice(0, 8)}…`}</p>
                                <p className="text-[10px] font-bold uppercase tracking-wide text-sky-500">Guardian</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="space-y-3">
                {currentUserId ? (
                    <button
                        onClick={handleToggleGuardian}
                        disabled={isBusy}
                        className={`w-full py-3 rounded-xl font-bold uppercase tracking-widest shadow-lg transition-all active:scale-95 ${localIsGuardian ? 'bg-slate-200 text-slate-600 hover:bg-slate-300' : 'bg-sky-600 text-white hover:bg-sky-700'}`}
                    >
                        {localIsGuardian ? "Leave Guardianship" : "Join Guardianship"}
                    </button>
                ) : (
                    <p className="text-xs text-center italic">Sign in to become a guardian.</p>
                )}

                {canEdit && (
                    <button
                        onClick={onToggleDanger}
                        disabled={isBusy}
                        className={`w-full py-3 rounded-xl font-bold uppercase tracking-widest shadow-lg transition-all active:scale-95 flex items-center justify-center space-x-2 ${status === 'DANGER' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-red-500 text-white hover:bg-red-600'}`}
                    >
                        {status === 'DANGER' ? (
                            <><span>RESOLVE DANGER</span></>
                        ) : (
                            <><Icons.Siren /><span>REPORT DANGER</span></>
                        )}
                    </button>
                )}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500 font-mono">
                Guardians: {guardianCount}
            </div>
        </SectionCard>
    );
};
