// THE INDEPENDENT NODE'S HAND for the export ceremony — the mirror of ../firebase/exportBeing.ts
// (rings 2026-11-01/02). Every gatherer reads with the ASKING HAND's own sight through the node's
// doors (the law decides what each may see), and the archive leaves whole: manifest, records as
// JSON, chains oldest-first with their seals verbatim, and the pictures the records point at.
import type * as F from '../firebase/exportBeing';
import { docGet, docAll } from './docs';
import { graphStore, linksToTree } from './store';
import { getPulsesByTreeId } from './pulses';
import { getCommunityEvents } from './spaces';
import { chainExport, exportFileName, imageEntriesOf, plainify } from '../../domain/export';
import { TRAVEL_PLAN } from '../../domain/bundle';
import { SEED_DOC_COLLECTIONS } from '../../domain/seedDocs.mjs';
import type { Community, Lifetree, Pulse } from '../../types';
import type { DocCollection } from './docs';

const fetchImage = async (url: string): Promise<Blob | null> => {
    try { const res = await fetch(url); return res.ok ? await res.blob() : null; } catch { return null; }
};
const downloadBlob = (blob: Blob, filename: string) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
};
const buildZip = async (kind: 'person' | 'tree' | 'community' | 'node', name: string, files: Record<string, unknown>, imageRecords: readonly unknown[], notes: string[] = []) => {
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    const entries = imageEntriesOf(imageRecords);
    const missing: string[] = [];
    for (const entry of entries) {
        const blob = await fetchImage(entry.url);
        if (blob) zip.file(`images/${entry.name}`, blob); else missing.push(entry.url);
    }
    zip.file('manifest.json', JSON.stringify({
        kind, name, exportedAt: new Date().toISOString(), files: Object.keys(files).map(f => `${f}.json`), imagesIncluded: entries.length - missing.length, imagesMissing: missing,
        notes: ['Gathered with the exporting hand\'s own sight; the node\'s law decided what could be read.',
            'Chains are ordered oldest-first with hash/previousHash verbatim; `linked` and `breaks` state their integrity.', ...notes],
    }, null, 2));
    for (const [fileName, data] of Object.entries(files)) zip.file(`${fileName}.json`, JSON.stringify(plainify(data), null, 2));
    downloadBlob(await zip.generateAsync({ type: 'blob' }), exportFileName(kind, name, Date.now()));
};
const treeChain = async (treeId: string) => {
    const pulses = await getPulsesByTreeId(treeId);
    return chainExport(pulses.map((p: Pulse) => ({ ...p, createdAtMs: p.createdAt?.toMillis?.() || 0 })));
};
export const exportTree: typeof F.exportTree = async (tree) => {
    const [chain, incoming, outgoing] = await Promise.all([treeChain(tree.id), linksToTree(tree), graphStore.linksFrom(tree.id)]);
    await buildZip('tree', tree.name || tree.id, { tree, chain, links: { incoming, outgoing } }, [tree, chain.blocks]);
};
export const exportCommunity: typeof F.exportCommunity = async (community) => {
    const [incoming, outgoing, events] = await Promise.all([graphStore.linksTo(community.id), graphStore.linksFrom(community.id), getCommunityEvents(community.id).catch(() => [] as Pulse[])]);
    await buildZip('community', community.name, { community, links: { incoming, outgoing }, events }, [community, events], ['Covenants, decisions and loves are not yet gathered here.']);
};
export const exportPerson: typeof F.exportPerson = async (uid, displayName) => {
    const quiet = <T>(p: Promise<T>, fallback: T) => p.catch(() => fallback);
    const [person, user, trees, pulses, linksOut, linksIn, visions, lightHouses] = await Promise.all([
        quiet(docGet('persons', uid), null), quiet(docGet('users', uid), null),
        quiet(docAll<Lifetree>('lifetrees', { where: { anchorUid: uid } }), []), quiet(docAll<Pulse>('pulses', { where: { authorId: uid } }), []),
        graphStore.linksFrom(uid), graphStore.linksTo(uid),
        quiet(docAll('visions', { where: { authorId: uid } }), []), quiet(docAll('light_houses', { where: { anchorUid: uid } }), []),
    ]);
    const chains = await Promise.all(trees.map(async t => ({ treeId: t.id, ...(await treeChain(t.id)) })));
    const communityIds = [...new Set(linksOut.filter(l => ['member', 'keeper', 'steward', 'join_request'].includes(l.rel)).map(l => l.to))];
    const communities = (await Promise.all(communityIds.map(id => docGet<Community>('communities', id).catch(() => null)))).filter(Boolean);
    await buildZip('person', displayName || (person as { displayName?: string } | null)?.displayName || uid,
        { person: { uid, person, user }, trees, chains, pulses, links: { outgoing: linksOut, incoming: linksIn }, visions, communities, lightHouses },
        [person, user, trees, pulses, visions, communities, lightHouses]);
};
// The NODE leaves by its travel plan, read with the staff hand's sight through the door; what the
// door does not serve, and what the plan excludes, is named — never hidden.
export const exportNode: typeof F.exportNode = async (nodeName) => {
    const gathered: Record<string, unknown> = {};
    const refused: string[] = [];
    const skipped: { path: string; reason: string }[] = [];
    for (const rule of TRAVEL_PLAN) {
        if (rule.mode === 'excluded') { skipped.push({ path: rule.path, reason: rule.reason || 'excluded by the travel plan' }); continue; }
        if (rule.path.includes('/')) { skipped.push({ path: rule.path, reason: 'subcollection — not yet gathered by the browser ceremony' }); continue; }
        const name = rule.path.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
        if (rule.path === 'links' || rule.path === 'secretLinks') {
            try { gathered[`collections/${rule.path}`] = rule.path === 'links' ? await graphStore.linksByRel('member') : []; } catch { refused.push(rule.path); }
            if (rule.path === 'links') skipped.push({ path: 'links', reason: 'the browser gathers the member edges only; the whole LIN travels with the node bundle (seed:export)' });
            continue;
        }
        if (!(name in SEED_DOC_COLLECTIONS)) { skipped.push({ path: rule.path, reason: 'served by its own door, gathered with the node bundle (seed:export)' }); continue; }
        try { gathered[`collections/${rule.path}`] = await docAll(name as DocCollection, {}, 50); } catch { refused.push(rule.path); }
    }
    await buildZip('node', nodeName, { ...gathered, 'travel-plan': { plan: TRAVEL_PLAN, refused, skipped } }, [],
        ['Images are left as URLs — a node\'s media travels with its storage migration.', 'The signed node bundle for a crossing is made by the installation (seed:export), not a browser tab.']);
};
