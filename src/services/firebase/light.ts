import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './core';
import { getCommunityById, getCommunityByDomain } from './spaces';
import type { Community } from '../../types';

// --- Light: the rays a being holds -----------------------------------------------------------
// Rays are SERVER-MINTED (the witnessWatering callable; functions/src/mint.ts) and holder-private
// by rule: only the holder (or staff) may read them, and no client may write one. Solitary light
// is private (ring 2026-07-20, "Light is a birthright, glow a belonging") — this query only ever
// succeeds for the signed-in holder, so the light face is private by construction, not by UI.

export interface HeldRay {
    id: string;            // rays/{treeId}__{dayKey}__{role} — the deterministic daily-cap id
    lid: string;           // the ray's own UUIDv7 true name
    role: 'carer' | 'witness';
    units: number;
    treeId: string;        // the living being whose caring kindled it
    dayKey: string;        // the UTC day of the care
    sourceUid: string;     // whose care kindled it (the carer)
    communityId?: string;  // provenance, when the tree belongs to one
}

export const fetchMyRays = async (uid: string): Promise<HeldRay[]> => {
    const qs = await getDocs(query(collection(db, 'rays'), where('holderUid', '==', uid)));
    return qs.docs
        .map(d => {
            const r = d.data() as Record<string, unknown>;
            return {
                id: d.id,
                lid: String(r.lid || ''),
                role: (r.role === 'witness' ? 'witness' : 'carer') as 'carer' | 'witness',
                units: typeof r.units === 'number' ? r.units : 0,
                treeId: String(r.treeId || ''),
                dayKey: String(r.dayKey || ''),
                sourceUid: String(r.sourceUid || ''),
                ...(r.communityId ? { communityId: String(r.communityId) } : {}),
            };
        })
        // Newest care first; the carer's ray ahead of the witness's seventh on the same day.
        .sort((a, b) => b.dayKey.localeCompare(a.dayKey) || a.role.localeCompare(b.role));
};

// RESET LIGHT — the testing-phase restart (ring 2026-07-21): empties every ray and every glow.
// Node owner only (the callable enforces it). The care itself stays on the chains; the deleted
// light leaves the trees in better shape, so it is not lost.
export const resetLight = async (): Promise<{ rays: number; rayUnits: number; glowHomes: number; glowUnits: number }> => {
    const fn = httpsCallable(functions, 'resetLight');
    const res = await fn();
    return res.data as { rays: number; rayUnits: number; glowHomes: number; glowUnits: number };
};

// A community's accumulated GLOW — the commons of light gathered where care circulates (the last
// spend, the prism's share, the idle fade all feed it). Server-written, readable by any signed-in
// being. Returns 0 when the community has no glow yet.
export const getGlow = async (homeId: string): Promise<number> => {
    try {
        const snap = await getDoc(doc(db, 'glow', homeId));
        const u = snap.exists() ? (snap.data() as Record<string, unknown>).units : 0;
        return typeof u === 'number' ? u : 0;
    } catch { return 0; }
};

// Names for the trees a holder's light came from (bounded: the distinct trees in their rays).
// A tree now beyond reach (unshared, deleted) keeps a quiet placeholder instead of failing the face.
// THE PLACES OF A BEING'S RAYS (ring 2026-09-19; domain/wallet): a ray names its community
// when the tree was born inside one; an older ray, or a personal tree's, names only the tree,
// whose domain stamp names the place (the same resolution the event card uses). Read once and
// remembered for the session.
export interface TreePlace { name: string; domain: string; communityId?: string }
export const fetchTreePlaces = async (treeIds: string[]): Promise<Record<string, TreePlace>> => {
    const out: Record<string, TreePlace> = {};
    await Promise.all(treeIds.map(async id => {
        try {
            const snap = await getDoc(doc(db, 'lifetrees', id));
            if (!snap.exists()) return;
            const t = snap.data() as { name?: string; domain?: string; communityId?: string };
            out[id] = { name: String(t.name || ''), domain: String(t.domain || '').toLowerCase(), ...(t.communityId ? { communityId: String(t.communityId) } : {}) };
        } catch { /* unreadable tree: its ray rides as the node's light */ }
    }));
    return out;
};
const rememberedPlaces = new Map<string, Promise<Community | null>>();
const placeByKey = (key: string): Promise<Community | null> => {
    let p = rememberedPlaces.get(key);
    if (!p) {
        p = (key.startsWith('id:') ? getCommunityById(key.slice(3)) : getCommunityByDomain(key.slice(7))).catch(() => null);
        rememberedPlaces.set(key, p);
    }
    return p;
};
export const placesOfRays = async (rays: HeldRay[], trees: Record<string, TreePlace>): Promise<(ray: HeldRay) => Community | null> => {
    const keyOf = (r: HeldRay): string | null => {
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

export const fetchTreeNames = async (treeIds: string[]): Promise<Record<string, string>> => {
    const names: Record<string, string> = {};
    await Promise.all(treeIds.map(async id => {
        try {
            const snap = await getDoc(doc(db, 'lifetrees', id));
            const name = snap.exists() ? (snap.data() as Record<string, unknown>).name : null;
            if (name) names[id] = String(name);
        } catch { /* unreadable tree: the ray still shows, unnamed */ }
    }));
    return names;
};
