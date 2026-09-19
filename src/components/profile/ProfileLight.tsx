import { useEffect, useMemo, useState } from 'react';
import { Icons } from '../ui/Icons';
import { fetchMyRays, fetchTreePlaces, placesOfRays, type HeldRay, type TreePlace } from '../../services/firebase/light';
import { walletOf, type WalletRow } from '../../domain/wallet';
import { formatLight } from '../../domain/light';
import { charter } from '../../config/charter';
import { Picture } from '../ui/Picture';
import { RAY_UNITS } from '../../domain/light';
import { useLanguage } from '../../contexts/LanguageContext';
import { say, speak, spokenLine } from '../../utils/translations';
import { useCoin } from '../../hooks/useCoin';

// THE LIGHT FACE — where a being sees the light their witnessed care has kindled. Rays are
// server-minted and holder-private (solitary light is private; ring 2026-07-20), so this face
// can only ever show the viewer their OWN light: the query fails for anyone else by rule.
// Glow (the community commons) is not shown here — glow begins where light circulates, and
// spending does not exist yet; this face is the first visible end of the care-to-light loop.

// A ray is spoken as 108, the geometry of light (the nights are covered by the mornings).
// Spoken through the translation keys so every language counts its own light.
const spoken = (units: number, coin: string): string => {
    const whole = Math.floor(units / RAY_UNITS);
    const rest = units % RAY_UNITS;
    if (whole === 0) return speak(spokenLine('light_units', { n: rest, coin }));
    const rays = speak(spokenLine('light_rays', { n: whole }));
    return rest ? speak(spokenLine('light_rays_and_units', { rays, n: rest })) : rays;
};

export const ProfileLight = ({ uid }: { uid: string }) => {
    const { t } = useLanguage();
    const coin = useCoin();
    const [rays, setRays] = useState<HeldRay[] | null>(null); // null = still gathering
    const [trees, setTrees] = useState<Record<string, TreePlace>>({});
    // THE COINS (ring 2026-09-19; domain/wallet): one row per place the rays were kindled in.
    const [wallet, setWallet] = useState<WalletRow[]>([]);

    useEffect(() => {
        let alive = true;
        fetchMyRays(uid)
            .then(async held => {
                if (!alive) return;
                setRays(held);
                const ids = Array.from(new Set(held.map(r => r.treeId).filter(Boolean)));
                const places = ids.length ? await fetchTreePlaces(ids) : {};
                if (!alive) return;
                setTrees(places);
                const placeOf = await placesOfRays(held, places);
                if (alive) setWallet(walletOf(held, placeOf, { name: charter.name, domain: charter.domain }));
            })
            .catch(() => { if (alive) setRays([]); });
        return () => { alive = false; };
    }, [uid]);

    const total = useMemo(() => (rays || []).reduce((sum, r) => sum + r.units, 0), [rays]);

    if (rays === null) {
        return <div className="p-6 text-center text-sm text-gray-400">{say('light_gathering', { coin: coin.name })}</div>;
    }

    return (
        <div className="space-y-6">
            {/* The glow: brightens with the light held, from a quiet disc to a full shine. */}
            <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-6 dark:border-amber-900 dark:bg-amber-950/40">
                <div className="relative flex items-center justify-center py-4">
                    {total > 0 && (
                        <>
                            <div
                                className="absolute h-44 w-44 rounded-full bg-amber-300 blur-2xl"
                                style={{ opacity: Math.min(0.45, 0.12 + total / 2000) }}
                            />
                            <div
                                className="absolute h-28 w-28 rounded-full bg-amber-200 blur-xl"
                                style={{ opacity: Math.min(0.7, 0.25 + total / 1500) }}
                            />
                        </>
                    )}
                    <div className="relative flex h-28 w-28 flex-col items-center justify-center rounded-full border border-amber-200 bg-gradient-to-br from-amber-100 to-amber-50 dark:border-amber-900">
                        <span className="text-3xl font-semibold text-amber-600 dark:text-amber-300">{total}</span>
                        <span className="text-[10px] uppercase tracking-wider text-amber-500">{t('units')}</span>
                    </div>
                </div>
                <p className="mt-2 text-center text-sm font-medium text-amber-700 dark:text-amber-300">{wallet.length > 1 ? say('wallet_coins', { n: wallet.length }) : spoken(total, wallet[0]?.coin.name || coin.name)}</p>
                <p className="mt-1 text-center text-xs text-amber-600/70">{t('light_private_note')}</p>
            </div>

            {total === 0 ? (
                <div className="rounded-2xl border border-gray-100 p-6 text-center dark:border-slate-800">
                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-500 dark:bg-amber-950/40">
                        <Icons.Sun />
                    </div>
                    <p className="text-sm text-gray-600">{say('no_light', { coin: coin.name })}</p>
                    <p className="mx-auto mt-1 max-w-sm text-xs text-gray-400">{t('light_kindles_note')}</p>
                </div>
            ) : (
                <div>
                    {wallet.length > 0 && (
                        <div className="mb-5 space-y-2">
                            {wallet.map(row => (
                                <div key={row.key} className="flex items-center gap-3 rounded-2xl border border-amber-100 bg-white p-3 dark:border-amber-900 dark:bg-slate-900">
                                    {row.coin.logoUrl
                                        ? <Picture size={480} src={row.coin.logoUrl} alt="" className="h-10 w-10 shrink-0 rounded-full border-2 border-amber-200 object-cover" />
                                        : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-950/40"><Icons.Sun /></span>}
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{row.coin.name}</p>
                                        <p className="truncate text-[11px] text-slate-400">{[row.placeName, row.place].filter(Boolean).join(' · ')}</p>
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <p className="text-sm font-semibold text-amber-600 dark:text-amber-300">{formatLight(row.units, row.coin)}</p>
                                        <p dir="ltr" className="text-[10px] font-mono uppercase text-slate-400">{row.coin.code} · {row.units}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <h3 className="mb-2 px-1 text-sm font-semibold text-gray-700 dark:text-slate-200">{t('kindled_from_care')}</h3>
                    <div className="space-y-2">
                        {rays.map(ray => (
                            <div key={ray.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-3 dark:bg-slate-900 dark:border-slate-800">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-gray-800 dark:text-slate-100">
                                        {trees[ray.treeId]?.name || t('a_tree')}
                                    </p>
                                    <p className="text-xs text-gray-400">{ray.dayKey}</p>
                                </div>
                                <div className="ml-3 flex shrink-0 items-center gap-2">
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                        ray.role === 'carer'
                                            ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300'
                                            : 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300'
                                    }`}>
                                        {ray.role === 'carer' ? t('ray_your_care') : t('ray_your_witness')}
                                    </span>
                                    <span className="text-sm font-semibold text-amber-600 dark:text-amber-300">+{ray.units}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
