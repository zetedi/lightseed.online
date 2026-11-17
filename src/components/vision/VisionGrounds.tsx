import { useEffect, useState } from 'react';
import type { Lifetree, Vision } from '../../types';
import { Icons } from '../ui/Icons';
import { Picture } from '../ui/Picture';
import { showAlert, showConfirm } from '../ui/Dialog';
import { notify } from '../ui/Toast';
import { useLanguage } from '../../contexts/LanguageContext';
import { groundRefusal, isSeekingGround } from '../../domain/grounding';
import { useVisionGrounds, groundActs, type GroundOf } from '../../hooks/useGrounds';

// THE VISION'S SIDE OF THE GROUND (domain/grounding, ring 2026-11-17). On a vision's page: the
// trees it stands in, the trees it is still asking, and — for its author — "Ground this vision"
// in one of their own trees (one act: author and carer are the same hand). Asking ANOTHER
// being's tree is done from that tree's page, where the tree can be seen first.
// A vision with no ground says it is seeking ground. A vision still carrying the old
// `lifetreeId` and no ground is a legacy twin: the page keeps showing its old root card, and
// this component stays silent about seeking.
export const VisionGrounds = ({ vision, currentUserId, myTrees = [], onViewTree, onCount }: {
    vision: Vision;
    currentUserId?: string;
    myTrees?: Lifetree[];
    onViewTree?: (tree: Lifetree) => void;
    // How many grounds stand, told to the page (it hides the legacy card once a ground exists).
    onCount?: (n: number) => void;
}) => {
    const { t } = useLanguage();
    const isAuthor = !!currentUserId && currentUserId === vision.authorId;
    const { standing: grounds, asks, reload } = useVisionGrounds(vision.id);
    const [picking, setPicking] = useState(false);
    const [busy, setBusy] = useState<string | null>(null);
    const groundCount = grounds?.length;
    useEffect(() => {
        if (groundCount !== undefined) onCount?.(groundCount);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- onCount is a setter, stable by contract
    }, [groundCount]);

    const act = async (key: string, work: () => Promise<void>, done: string) => {
        if (busy) return;
        setBusy(key);
        try { await work(); notify(done); reload(); }
        catch (e) { showAlert((e instanceof Error && e.message) || 'err_action'); }
        setBusy(null);
    };

    if (grounds === null) return null;
    const taken = new Set([...grounds, ...asks].map(g => g.id));
    // The author's own trees that may ground this vision, each with the law's reason when not.
    const mine = myTrees.filter(tr => !taken.has(tr.id)).map(tr => ({
        tree: tr,
        refusal: groundRefusal({ treeType: tr.treeType, visibility: tr.visibility, diedAtMs: (tr as { diedAt?: unknown }).diedAt ? 1 : null }, { visibility: vision.visibility }),
    }));
    const seeking = isSeekingGround(grounds.length) && !vision.lifetreeId;
    const quiet = 'rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800';
    if (!seeking && grounds.length === 0 && asks.length === 0 && !isAuthor) return null;

    const row = (g: GroundOf<Lifetree>, action: React.ReactNode, note: string) => (
        <div key={g.id} className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3 dark:border-emerald-900 dark:bg-emerald-950/60">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-white bg-emerald-100 shadow dark:bg-emerald-950/40">
                {g.being && (g.being.latestGrowthUrl || g.being.imageUrl)
                    ? <Picture size={480} src={g.being.latestGrowthUrl || g.being.imageUrl} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                    : <span className="flex h-full w-full items-center justify-center text-emerald-500"><Icons.Tree /></span>}
            </div>
            <button type="button" disabled={!g.being || !onViewTree} onClick={() => g.being && onViewTree?.(g.being)} className="min-w-0 flex-1 text-left">
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-300">{note}</p>
                <p dir="auto" className="truncate text-base font-light tracking-wide text-slate-800 dark:text-slate-100">{g.being ? g.being.name : t('ground_hidden_being')}</p>
            </button>
            {action}
        </div>
    );

    return (
        <div className="mb-6 space-y-2">
            {seeking && (
                <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
                    <span className="mt-0.5 text-amber-500"><Icons.Sprout /></span>
                    <div>
                        <p className="text-sm font-bold text-amber-800 dark:text-amber-200">{t('ground_seeking')}</p>
                        <p className="text-xs leading-relaxed text-amber-800/80 dark:text-amber-200/80">{t('ground_seeking_sub')}</p>
                    </div>
                </div>
            )}
            {grounds.map(g => row(g, isAuthor && (
                <button type="button" disabled={!!busy} className={quiet}
                    onClick={async () => { if (await showConfirm('ground_release_confirm', { confirmText: 'ground_release' })) act(`r:${g.id}`, () => groundActs.release(vision.id, g.id), 'ground_released'); }}>
                    {t('ground_release')}
                </button>
            ), g.self ? `${t('grounded_in_trees')} · ${t('ground_self_chip')}` : t('grounded_in_trees')))}
            {asks.map(g => row(g, isAuthor && (
                <button type="button" disabled={!!busy} className={quiet} onClick={() => act(`w:${g.id}`, () => groundActs.dropAsk(vision.id, g.id), 'ground_withdrawn')}>{t('ground_withdraw')}</button>
            ), t('ground_waiting')))}

            {isAuthor && (
                <>
                    <button type="button" className={quiet} onClick={() => setPicking(p => !p)}>
                        <span className="inline-flex items-center gap-1.5 [&>svg]:h-3.5 [&>svg]:w-3.5"><Icons.Tree /> {t('ground_vision')}</span>
                    </button>
                    {picking && (
                        <div className="space-y-2 rounded-xl border border-dashed border-slate-200 p-3 dark:border-slate-700">
                            {mine.length === 0 && <p className="text-sm text-slate-400">{t('ground_no_trees_mine')}</p>}
                            {mine.map(({ tree, refusal }) => (
                                <button key={tree.id} type="button" disabled={!!busy || !!refusal} title={refusal ? t(refusal) : undefined}
                                    className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50 disabled:opacity-50 dark:hover:bg-slate-800"
                                    onClick={() => act(`g:${tree.id}`, async () => { await groundActs.accept(vision.id, tree.id); setPicking(false); }, 'ground_done')}>
                                    <span dir="auto" className="truncate font-medium text-slate-700 dark:text-slate-200">{tree.name}</span>
                                    <span className="shrink-0 text-xs font-bold text-emerald-600 dark:text-emerald-300">{refusal ? t(refusal) : t('ground_accept')}</span>
                                </button>
                            ))}
                            <p className="text-xs leading-relaxed text-slate-400">{t('ground_ask_other_hint')}</p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
