import React, { useState } from 'react';
import { Icons } from '../ui/Icons';
import { createTreeInvite } from '../../services/firebase';
import { type Lifetree, type InvitableRole, treeRelationLabels } from '../../types';
import { treeCircle } from '../../domain/views/circle';
import { SectionCard } from '../ui/SectionCard';

// The circle view is a prism over the tree's incoming links; the shell computes it (it also
// derives tending powers from the same read) and hands the finished view down.
type TreeCircleView = ReturnType<typeof treeCircle>;

interface TreeCircleProps {
    tree: Lifetree;
    currentUserId?: string;
    canInvite: boolean;
    circle: TreeCircleView;
}

// Tree Circle — shared care of this Lifetree. When someone accepts an invite a
// community circle forms around the tree (see acceptTreeInvite Cloud Function).
export const TreeCircle: React.FC<TreeCircleProps> = ({ tree, currentUserId, canInvite, circle }) => {
    const [showInvite, setShowInvite] = useState(false);
    const [inviteUserId, setInviteUserId] = useState('');
    const [inviteRole, setInviteRole] = useState<InvitableRole>('co_owner');
    const [inviteMessage, setInviteMessage] = useState('');
    const [inviteBusy, setInviteBusy] = useState(false);
    const [inviteStatus, setInviteStatus] = useState<string | null>(null);

    const handleSendInvite = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!currentUserId || !inviteUserId.trim() || inviteBusy) return;
        setInviteBusy(true);
        setInviteStatus(null);
        try {
            await createTreeInvite({
                lifetree: tree,
                invitedUserId: inviteUserId.trim(),
                role: inviteRole,
                message: inviteMessage.trim(),
                invitedByUserId: currentUserId,
            });
            setInviteUserId('');
            setInviteMessage('');
            setShowInvite(false);
            setInviteStatus('Invitation sent. When they accept, a circle opens around this tree.');
        } catch (err) {
            setInviteStatus((err instanceof Error && err.message) ? err.message : 'Failed to send invitation.');
        }
        setInviteBusy(false);
    };

    return (
        <SectionCard title="Tree Circle" icon={<Icons.Venn />}>
            {circle.size <= 1 ? (
                <p className="mb-4 text-sm text-emerald-800/80">This tree does not have a circle yet. Invite someone to care for it with you — when they accept, a community grows around the tree.</p>
            ) : (
                <div className="mb-4">
                    <p className="mb-3 text-sm text-emerald-800/80">This tree is cared for by:</p>
                    <div className="space-y-1.5">
                        {circle.groups.map(g => (
                            <div key={g.role} className="flex items-center justify-between rounded-lg bg-white/60 px-3 py-1.5 text-sm">
                                <span className="font-medium">{treeRelationLabels[g.role]}{g.members.length > 1 ? 's' : ''}</span>
                                <span className="font-bold text-emerald-700">{g.members.length}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {canInvite && (showInvite ? (
                <form onSubmit={handleSendInvite} className="space-y-2 rounded-xl border border-emerald-200 bg-white p-4">
                    <p className="text-xs text-emerald-700/80">Invite someone into shared care of this Lifetree.</p>
                    <input value={inviteUserId} onChange={e => setInviteUserId(e.target.value)} placeholder="Their user ID" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" required />
                    <div className="grid grid-cols-2 gap-2">
                        <select value={inviteRole} onChange={e => setInviteRole(e.target.value as InvitableRole)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                            <option value="co_owner">Co-guardian</option>
                            <option value="guardian">Guardian</option>
                            <option value="steward">Steward</option>
                            <option value="observer">Observer</option>
                        </select>
                        <button type="submit" disabled={inviteBusy} className="h-10 rounded-lg bg-emerald-600 text-sm font-bold text-white shadow hover:bg-emerald-700 disabled:opacity-50">{inviteBusy ? 'Sending…' : 'Send'}</button>
                    </div>
                    <input value={inviteMessage} onChange={e => setInviteMessage(e.target.value)} placeholder="A short message (optional)" className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    <button type="button" onClick={() => setShowInvite(false)} className="text-xs font-medium text-slate-500 hover:text-slate-700">Cancel</button>
                </form>
            ) : (
                <button onClick={() => setShowInvite(true)} className="mx-auto flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-bold uppercase tracking-widest text-white shadow-lg transition-all hover:bg-emerald-700 active:scale-95">
                    <Icons.UserPlus /> <span>Invite to Tree Circle</span>
                </button>
            ))}
            {inviteStatus && <p className="mt-3 text-xs text-emerald-700">{inviteStatus}</p>}
        </SectionCard>
    );
};
