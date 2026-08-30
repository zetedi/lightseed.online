import JSZip from 'jszip';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from './core';
import { firestoreStore } from '../../adapters/firestore';
import { getPulsesByTreeId } from './pulses';
import { getCommunityEvents } from './spaces';
import { chainExport, exportFileName, imageEntriesOf, plainify } from '../../domain/export';
import { TRAVEL_PLAN } from '../../domain/bundle';
import type { Community, Lifetree, Pulse } from '../../types';

// THE EXPORT CEREMONY's gathering hands (domain/export holds the laws). Every gatherer
// reads with the ASKING HAND's own sight — the rules decide what each query may see, so an
// export can never carry more than its holder could already read. The archive is one ZIP:
// manifest.json, the being's records as JSON (Stamps as ISO), chains oldest-first with
// their seals verbatim, and the images the records point at (best-effort; the missing are
// named in the manifest, never silently dropped).

const fetchImage = async (url: string): Promise<Blob | null> => {
  try {
    const res = await fetch(url);
    return res.ok ? await res.blob() : null;
  } catch { return null; }
};

const downloadBlob = (blob: Blob, filename: string) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
};

const buildZip = async (
  kind: 'person' | 'tree' | 'community' | 'node',
  name: string,
  files: Record<string, unknown>,
  imageRecords: readonly unknown[],
  notes: string[] = [],
): Promise<void> => {
  const zip = new JSZip();
  const entries = imageEntriesOf(imageRecords);
  const missing: string[] = [];
  for (const entry of entries) {
    const blob = await fetchImage(entry.url);
    if (blob) zip.file(`images/${entry.name}`, blob);
    else missing.push(entry.url);
  }
  const manifest = {
    kind, name,
    exportedAt: new Date().toISOString(),
    files: Object.keys(files).map(f => `${f}.json`),
    imagesIncluded: entries.length - missing.length,
    imagesMissing: missing,
    notes: [
      'Gathered with the exporting hand\'s own sight; the security rules decided what could be read.',
      'Chains are ordered oldest-first with hash/previousHash verbatim; `linked` and `breaks` state their integrity.',
      ...notes,
    ],
  };
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  for (const [fileName, data] of Object.entries(files)) {
    zip.file(`${fileName}.json`, JSON.stringify(plainify(data), null, 2));
  }
  downloadBlob(await zip.generateAsync({ type: 'blob' }), exportFileName(kind, name, Date.now()));
};

// A tree's chain as the export law wants it: raw pulse docs, height-ordered, seals intact.
const treeChain = async (treeId: string) => {
  const pulses = await getPulsesByTreeId(treeId);
  return chainExport(pulses.map((p: Pulse) => ({ ...p, createdAtMs: p.createdAt?.toMillis?.() || 0 })));
};

export const exportTree = async (tree: Lifetree): Promise<void> => {
  const [chain, incoming, outgoing] = await Promise.all([
    treeChain(tree.id), firestoreStore.linksTo(tree.id), firestoreStore.linksFrom(tree.id),
  ]);
  await buildZip('tree', tree.name || tree.id,
    { tree, chain, links: { incoming, outgoing } },
    [tree, chain.blocks]);
};

export const exportCommunity = async (community: Community): Promise<void> => {
  const [incoming, outgoing, events] = await Promise.all([
    firestoreStore.linksTo(community.id), firestoreStore.linksFrom(community.id),
    getCommunityEvents(community.id).catch(() => [] as Pulse[]),
  ]);
  await buildZip('community', community.name,
    { community, links: { incoming, outgoing }, events },
    [community, events],
    ['Covenants, decisions and loves are not yet gathered here.']);
};

export const exportPerson = async (uid: string, displayName?: string | null): Promise<void> => {
  const readDoc = async (path: string) =>
    (await getDoc(doc(db, path)).catch(() => null))?.data() ?? null;
  const readQuery = async (col: string, field: string) =>
    (await getDocs(query(collection(db, col), where(field, '==', uid))).catch(() => null))
      ?.docs.map(d => ({ id: d.id, ...d.data() })) ?? [];

  const [person, user, trees, pulses, linksOut, linksIn, visions, lightHouses] = await Promise.all([
    readDoc(`persons/${uid}`), readDoc(`users/${uid}`),
    readQuery('lifetrees', 'ownerId'),
    readQuery('pulses', 'authorId'),
    firestoreStore.linksFrom(uid), firestoreStore.linksTo(uid),
    readQuery('visions', 'authorId'),
    readQuery('lightHouses', 'ownerId'),
  ]);
  const chains = await Promise.all(
    (trees as { id: string }[]).map(async t => ({ treeId: t.id, ...(await treeChain(t.id)) })));
  // The communities this being stands in — every community the LIN names them toward.
  const communityIds = [...new Set(
    linksOut.filter(l => ['member', 'keeper', 'steward', 'join_request'].includes(l.rel)).map(l => l.to))];
  const communities = (await Promise.all(
    communityIds.map(id => getDoc(doc(db, 'communities', id))
      .then(s => (s.exists() ? { id: s.id, ...s.data() } : null)).catch(() => null))))
    .filter(Boolean);

  await buildZip('person', displayName || (person as { name?: string } | null)?.name || uid,
    {
      person: { uid, person, user },
      trees, chains, pulses,
      links: { outgoing: linksOut, incoming: linksIn },
      visions, communities, lightHouses,
    },
    [person, user, trees, pulses, visions, communities, lightHouses]);
};

// The NODE leaves by its own travel plan (domain/bundle TRAVEL_PLAN): every top-level
// collection the plan names, read with the staff hand's sight. Excluded paths stay home by
// law; refused reads and subcollections are named, not hidden. Images stay URLs here —
// a node's media belongs to its storage migration, not a browser tab.
export const exportNode = async (nodeName: string): Promise<void> => {
  const gathered: Record<string, unknown> = {};
  const refused: string[] = [];
  const skipped: { path: string; reason: string }[] = [];
  for (const rule of TRAVEL_PLAN) {
    if (rule.mode === 'excluded') { skipped.push({ path: rule.path, reason: rule.reason || 'excluded by the travel plan' }); continue; }
    if (rule.path.includes('/')) { skipped.push({ path: rule.path, reason: 'subcollection — not yet gathered by the browser ceremony' }); continue; }
    try {
      const snap = await getDocs(collection(db, rule.path));
      gathered[`collections/${rule.path}`] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch { refused.push(rule.path); }
  }
  await buildZip('node', nodeName,
    { ...gathered, 'travel-plan': { plan: TRAVEL_PLAN, refused, skipped } },
    [],
    ['Images are left as URLs — a node\'s media travels with its storage migration.',
      'Subcollections (loves, occupancy, signatures…) are not yet gathered; the travel plan names them.']);
};
