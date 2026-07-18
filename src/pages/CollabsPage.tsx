import { useEffect, useState } from 'react';
import { Icons } from '../components/ui/Icons';
import { SuperDot } from '../components/ui/SuperDot';
import { SectionHeader } from '../components/ui/SectionHeader';
import { ListBox } from '../components/ui/ListBox';
import { ViewDensityToggle } from '../components/ui/ViewDensityToggle';
import { ImagePicker } from '../components/ui/ImagePicker';
import { useListDensity, type ListDensity } from '../hooks/useListDensity';
import { useImageUpload } from '../hooks/useImageUpload';
import { useLanguage } from '../contexts/LanguageContext';
import { useSession } from '../contexts/SessionContext';
import { showConfirm, showAlert } from '../components/ui/Dialog';
import { getPublicIntelligences, DEFAULT_INTELLIGENCE_ID } from '../services/intelligence';
import { providerLabel } from '../domain/aiAccess';
import {
  getOrgCollabs, addOrgCollab, removeOrgCollab, updateOrgCollab,
  createCommunity, getCommunityById, type OrgCollab,
} from '../services/firebase';
import { isExplicitlyValidatedTree } from '../utils/validation';
import { communityThemePresets } from '../utils/theme';
import { tabTone, CTA_GLOW, type TabTheme } from '../utils/tabTheme';
import type { Intelligence } from '../domain/intelligence';
import type { Community } from '../types';

// Per-provider fallback descriptions, used when an intelligence has no description of its own.
const PROVIDER_BLURB: Record<string, string> = {
  anthropic: "Anthropic's Claude: careful, nuanced reasoning over very long contexts, with a constitutional approach to safety.",
  google: "Google's Gemini: natively multimodal (text, images, audio, video) with strong reasoning and very large context windows.",
  openai: "OpenAI's GPT: versatile, general-purpose models, strong at coding, writing, and tool use.",
  deepseek: "DeepSeek: open-weight models with strong reasoning and coding at low cost.",
  local: "A locally-hosted model running on the node's own compute.",
};

// Providers are rails, not beings. The intelligence itself is the being — it wears its own
// glyph (intel.icon) or the shared /logos/being.svg face — while the provider appears only as
// a small "powered by" badge. Official marks are used strictly as provider badges per their
// brand terms; OpenAI's mark is intentionally absent until obtained from their official brand
// resources (no badge image is shown for it). 'local' rails wear the app's own mark.
const PROVIDER_BADGE: Record<string, string> = {
  anthropic: '/logos/anthropic.svg',
  google: '/logos/google.svg',
  deepseek: '/logos/deepseek.svg',
  local: '/logo.svg',
};

// The default face for any intelligence without its own icon.
const BEING_GLYPH = '/logos/being.svg';

const AGREEMENT_LABEL: Record<OrgCollab['agreement'], string> = {
  founder: 'Founders agreed',
  contract: 'By contract',
};

// Being lists use their own grid map — these are text cards, not image cards.
const gridFor = (d: ListDensity) =>
  d === 'rows' ? 'flex flex-col gap-2.5'
  : d === 'mini' ? 'grid gap-3 grid-cols-2 lg:grid-cols-3'
  : 'grid gap-4 sm:grid-cols-2';

const POP = 'transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg active:-translate-y-0.5 active:shadow-lg';

const slugify = (name: string) =>
  name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'org';

// The Collabs page: this node's collaborators — the AI intelligences configured here, and the
// organisations whose founder(s) agreed to stand here or who hold a place by contract. Two entity
// lists under one menu item, as classic tabs on one coloured box.
export const CollabsPage = ({ theme, onSelectCommunity }: { theme?: TabTheme | null; onSelectCommunity?: (community: Community) => void }) => {
  const { t } = useLanguage();
  const { lightseed, isAdmin, isSuperAdmin, isInitiate, activeTree } = useSession();
  const isStaff = isAdmin || isSuperAdmin;
  // Orgs may be added by any signed-in member whose being is validated, or who is an initiate.
  const canAddOrg = !!lightseed && (isStaff || isInitiate || isExplicitlyValidatedTree(activeTree));
  const tone = tabTone('collab', theme);
  const [density, setDensity] = useListDensity('collabs');
  const [subTab, setSubTab] = useState<'intelligences' | 'organisations'>('intelligences');

  const [list, setList] = useState<Intelligence[] | null>(null);
  const [orgs, setOrgs] = useState<OrgCollab[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: '', url: '', blurb: '', logoUrl: '', agreement: 'founder' as OrgCollab['agreement'] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { uploading, handleImageUpload } = useImageUpload();

  // The grow-a-community flow: which org's inline form is open, and its draft.
  const [growingId, setGrowingId] = useState<string | null>(null);
  const [grow, setGrow] = useState({ name: '', domain: '' });
  const [growBusy, setGrowBusy] = useState(false);
  const [growError, setGrowError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getPublicIntelligences().then(items => { if (alive) setList(items); }).catch(() => { if (alive) setList([]); });
    getOrgCollabs().then(items => { if (alive) setOrgs(items); }).catch(() => { if (alive) setOrgs([]); });
    return () => { alive = false; };
  }, []);

  const handleLogoSelect = async (file: File) => {
    try {
      const url = await handleImageUpload(file, `collabs/${slugify(draft.name)}_${Date.now()}`);
      setDraft(d => ({ ...d, logoUrl: url }));
    } catch (e: any) {
      setError(e?.message || 'Could not upload the logo.');
    }
  };

  const handleAdd = async () => {
    if (busy || !draft.name.trim() || !lightseed) return;
    setBusy(true); setError(null);
    try {
      await addOrgCollab({ ...draft, createdBy: lightseed.uid });
      setOrgs(await getOrgCollabs());
      setDraft({ name: '', url: '', blurb: '', logoUrl: '', agreement: 'founder' });
      setAdding(false);
    } catch (e: any) {
      setError(e?.message || 'Could not add the organisation.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (org: OrgCollab) => {
    if (!(await showConfirm(`Remove ${org.name} from the collabs?`, { title: 'Collabs' }))) return;
    try { await removeOrgCollab(org.id); setOrgs(prev => (prev || []).filter(o => o.id !== org.id)); } catch { /* creator/staff-only; rules refuse others */ }
  };

  // Grow a community out of an org: create it prefilled from the org (name, logo, vision =
  // blurb), then stamp the new communityId back onto the org so its card links there.
  const openGrow = (org: OrgCollab) => {
    setGrowingId(org.id);
    setGrow({ name: org.name, domain: '' });
    setGrowError(null);
  };

  const handleGrow = async (org: OrgCollab) => {
    if (growBusy || !lightseed || !grow.name.trim() || !grow.domain.trim()) return;
    setGrowBusy(true); setGrowError(null);
    try {
      const created = await createCommunity({
        name: grow.name.trim(),
        domain: grow.domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''),
        vision: org.blurb || '',
        imageUrls: [],
        ...(org.logoUrl ? { logoUrl: org.logoUrl } : {}),
        theme: communityThemePresets[0],
        ownerId: lightseed.uid,
      });
      await updateOrgCollab(org.id, { communityId: created.id });
      setOrgs(prev => (prev || []).map(o => o.id === org.id ? { ...o, communityId: created.id } : o));
      setGrowingId(null);
      onSelectCommunity?.(created);
    } catch (e: any) {
      setGrowError(e?.message || 'Could not grow the community.');
    } finally {
      setGrowBusy(false);
    }
  };

  const handleVisit = async (org: OrgCollab) => {
    if (!org.communityId || !onSelectCommunity) return;
    try {
      const community = await getCommunityById(org.communityId);
      if (community) onSelectCommunity(community);
      else showAlert('That community is no longer here.');
    } catch {
      showAlert('Could not open the community.');
    }
  };

  const pad = density === 'mini' ? 'p-3' : 'p-4';
  const blurbClamp = density === 'mini' ? 'line-clamp-2 text-xs' : 'text-sm';

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <SectionHeader
        title={t('collab')}
        tone={tone}
        toggle={<ViewDensityToggle value={density} onChange={setDensity} />}
        action={canAddOrg && subTab === 'organisations' && !adding ? (
          <button onClick={() => setAdding(true)} className={`rounded-full bg-white/15 px-4 py-2 text-xs font-bold text-white backdrop-blur transition-all hover:bg-white/25 active:scale-95 ${CTA_GLOW}`}>
            <span className="flex items-center gap-1.5"><Icons.Plus /> Add organisation</span>
          </button>
        ) : undefined}
      >
        <ListBox
          tone={tone}
          activeTab={subTab}
          onTab={(k) => setSubTab(k as 'intelligences' | 'organisations')}
          tabs={[
            { key: 'intelligences', label: 'Intelligences', icon: <Icons.Wizard />, count: list?.length ?? undefined },
            { key: 'organisations', label: 'Organisations', icon: <Icons.Globe />, count: orgs?.length ?? undefined },
          ]}
        >
        {subTab === 'intelligences' ? (
          <>
            <div className={gridFor(density)}>
              {list === null ? (
                <p className="col-span-full py-10 text-center text-slate-500">Loading…</p>
              ) : list.length === 0 ? (
                <p className="col-span-full py-10 text-center text-slate-500">No intelligences are configured on this node yet.</p>
              ) : list.map(intel => {
                const provider = providerLabel(intel.provider);
                const isDefault = intel.id === DEFAULT_INTELLIGENCE_ID;
                const badge = PROVIDER_BADGE[intel.provider];
                return (
                  <div key={intel.id} className={`rounded-lg border border-slate-100 bg-white ${pad} ${POP}`}>
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="flex min-w-0 items-center gap-2 font-bold text-slate-800">
                        {/* The being's own face, with the provider mark as a small badge — never the other way round. */}
                        <span className="relative shrink-0">
                          <img src={intel.icon || BEING_GLYPH} alt={intel.name} className="h-8 w-8 rounded bg-slate-100/80 p-1.5" />
                          {badge && <img src={badge} alt={provider} className="absolute -bottom-1 -right-1 h-4 w-4 rounded-sm bg-white p-0.5 shadow-sm ring-1 ring-slate-200" />}
                        </span>
                        <span className="truncate">{intel.name}</span>
                        {isDefault && <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">Default voice</span>}
                        {intel.connected && density !== 'mini' && <span className="shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-700">Connected</span>}
                      </h4>
                      {density !== 'mini' && <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">powered by {provider}</span>}
                    </div>
                    <p className={`mt-1 leading-relaxed text-slate-600 ${blurbClamp}`}>{intel.description || PROVIDER_BLURB[intel.provider] || `An intelligence running on ${provider}.`}</p>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          // The org section is the bridge to other regen orgs' worlds — a link through which
          // information flows and their members find the forest. An org stands here first as a
          // card; when it's ready, its creator grows it a community of its own.
          <>
            {canAddOrg && adding && (
              <div className="mb-4 space-y-2.5 rounded-lg border border-violet-100 bg-violet-50/40 p-4">
                <div className="flex items-start gap-3">
                  <ImagePicker onImageSelect={handleLogoSelect} loading={uploading} className="flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg border border-dashed border-violet-200 bg-white text-slate-300 transition-colors hover:border-violet-400 hover:text-violet-400">
                    {draft.logoUrl ? <img src={draft.logoUrl} alt="Logo" className="h-full w-full object-cover" /> : <Icons.Camera />}
                  </ImagePicker>
                  <div className="min-w-0 flex-1 space-y-2.5">
                    <input dir="auto" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="Organisation name"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 outline-none focus:border-violet-300" />
                    <input dir="auto" value={draft.url} onChange={e => setDraft(d => ({ ...d, url: e.target.value }))} placeholder="Website (optional)"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 outline-none focus:border-violet-300" />
                  </div>
                </div>
                <textarea dir="auto" value={draft.blurb} onChange={e => setDraft(d => ({ ...d, blurb: e.target.value }))} rows={2} placeholder="What this collaboration is (optional)"
                  className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 outline-none focus:border-violet-300" />
                <div className="flex flex-wrap items-center gap-2">
                  {(['founder', 'contract'] as const).map(a => (
                    <button key={a} onClick={() => setDraft(d => ({ ...d, agreement: a }))}
                      className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all ${draft.agreement === a ? 'text-white shadow' : 'border border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
                      style={draft.agreement === a ? { backgroundColor: tone } : undefined}>
                      {AGREEMENT_LABEL[a]}
                    </button>
                  ))}
                  <span className="flex-1" />
                  {error && <span className="text-xs text-rose-500">{error}</span>}
                  <button onClick={() => { setAdding(false); setError(null); }} className="rounded-full px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100">Cancel</button>
                  <button onClick={handleAdd} disabled={busy || uploading || !draft.name.trim()} className="rounded-full px-4 py-1.5 text-xs font-bold text-white shadow-md transition-all active:scale-95 disabled:opacity-50" style={{ backgroundColor: tone }}>
                    {busy ? 'Adding…' : 'Add organisation'}
                  </button>
                </div>
              </div>
            )}
            <div className={gridFor(density)}>
              {orgs === null ? (
                <p className="col-span-full py-10 text-center text-slate-500">Loading…</p>
              ) : orgs.length === 0 ? (
                <p className="col-span-full py-10 text-center text-slate-500">No organisations stand here yet.</p>
              ) : orgs.map(org => {
                const isTender = isStaff || (!!lightseed && org.createdBy === lightseed.uid);
                return (
                <div key={org.id} className={`rounded-lg border border-slate-100 bg-white ${pad} ${POP}`}>
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="flex min-w-0 items-center gap-2 font-bold text-slate-800">
                      {org.logoUrl
                        ? <img src={org.logoUrl} alt={org.name} className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                        : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-base font-bold text-violet-700">{org.name.charAt(0).toUpperCase()}</span>}
                      {org.url
                        ? <a href={org.url} target="_blank" rel="noopener noreferrer" className="truncate hover:text-violet-700 hover:underline">{org.name}</a>
                        : <span className="truncate">{org.name}</span>}
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${org.agreement === 'contract' ? 'bg-violet-100 text-violet-700' : 'bg-emerald-100 text-emerald-700'}`}>{AGREEMENT_LABEL[org.agreement]}</span>
                    </h4>
                    {isTender && (
                      <button onClick={() => handleRemove(org)} title="Remove" className="relative shrink-0 rounded-full p-1.5 text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-500"><Icons.Trash />{isStaff && org.createdBy !== lightseed?.uid && <SuperDot />}</button>
                    )}
                  </div>
                  {org.blurb && <p className={`mt-1 leading-relaxed text-slate-600 ${blurbClamp}`}>{org.blurb}</p>}
                  {org.communityId ? (
                    onSelectCommunity && (
                      <button onClick={() => handleVisit(org)} className="mt-2.5 rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white shadow transition-all hover:bg-emerald-700 active:scale-95">
                        Visit community
                      </button>
                    )
                  ) : isTender && growingId !== org.id ? (
                    <button onClick={() => openGrow(org)} className="mt-2.5 rounded-full px-3.5 py-1.5 text-xs font-bold text-white shadow transition-all active:scale-95" style={{ backgroundColor: tone }}>
                      Grow a community
                    </button>
                  ) : null}
                  {growingId === org.id && !org.communityId && (
                    <div className="mt-2.5 space-y-2 rounded-lg border border-violet-100 bg-violet-50/40 p-3">
                      <input dir="auto" value={grow.name} onChange={e => setGrow(g => ({ ...g, name: e.target.value }))} placeholder="Community name"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 outline-none focus:border-violet-300" />
                      <input dir="auto" value={grow.domain} onChange={e => setGrow(g => ({ ...g, domain: e.target.value }))} placeholder="Domain (example.com)"
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-800 outline-none focus:border-violet-300" />
                      <div className="flex items-center gap-2">
                        <span className="flex-1 text-xs text-rose-500">{growError}</span>
                        <button onClick={() => setGrowingId(null)} className="rounded-full px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100">Cancel</button>
                        <button onClick={() => handleGrow(org)} disabled={growBusy || !grow.name.trim() || !grow.domain.trim()}
                          className="rounded-full px-3.5 py-1.5 text-xs font-bold text-white shadow transition-all active:scale-95 disabled:opacity-50" style={{ backgroundColor: tone }}>
                          {growBusy ? 'Growing…' : 'Grow'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          </>
        )}
        </ListBox>
      </SectionHeader>
    </div>
  );
};
