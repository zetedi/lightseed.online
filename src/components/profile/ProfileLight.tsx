import { useEffect, useMemo, useState } from 'react';
import { Icons } from '../ui/Icons';
import { fetchMyRays, fetchTreeNames, type HeldRay } from '../../services/firebase/light';
import { RAY_UNITS } from '../../domain/light';

// THE LIGHT FACE — where a being sees the light their witnessed care has kindled. Rays are
// server-minted and holder-private (solitary light is private; ring 2026-07-20), so this face
// can only ever show the viewer their OWN light: the query fails for anyone else by rule.
// Glow (the community commons) is not shown here — glow begins where light circulates, and
// spending does not exist yet; this face is the first visible end of the care-to-light loop.

// A ray is spoken as a hundred (the nights are covered by the mornings).
const spoken = (units: number): string => {
    const whole = Math.floor(units / RAY_UNITS);
    const rest = units % RAY_UNITS;
    if (whole === 0) return `${rest} unit${rest === 1 ? '' : 's'} of light`;
    const rays = `${whole} ray${whole === 1 ? '' : 's'}`;
    return rest ? `${rays} and ${rest} units` : rays;
};

export const ProfileLight = ({ uid }: { uid: string }) => {
    const [rays, setRays] = useState<HeldRay[] | null>(null); // null = still gathering
    const [treeNames, setTreeNames] = useState<Record<string, string>>({});

    useEffect(() => {
        let alive = true;
        fetchMyRays(uid)
            .then(async held => {
                if (!alive) return;
                setRays(held);
                const ids = Array.from(new Set(held.map(r => r.treeId).filter(Boolean)));
                if (ids.length) {
                    const names = await fetchTreeNames(ids);
                    if (alive) setTreeNames(names);
                }
            })
            .catch(() => { if (alive) setRays([]); });
        return () => { alive = false; };
    }, [uid]);

    const total = useMemo(() => (rays || []).reduce((sum, r) => sum + r.units, 0), [rays]);

    if (rays === null) {
        return <div className="p-6 text-center text-sm text-gray-400">The light is gathering…</div>;
    }

    return (
        <div className="space-y-6">
            {/* The glow: brightens with the light held, from a quiet disc to a full shine. */}
            <div className="rounded-2xl border border-amber-100 bg-amber-50/40 p-6">
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
                    <div className="relative flex h-28 w-28 flex-col items-center justify-center rounded-full border border-amber-200 bg-gradient-to-br from-amber-100 to-amber-50">
                        <span className="text-3xl font-semibold text-amber-600">{total}</span>
                        <span className="text-[10px] uppercase tracking-wider text-amber-500">units</span>
                    </div>
                </div>
                <p className="mt-2 text-center text-sm font-medium text-amber-700">{spoken(total)}</p>
                <p className="mt-1 text-center text-xs text-amber-600/70">
                    Only you can see your light. Glow begins where light circulates in a community.
                </p>
            </div>

            {total === 0 ? (
                <div className="rounded-2xl border border-gray-100 p-6 text-center">
                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-amber-50 text-amber-500">
                        <Icons.Sun />
                    </div>
                    <p className="text-sm text-gray-600">No light yet.</p>
                    <p className="mx-auto mt-1 max-w-sm text-xs text-gray-400">
                        Light kindles when a guardian witnesses your daily care of a living tree:
                        water your tree, then a guardian in its Circle presses Witness.
                        Witnessing another&apos;s care earns you a seventh.
                    </p>
                </div>
            ) : (
                <div>
                    <h3 className="mb-2 px-1 text-sm font-semibold text-gray-700">Kindled from care</h3>
                    <div className="space-y-2">
                        {rays.map(ray => (
                            <div key={ray.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-3">
                                <div className="min-w-0">
                                    <p className="truncate text-sm font-medium text-gray-800">
                                        {treeNames[ray.treeId] || 'A tree'}
                                    </p>
                                    <p className="text-xs text-gray-400">{ray.dayKey}</p>
                                </div>
                                <div className="ml-3 flex shrink-0 items-center gap-2">
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                        ray.role === 'carer'
                                            ? 'bg-amber-50 text-amber-600'
                                            : 'bg-sky-50 text-sky-600'
                                    }`}>
                                        {ray.role === 'carer' ? 'your care' : 'your witness'}
                                    </span>
                                    <span className="text-sm font-semibold text-amber-600">+{ray.units}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
