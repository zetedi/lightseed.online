import { useEffect, useState } from 'react';
import { Icons } from '../ui/Icons';
import { SectionTitle } from '../ui/SectionTitle';
import { getGlow } from '../../services/firebase/light';
import { RAY_UNITS } from '../../domain/light';
import { useLanguage } from '../../contexts/LanguageContext';

// THE COMMUNITY'S LIGHT — its accumulated GLOW (glow/{communityId}): the commons of light that
// gathers where care circulates through the community (a prism's share, a departing being's last
// spend, idle light fading in). Server-written and communal, so it is shown, not owned. Keepers
// spend it through a COMMUNITY DECISION (the Council), never by a single hand; that gate is a
// coming rung, framed here so the meaning is clear before the mechanism lands.
export const CommunityLight = ({ communityId, isKeeper, onGoToCouncil }: {
    communityId: string;
    isKeeper?: boolean;
    onGoToCouncil?: () => void;
}) => {
    const { t } = useLanguage();
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
            <SectionTitle title={t('light')} sub={t('community_light_sub')} />

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
                    {units === null ? t('light_gathering') : rays > 0 ? t('shared_light_rays').replace('{n}', String(rays)) : t('no_light_gathered')}
                </p>
            </div>

            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-slate-100 bg-white p-4 dark:bg-slate-900 dark:border-slate-800">
                <span className="mt-0.5 text-amber-500"><Icons.Sun /></span>
                <div className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    <p>{t('community_light_p1')}</p>
                    <p className="mt-2">
                        {spentPre}<span className="font-semibold text-slate-800 dark:text-slate-100">{t('community_decision')}</span>{spentPost}
                    </p>
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
