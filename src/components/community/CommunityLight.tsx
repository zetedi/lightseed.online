import { useEffect, useState } from 'react';
import { Icons } from '../ui/Icons';
import { SectionTitle } from '../ui/SectionTitle';
import { getGlow } from '../../services/firebase/light';
import { RAY_UNITS } from '../../domain/light';
import { useLanguage } from '../../contexts/LanguageContext';
import { say, speak, spokenLine } from '../../utils/translations';
import { COIN_CODE_MAX, COIN_NAME_MAX, coinOf, coinProblem, normalizeCoin } from '../../domain/coin';
import { updateCommunity } from '../../services/firebase';
import { notify } from '../ui/Toast';
import { Picture } from '../ui/Picture';
import type { Community } from '../../types';

// THE COMMUNITY'S LIGHT — its accumulated GLOW (glow/{communityId}): the commons of light that
// gathers where care circulates through the community (a prism's share, a departing being's last
// spend, idle light fading in). Server-written and communal, so it is shown, not owned. Keepers
// spend it through a COMMUNITY DECISION (the Council), never by a single hand; that gate is a
// coming rung, framed here so the meaning is clear before the mechanism lands.
export const CommunityLight = ({ communityId, community, isKeeper, onGoToCouncil, onUpdate }: {
    communityId: string;
    community?: Community | null;
    isKeeper?: boolean;
    onGoToCouncil?: () => void;
    onUpdate?: (patch: Partial<Community>) => void;
}) => {
    const { t } = useLanguage();
    // THE COIN (ring 2026-09-19; domain/coin): the face this community gives its light.
    const coin = coinOf(community);
    const [coinName, setCoinName] = useState(community?.coin?.name || '');
    const [coinCode, setCoinCode] = useState(community?.coin?.code || '');
    const [savingCoin, setSavingCoin] = useState(false);
    const coinDraftProblem = coinProblem({ name: coinName, code: coinCode });
    const saveCoin = async () => {
        if (!community || coinDraftProblem) return;
        setSavingCoin(true);
        try {
            const next = normalizeCoin({ name: coinName, code: coinCode });
            const patch = { coin: next ?? undefined } as Partial<Community>;
            await updateCommunity(community.id, next ? patch : ({ coin: null } as unknown as Partial<Community>));
            onUpdate?.(patch);
            notify(`🌱 ${speak('coin_saved')}`);
        } catch { notify(speak('err_save_retry'), 'error'); }
        setSavingCoin(false);
    };
    const [units, setUnits] = useState<number | null>(null); // null = loading
    useEffect(() => {
        let alive = true;
        getGlow(communityId).then(u => { if (alive) setUnits(u); }).catch(() => { if (alive) setUnits(0); });
        return () => { alive = false; };
    }, [communityId]);

    const rays = units === null ? 0 : Math.floor(units / RAY_UNITS);
    // "…through a community decision: …" — the bold phrase sits inside the sentence, so the line
    // carries a {decision} seat and each tongue places it where its grammar wants it.
    const [spentPre, spentPost] = t('community_light_p2').split('{decision}');

    return (
        <div>
            <SectionTitle title={coin.own ? coin.name : t('light')} sub={say('community_light_sub', { coin: coin.name })} />
            {coin.own && (
                <div className="mb-4 flex items-center gap-3 rounded-2xl border border-amber-100 bg-white p-3 dark:border-amber-900 dark:bg-slate-900">
                    {coin.logoUrl
                        ? <Picture size={480} src={coin.logoUrl} alt="" className="h-10 w-10 rounded-full border-2 border-amber-200 object-cover" />
                        : <span className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600"><Icons.Sun /></span>}
                    <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{coin.name}</p>
                        <p dir="ltr" className="text-[11px] font-mono text-slate-400">{coin.place ? say('coin_of_place', { code: coin.code, place: coin.place }) : coin.code}</p>
                    </div>
                </div>
            )}

            {/* The glow disc — brightens with the light the commons holds. */}
            <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-6 dark:border-amber-900 dark:bg-amber-950/40">
                <div className="relative flex items-center justify-center py-4">
                    {units !== null && units > 0 && (
                        <>
                            <div className="absolute h-44 w-44 rounded-full bg-amber-300 blur-2xl" style={{ opacity: Math.min(0.5, 0.14 + units / 3000) }} />
                            <div className="absolute h-28 w-28 rounded-full bg-amber-200 blur-xl" style={{ opacity: Math.min(0.75, 0.3 + units / 2000) }} />
                        </>
                    )}
                    <div className="relative flex h-28 w-28 flex-col items-center justify-center rounded-full border border-amber-200 bg-gradient-to-br from-amber-100 to-amber-50 dark:border-amber-900">
                        <span className="text-3xl font-semibold text-amber-600 dark:text-amber-300">{units === null ? '·' : units}</span>
                        <span className="text-[10px] uppercase tracking-wider text-amber-500">{t('units')}</span>
                    </div>
                </div>
                <p className="mt-2 text-center text-sm font-medium text-amber-700 dark:text-amber-300">
                    {units === null ? say('light_gathering', { coin: coin.name }) : rays > 0 ? say('shared_light_rays', { n: rays, coin: coin.name }) : say('no_light_gathered', { coin: coin.name })}
                </p>
            </div>

            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-slate-100 bg-white p-4 dark:bg-slate-900 dark:border-slate-800">
                <span className="mt-0.5 text-amber-500"><Icons.Sun /></span>
                <div className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    <p>{say('community_light_p1', { coin: coin.name })}</p>
                    <p className="mt-2">
                        {spentPre}<span className="font-semibold text-slate-800 dark:text-slate-100">{t('community_decision')}</span>{spentPost}
                    </p>
                    {isKeeper && community && (
                        <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{t('coin_title')}</p>
                            <p className="mb-3 text-xs text-slate-500">{t('coin_note')}</p>
                            <div className="grid gap-2 sm:grid-cols-[1fr_8rem_auto]">
                                <input dir="auto" value={coinName} maxLength={COIN_NAME_MAX} onChange={e => setCoinName(e.target.value)} placeholder={t('coin_name')} aria-label={t('coin_name')} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-slate-900 dark:border-slate-700" />
                                <input dir="ltr" value={coinCode} maxLength={COIN_CODE_MAX} onChange={e => setCoinCode(e.target.value)} placeholder={t('coin_code')} aria-label={t('coin_code')} className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-mono text-sm uppercase focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-slate-900 dark:border-slate-700" />
                                <button type="button" onClick={() => void saveCoin()} disabled={savingCoin || !!coinDraftProblem} className="h-10 rounded-full bg-emerald-600 px-4 text-xs font-bold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50">{savingCoin ? t('saving') : t('save')}</button>
                            </div>
                            {coinDraftProblem && <p className="mt-2 text-xs text-rose-600 dark:text-rose-300">{speak(spokenLine(coinDraftProblem, { max: COIN_NAME_MAX }))}</p>}
                        </div>
                    )}
                    {isKeeper && onGoToCouncil && (
                        <button onClick={onGoToCouncil} className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                            <Icons.Venn /> {t('propose_spend_council')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
