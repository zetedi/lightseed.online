import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './core';

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
    treeId: string;        // the living being whose tending kindled it
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

// Names for the trees a holder's light came from (bounded: the distinct trees in their rays).
// A tree now beyond reach (unshared, deleted) keeps a quiet placeholder instead of failing the face.
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
