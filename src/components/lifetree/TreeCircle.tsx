import React, { useState, useEffect, useMemo } from 'react';
import { showAlert } from '../ui/Dialog';
import { Icons } from '../ui/Icons';
import { firestoreStore } from '../../adapters/firestore';
import { canTendTree } from '../../domain/policy';
import { SectionCard } from '../ui/SectionCard';
import { fetchAllLifetrees, getPersonName, createTreeInvite } from '../../services/firebase';
import { treeCircle } from '../../domain/views/circle';
import { treeRelationLabels, type TreeRelationRole, type InvitableRole } from '../../domain/treeCircle';
import type { Lifetree } from '../../types';

// THE CIRCLE — the whole circle of care around a Lifetree, one view (the two old tabs merged). It
// is a prism over the tree's incoming links (domain/views/circle), which already groups owner +
// co_owner + guardian + steward + observer. Two layers of belonging live here, kept legible, never
// collapsed: TENDING (owner / co-guardian / steward — power to shape and schedule) and WITNESSING
// (guardian — a no-privilege, self-serve follow; the seat of the collective veto). Guardianship is
// the open door anyone may enter; tending is the deeper, invited commitment. Each being is shown AS
// their tree (identity is the tree): the freshest of their public trees lends its face.
type TreeCircleView = ReturnType<typeof treeCircle>;

interface TreeCircleProps {
    tree: Pick<Lifetree, 'id' | 'name' | 'ownerId'>;
    currentUserId?: string;
    currentUserName?: string | null;
    circle: TreeCircleView;
    // Tender (owner / co-owner / steward / staff): may report danger and invite guardians.
    canEdit: boolean;
    // Owner / staff: may also invite the deeper TENDING roles (co-guardian / steward).
    canInviteRoles: boolean;
    status: 'HEALTHY' | 'DANGER';
    busy: boolean;
    onToggleDanger: () => void;
    // Re-reads the circle in the shell so this view stays in step after a guardian join/leave.
    onGuardianChange: () => void;
}

interface Face { name?: string; imageUrl?: string }

// A being shown as their tree: the freshest of their public trees with a growth image. `default`
// is private (users doc), so this public freshest tree is the honest public stand-in.
const faceFromForest = (uid: string, forest: Lifetree[]): Face => {
    const mine = forest
        .filter(t => t.ownerId === uid && t.treeType !== 'BED')
        .sort((a, b) => ((b.updatedAt as any)?.toMillis?.() || (b.createdAt as any)?.toMillis?.() || 0)
            - ((a.updatedAt as any)?.toMillis?.() || (a.createdAt as any)?.toMillis?.() || 0));
    const withImage = mine.find(t => t.latestGrowthUrl || t.imageUrl) || mine[0];
    return { name: withImage?.name, imageUrl: withImage?.latestGrowthUrl || withImage?.imageUrl };
};

const Avatar: React.FC<{ imageUrl?: string; seed: string; ring?: string }> = ({ imageUrl, seed, ring = 'ring-slate-100' }) => (
    imageUrl
        ? <img src={imageUrl} alt="" className={`h-11 w-11 shrink-0 rounded-full object-cover ring-2 ${ring}`} />
        : <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-emerald-500 text-sm font-bold text-white ring-2 ${ring}`}>
            {(seed || '?').slice(0, 1).toUpperCase()}
          </span>
);

// Tending roles read warm (emerald), witnessing cool (sky) — power vs witness, at a glance.
const ROLE_RING: Record<TreeRelationRole, string> = {
    owner: 'ring-amber-200', co_owner: 'ring-emerald-100', steward: 'ring-emerald-100',
    guardian: 'ring-sky-100', observer: 'ring-slate-100',
};

export const TreeCircle: React.FC<TreeCircleProps> = ({
    tree, currentUserId, currentUserName, circle, canEdit, canInviteRoles, status, busy, onToggleDanger, onGuardianChange,
}) => {
    const treeId = tree.id;
    const [forest, setForest] = useState<Lifetree[]>([]);
    const [names, setNames] = useState<Record<string, string>>({});
    const [toggleBusy, setToggleBusy] = useState(false);

    // The uids in the circle, and whether I am already a guardian.
    const circleUids = useMemo(() => [...new Set(circle.groups.flatMap(g => g.members))], [circle]);
    const isGuardian = useMemo(
        () => !!currentUserId && circle.groups.some(g => g.role === 'guardian' && g.members.includes(currentUserId)),
        [circle, currentUserId],
    );

    // The visible forest, once — lends both the faces and the invite search. Rules-safe (public/node).
    useEffect(() => {
        let alive = true;
        fetchAllLifetrees(undefined, undefined, ['public', 'node']).then(f => { if (alive) setForest(f); }).catch(() => {});
        return () => { alive = false; };
    }, []);

    // Person names as a fallback label for beings whose tree has no face yet. Batched, best-effort.
    useEffect(() => {
        let alive = true;
        const missing = circleUids.filter(uid => !(uid in names));
        if (!missing.length) return;
        Promise.all(missing.map(async uid => [uid, (await getPersonName(uid).catch(() => '')) || ''] as const))
            .then(pairs => { if (alive) setNames(prev => ({ ...prev, ...Object.fromEntries(pairs) })); });
        return () => { alive = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- `names` is the accumulator, not a trigger
    }, [circleUids]);

    const labelFor = (uid: string, face: Face) => uid === currentUserId ? 'You' : (face.name || names[uid] || `${uid.slice(0, 8)}…`);

    const handleToggleGuardian = async () => {
        if (!canTendTree(currentUserId)) return;
        setToggleBusy(true);
        try {
            await (isGuardian ? firestoreStore.unlink(currentUserId, 'guardian', treeId) : firestoreStore.link(currentUserId, 'guardian', treeId));
            onGuardianChange(); // the shell re-reads the circle, which flips isGuardian
        } catch (e) { showAlert(e instanceof Error ? e.message : String(e)); }
        setToggleBusy(false);
    };

    // ── Invite by tree name ─────────────────────────────────────────────────────────────────────
    const [term, setTerm] = useState('');
    const [inviteRole, setInviteRole] = useState<InvitableRole>('guardian');
    const [inviting, setInviting] = useState<string | null>(null);
    const [invited, setInvited] = useState<Set<string>>(new Set());

    const circleSet = useMemo(() => new Set(circleUids), [circleUids]);
    const matches = useMemo(() => {
        const q = term.trim().toLowerCase();
        if (q.length < 2) return [];
        return forest
            .filter(t => t.treeType !== 'BED' && t.id !== treeId && t.ownerId !== tree.ownerId
                && !circleSet.has(t.ownerId) && (t.name || '').toLowerCase().includes(q))
            .slice(0, 6);
    }, [term, forest, treeId, tree.ownerId, circleSet]);

    const handleInvite = async (candidate: Lifetree) => {
        if (!currentUserId) return;
        setInviting(candidate.id);
        try {
            await createTreeInvite({
                lifetree: tree as Lifetree,
                invitedUserId: candidate.ownerId,
                role: inviteRole,
                invitedByUserId: currentUserId,
                invitedByName: currentUserName || undefined,
                message: `Would you join the circle of ${tree.name || 'this tree'} as ${treeRelationLabels[inviteRole].toLowerCase()}?`,
            });
            setInvited(prev => new Set(prev).add(candidate.ownerId));
            showAlert(`Invitation sent to ${candidate.name || 'that tree'} — ${treeRelationLabels[inviteRole].toLowerCase()} of ${tree.name || 'this tree'}.`);
        } catch (e) { showAlert(e instanceof Error ? e.message : String(e)); }
        setInviting(null);
    };

    const isBusy = busy || toggleBusy;

    return (
        <SectionCard title="Circle" icon={<Icons.Venn />}>
            <p className="mb-5 text-sm text-slate-500">
                The circle of care around this tree. <span className="text-emerald-700">Tenders</span> shape and
                schedule it; <span className="text-sky-600">guardians</span> watch over it, holding no power but
                the collective veto. Guarding is an open door; tending is a deeper, invited commitment.
            </p>

            {/* Everyone, grouped by role, each shown as their tree. */}
            {circle.groups.length > 0 ? (
                <div className="mb-5 space-y-4">
                    {circle.groups.map(g => (
                        <div key={g.role}>
                            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                                {treeRelationLabels[g.role]}{g.members.length > 1 ? 's' : ''} · {g.members.length}
                            </p>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {g.members.map(uid => {
                                    const face = faceFromForest(uid, forest);
                                    return (
                                        <div key={`${g.role}:${uid}`} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-2.5 shadow-sm">
                                            <Avatar imageUrl={face.imageUrl} seed={labelFor(uid, face)} ring={ROLE_RING[g.role]} />
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-bold text-slate-800">{labelFor(uid, face)}</p>
                                                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{treeRelationLabels[g.role]}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="mb-5 rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
                    No circle yet. Be the first to watch over this tree.
                </p>
            )}

            {/* Actions — compact pills, never full width. */}
            <div className="flex flex-wrap items-center gap-2">
                {currentUserId ? (
                    <button
                        onClick={handleToggleGuardian}
                        disabled={isBusy}
                        className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-colors active:scale-95 disabled:opacity-50 ${isGuardian ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-sky-600 text-white hover:bg-sky-700'}`}
                    >
                        <span className="[&>svg]:h-3.5 [&>svg]:w-3.5"><Icons.Shield /></span>
                        {isGuardian ? 'Leave guardianship' : 'Guard this tree'}
                    </button>
                ) : (
                    <p className="text-xs italic text-slate-400">Sign in to guard this tree.</p>
                )}

                {canEdit && (
                    <button
                        onClick={onToggleDanger}
                        disabled={isBusy}
                        className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-colors active:scale-95 disabled:opacity-50 ${status === 'DANGER' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
                    >
                        {status === 'DANGER' ? <span>Resolve danger</span> : <><span className="[&>svg]:h-3.5 [&>svg]:w-3.5"><Icons.Siren /></span><span>Report danger</span></>}
                    </button>
                )}
            </div>

            {/* Invite a tree into the circle, found by name. Anyone with edit rights invites
                guardians (the open layer); the owner may also invite the deeper tending roles. */}
            {canEdit && currentUserId && (
                <div className="mt-6 border-t border-slate-100 pt-5">
                    <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Invite into the circle</p>
                        {canInviteRoles && (
                            <select value={inviteRole} onChange={e => setInviteRole(e.target.value as InvitableRole)}
                                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                                <option value="guardian">as Guardian</option>
                                <option value="co_owner">as Co-guardian</option>
                                <option value="steward">as Steward</option>
                                <option value="observer">as Observer</option>
                            </select>
                        )}
                    </div>
                    <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 [&>svg]:h-4 [&>svg]:w-4"><Icons.Search /></span>
                        <input
                            value={term}
                            onChange={e => setTerm(e.target.value)}
                            placeholder="Find a tree by name…"
                            className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                        />
                    </div>
                    {matches.length > 0 && (
                        <div className="mt-2 space-y-1.5">
                            {matches.map(m => {
                                const already = invited.has(m.ownerId);
                                return (
                                    <div key={m.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-2 shadow-sm">
                                        <Avatar imageUrl={m.latestGrowthUrl || m.imageUrl} seed={m.name || '?'} ring="ring-emerald-100" />
                                        <p className="min-w-0 flex-1 truncate text-sm font-bold text-slate-700">{m.name || 'A tree'}</p>
                                        <button
                                            onClick={() => handleInvite(m)}
                                            disabled={inviting === m.id || already}
                                            className="shrink-0 rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                                        >
                                            {already ? 'Invited' : inviting === m.id ? '…' : 'Invite'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    {term.trim().length >= 2 && matches.length === 0 && (
                        <p className="mt-2 text-xs italic text-slate-400">No tree by that name to invite.</p>
                    )}
                </div>
            )}
        </SectionCard>
    );
};
