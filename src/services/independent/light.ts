// THE INDEPENDENT NODE'S HAND for light — the mirror of ../firebase/light.ts (rings 2026-11-01/02).
// Rays, glow, gifts and spends are server-written ledgers read through the document door by the
// law that reads them on the origin node (a ray to its holder, the glow to the signed-in). The
// hands that MOVE light — appreciation, a spend, the testing-phase reset — are the light organ's
// (/v1/light/command, migration 054): the node reads the facts under locks, judges them by the
// domain's own law (domain/spend, domain/light) and moves every unit in one transaction.
import type * as F from '../firebase/light';
import { session } from './core';
import { announce } from '../refreshBus';
import { docGet, docAll } from './docs';
import { getCommunityById, getCommunityByDomain } from './spaces';
import type { Community } from '../../types';
export type { HeldRay, LightMoved, TreePlace } from '../firebase/light';

export const fetchMyRays: typeof F.fetchMyRays = async (uid) =>
    (await docAll<Record<string, unknown>>('rays', { where: { holderUid: uid } })).map(r => ({
        id: r.id as string, lid: String(r.lid || ''), role: (r.role === 'witness' ? 'witness' : 'carer') as 'carer' | 'witness',
        units: typeof r.units === 'number' ? r.units : 0, treeId: String(r.treeId || ''), dayKey: String(r.dayKey || ''), sourceUid: String(r.sourceUid || ''),
        ...(r.communityId ? { communityId: String(r.communityId) } : {}),
    })).sort((a, b) => b.dayKey.localeCompare(a.dayKey) || a.role.localeCompare(b.role));
export const appreciateOffering: typeof F.appreciateOffering = async (offeringId, units) => {
    const moved = await session.lightCommand({ action: 'appreciate', offeringId, units }) as F.LightMoved;
    announce('pulses', offeringId, { offeringSuspendedLight: moved.suspended });
    return moved;
};
export const hasAppreciated: typeof F.hasAppreciated = async (offeringId, uid) => !!(await docGet('gifts', `${offeringId}__${uid}`).catch(() => null));
export const spendGlow: typeof F.spendGlow = async (decisionId) =>
    await session.lightCommand({ action: 'spend', decisionId }) as F.LightMoved & { verifiedSigners: number };
export const resetLight: typeof F.resetLight = async () =>
    await session.lightCommand({ action: 'reset' }) as { rays: number; rayUnits: number; glowHomes: number; glowUnits: number };
export const getGlow: typeof F.getGlow = async (homeId) => {
    const glow = await docGet<{ units?: unknown }>('glow', homeId).catch(() => null);
    return typeof glow?.units === 'number' ? glow.units : 0;
};
export const fetchTreePlaces: typeof F.fetchTreePlaces = async (treeIds) => {
    const out: Record<string, F.TreePlace> = {};
    await Promise.all(treeIds.map(async id => {
        const t = await docGet<{ name?: string; domain?: string; communityId?: string }>('lifetrees', id).catch(() => null);
        if (t) out[id] = { name: String(t.name || ''), domain: String(t.domain || '').toLowerCase(), ...(t.communityId ? { communityId: String(t.communityId) } : {}) };
    }));
    return out;
};
const rememberedPlaces = new Map<string, Promise<Community | null>>();
const placeByKey = (key: string): Promise<Community | null> => {
    let p = rememberedPlaces.get(key);
    if (!p) { p = (key.startsWith('id:') ? getCommunityById(key.slice(3)) : getCommunityByDomain(key.slice(7))).catch(() => null); rememberedPlaces.set(key, p); }
    return p;
};
export const placesOfRays: typeof F.placesOfRays = async (rays, trees) => {
    const keyOf = (r: F.HeldRay): string | null => {
        const cid = r.communityId || trees[r.treeId]?.communityId;
        if (cid) return `id:${cid}`;
        const d = trees[r.treeId]?.domain;
        return d ? `domain:${d}` : null;
    };
    const keys = [...new Set(rays.map(keyOf).filter((k): k is string => !!k))];
    const found = new Map<string, Community | null>();
    await Promise.all(keys.map(async k => { found.set(k, await placeByKey(k)); }));
    return (r) => { const k = keyOf(r); return k ? (found.get(k) ?? null) : null; };
};
export const fetchTreeNames: typeof F.fetchTreeNames = async (treeIds) => {
    const names: Record<string, string> = {};
    await Promise.all(treeIds.map(async id => {
        const t = await docGet<{ name?: unknown }>('lifetrees', id).catch(() => null);
        if (t?.name) names[id] = String(t.name);
    }));
    return names;
};
