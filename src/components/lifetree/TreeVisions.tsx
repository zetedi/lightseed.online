import { useState } from 'react';
import type { Lifetree, Vision } from '../../types';
import { Icons } from '../ui/Icons';
import { SectionCard } from '../ui/SectionCard';
import { showAlert, showConfirm } from '../ui/Dialog';
import { notify } from '../ui/Toast';
import { useLanguage } from '../../contexts/LanguageContext';
import { groundRefusal } from '../../domain/grounding';
import { useTreeGrounds, groundActs, type GroundOf } from '../../hooks/useGrounds';

// THE TREE'S SIDE OF THE GROUND (domain/grounding, ring 2026-11-17). On a tree's page: the
// visions grounded here, the visions knocking, and — off the main flow — two ways in:
//   · a carer GROWS a vision from this tree (the create form, then one yes: author and carer are
//     the same hand, so no knock is needed);
//   · any signed-in being grounds one of THEIR visions here — at once if they care for the tree,
//     otherwise as an ask its carers answer.
// Every act is the server's (askGround / acceptGround / releaseGround); this face only asks, and
// shows a refusal in the reader's tongue.
export const TreeVisions = ({ tree, currentUserId, caresForTree, onViewVision, onGrowVision }: {
    tree: Lifetree;
    currentUserId?: string;
    caresForTree: boolean;
    onViewVision?: (vision: Vision) => void;
    onGrowVision?: () => void;
}) => {
    const { t } = useLanguage();
    const { standing, asks, reload } = useTreeGrounds(tree.id);
    const grounds = standing || [];
    const [mine, setMine] = useState<Vision[] | null>(null);
    const [picking, setPicking] = useState(false);
    const [busy, setBusy] = useState<string | null>(null);

    // Whether this tree may ground anything at all (its kind, its life, its visibility) — asked
    // of the law with the most modest vision, so only the tree's own reasons answer.
    const treeRefusal = groundRefusal(
        { treeType: tree.treeType, visibility: tree.visibility, diedAtMs: (tree as { diedAt?: unknown }).diedAt ? 1 : null },
        { visibility: 'node' },
    );

    const act = async (key: string, work: () => Promise<void>, done: string) => {
        if (busy) return;
        setBusy(key);
        try { await work(); notify(done); reload(); }
        catch (e) { showAlert((e instanceof Error && e.message) || 'err_action'); }
        setBusy(null);
    };

    const openPicker = async () => {
        setPicking(p => !p);
        if (mine === null && currentUserId) {
            try { setMine(await groundActs.myVisions(currentUserId)); } catch { setMine([]); }
        }
    };
    const taken = new Set([...grounds, ...asks].map(g => g.id));
    const pickable = (mine || []).filter(v => !taken.has(v.id));

    const row = (g: GroundOf<Vision>, actions: React.ReactNode, note?: string) => (
        <div key={g.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-500 dark:bg-amber-950/40"><Icons.Eye /></span>
            <button type="button" disabled={!g.being || !onViewVision} onClick={() => g.being && onViewVision?.(g.being)} className="min-w-0 flex-1 text-left">
                <p dir="auto" className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{g.being ? g.being.title : t('ground_hidden_being')}</p>
                {(note || g.self) && <p className="truncate text-xs text-slate-400">{note || t('ground_self_chip')}</p>}
            </button>
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
        </div>
    );
    const quiet = 'rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800';
    const solid = 'rounded-full btn-theme px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50';

    return (
        <SectionCard title={t('visions_of_tree')} icon={<Icons.Eye />} className="mt-4" bodyClassName="space-y-3">
            {grounds.length === 0 && asks.length === 0 && <p className="text-sm text-slate-400">{t(treeRefusal || 'ground_none_tree')}</p>}

            {grounds.map(g => row(g, (
                (caresForTree || (currentUserId && g.being?.authorId === currentUserId)) && (
                    <button type="button" disabled={busy === `r:${g.id}`} className={quiet}
                        onClick={async () => { if (await showConfirm('ground_release_confirm', { confirmText: 'ground_release' })) act(`r:${g.id}`, () => groundActs.release(g.id, tree.id), 'ground_released'); }}>
                        {t('ground_release')}
                    </button>
                )
            )))}

            {asks.length > 0 && <p className="pt-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">{t('ground_asks')}</p>}
            {asks.map(g => row(g, (
                <>
                    {caresForTree && (
                        <button type="button" disabled={!!busy} className={solid} onClick={() => act(`a:${g.id}`, () => groundActs.accept(g.id, tree.id), 'ground_done')}>{t('ground_accept')}</button>
                    )}
                    {(caresForTree || (currentUserId && g.being?.authorId === currentUserId)) && (
                        <button type="button" disabled={!!busy} className={quiet} onClick={() => act(`d:${g.id}`, () => groundActs.dropAsk(g.id, tree.id), caresForTree ? 'ground_declined' : 'ground_withdrawn')}>
                            {t(caresForTree ? 'ground_decline' : 'ground_withdraw')}
                        </button>
                    )}
                </>
            ), t('ground_waiting')))}

            {currentUserId && !treeRefusal && (
                <div className="flex flex-wrap gap-2 pt-2">
                    {caresForTree && onGrowVision && (
                        <button type="button" className={quiet} onClick={onGrowVision}><span className="inline-flex items-center gap-1.5 [&>svg]:h-3.5 [&>svg]:w-3.5"><Icons.Sprout /> {t('ground_grow_here')}</span></button>
                    )}
                    <button type="button" className={quiet} onClick={openPicker}><span className="inline-flex items-center gap-1.5 [&>svg]:h-3.5 [&>svg]:w-3.5"><Icons.Plus /> {t('ground_mine_here')}</span></button>
                </div>
            )}
            {picking && (
                <div className="space-y-2 rounded-xl border border-dashed border-slate-200 p-3 dark:border-slate-700">
                    {mine === null ? <p className="text-sm text-slate-400">…</p>
                        : pickable.length === 0 ? <p className="text-sm text-slate-400">{t('ground_no_visions_mine')}</p>
                        : pickable.map(v => (
                            <button key={v.id} type="button" disabled={!!busy}
                                className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 disabled:opacity-50 dark:hover:bg-slate-800"
                                onClick={() => act(`p:${v.id}`, async () => { await (caresForTree ? groundActs.accept(v.id, tree.id) : groundActs.ask(v.id, tree.id)); setPicking(false); }, caresForTree ? 'ground_done' : 'ground_asked')}>
                                <span dir="auto" className="truncate font-medium text-slate-700 dark:text-slate-200">{v.title}</span>
                                <span className="shrink-0 text-xs font-bold text-emerald-600 dark:text-emerald-300">{t(caresForTree ? 'ground_accept' : 'ground_ask')}</span>
                            </button>
                        ))}
                </div>
            )}
        </SectionCard>
    );
};
