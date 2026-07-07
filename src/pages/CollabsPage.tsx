import React, { useEffect, useState } from 'react';
import { Icons } from '../components/ui/Icons';
import { SectionHeader } from '../components/ui/SectionHeader';
import { ListBox } from '../components/ui/ListBox';
import { ViewDensityToggle } from '../components/ui/ViewDensityToggle';
import { useListDensity, type ListDensity } from '../hooks/useListDensity';
import { useLanguage } from '../contexts/LanguageContext';
import { useSession } from '../contexts/SessionContext';
import { showConfirm } from '../components/ui/Dialog';
import { getPublicIntelligences, DEFAULT_INTELLIGENCE_ID } from '../services/intelligence';
import { providerLabel } from '../domain/aiAccess';
import { getOrgCollabs, addOrgCollab, removeOrgCollab, type OrgCollab } from '../services/firebase';
import { tabTone, CTA_GLOW, type TabTheme } from '../utils/tabTheme';
import type { Intelligence } from '../domain/intelligence';

// Per-provider fallback descriptions, used when an intelligence has no description of its own.
const PROVIDER_BLURB: Record<string, string> = {
  anthropic: "Anthropic's Claude — careful, nuanced reasoning over very long contexts, with a constitutional approach to safety.",
  google: "Google's Gemini — natively multimodal (text, images, audio, video) with strong reasoning and very large context windows.",
  openai: "OpenAI's GPT — versatile, general-purpose models, strong at coding, writing, and tool use.",
  deepseek: "DeepSeek — open-weight models with strong reasoning and coding at low cost.",
  local: "A locally-hosted model running on the node's own compute.",
};

const AGREEMENT_LABEL: Record<OrgCollab['agreement'], string> = {
  founder: 'Founders agreed',
  contract: 'By contract',
};

// Entity lists use their own grid map — these are text cards, not image cards.
const gridFor = (d: ListDensity) =>
  d === 'rows' ? 'flex flex-col gap-2.5'
  : d === 'mini' ? 'grid gap-3 grid-cols-2 lg:grid-cols-3'
  : 'grid gap-4 sm:grid-cols-2';

const POP = 'transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg active:-translate-y-0.5 active:shadow-lg';

// The Collabs page: this node's collaborators — the AI intelligences configured here, and the
// organisations whose founder(s) agreed to stand here or who hold a place by contract. Two entity
// lists under one menu item, as classic tabs on one coloured box.
export const CollabsPage = ({ theme }: { theme?: TabTheme | null }) => {
  const { t } = useLanguage();
  const { isAdmin, isSuperAdmin } = useSession();
  const isStaff = isAdmin || isSuperAdmin;
  const tone = tabTone('collab', theme);
  const [density, setDensity] = useListDensity('collabs');
  const [subTab, setSubTab] = useState<'intelligences' | 'organisations'>('intelligences');

  const [list, setList] = useState<Intelligence[] | null>(null);
  const [orgs, setOrgs] = useState<OrgCollab[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: '', url: '', blurb: '', agreement: 'founder' as OrgCollab['agreement'] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getPublicIntelligences().then(items => { if (alive) setList(items); }).catch(() => { if (alive) setList([]); });
    getOrgCollabs().then(items => { if (alive) setOrgs(items); }).catch(() => { if (alive) setOrgs([]); });
    return () => { alive = false; };
  }, []);

  const handleAdd = async () => {
    if (busy || !draft.name.trim()) return;
    setBusy(true); setError(null);
    try {
      await addOrgCollab(draft);
      setOrgs(await getOrgCollabs());
      setDraft({ name: '', url: '', blurb: '', agreement: 'founder' });
      setAdding(false);
    } catch (e: any) {
      setError(e?.message || 'Could not add the organisation.');
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (org: OrgCollab) => {
    if (!(await showConfirm(`Remove ${org.name} from the collabs?`, { title: 'Collabs' }))) return;
    try { await removeOrgCollab(org.id); setOrgs(prev => (prev || []).filter(o => o.id !== org.id)); } catch { /* staff-only; rules refuse others */ }
  };

  const pad = density === 'mini' ? 'p-3' : 'p-4';
  const blurbClamp = density === 'mini' ? 'line-clamp-2 text-xs' : 'text-sm';

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
      <SectionHeader
        title={t('collab')}
        tone={tone}
        toggle={<ViewDensityToggle value={density} onChange={setDensity} />}
        action={isStaff && subTab === 'organisations' && !adding ? (
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
                return (
                  <div key={intel.id} className={`rounded-lg border border-slate-100 bg-white ${pad} ${POP}`}>
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="flex min-w-0 items-center gap-2 font-bold text-slate-800">
                        <span className="truncate">{intel.name}</span>
                        {isDefault && <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">Default voice</span>}
                        {intel.connected && density !== 'mini' && <span className="shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-700">Connected</span>}
                      </h4>
                      {density !== 'mini' && <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">{provider}</span>}
                    </div>
                    <p className={`mt-1 leading-relaxed text-slate-600 ${blurbClamp}`}>{intel.description || PROVIDER_BLURB[intel.provider] || `An intelligence running on ${provider}.`}</p>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <>
            {isStaff && adding && (
              <div className="mb-4 space-y-2.5 rounded-lg border border-violet-100 bg-violet-50/40 p-4">
                <input dir="auto" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} placeholder="Organisation name"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 outline-none focus:border-violet-300" />
                <input dir="auto" value={draft.url} onChange={e => setDraft(d => ({ ...d, url: e.target.value }))} placeholder="Website (optional)"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-800 outline-none focus:border-violet-300" />
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
                  <button onClick={handleAdd} disabled={busy || !draft.name.trim()} className="rounded-full px-4 py-1.5 text-xs font-bold text-white shadow-md transition-all active:scale-95 disabled:opacity-50" style={{ backgroundColor: tone }}>
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
              ) : orgs.map(org => (
                <div key={org.id} className={`rounded-lg border border-slate-100 bg-white ${pad} ${POP}`}>
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="flex min-w-0 items-center gap-2 font-bold text-slate-800">
                      {org.url
                        ? <a href={org.url} target="_blank" rel="noopener noreferrer" className="truncate hover:text-violet-700 hover:underline">{org.name}</a>
                        : <span className="truncate">{org.name}</span>}
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${org.agreement === 'contract' ? 'bg-violet-100 text-violet-700' : 'bg-emerald-100 text-emerald-700'}`}>{AGREEMENT_LABEL[org.agreement]}</span>
                    </h4>
                    {isStaff && (
                      <button onClick={() => handleRemove(org)} title="Remove" className="shrink-0 rounded-full p-1.5 text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-500"><Icons.Trash /></button>
                    )}
                  </div>
                  {org.blurb && <p className={`mt-1 leading-relaxed text-slate-600 ${blurbClamp}`}>{org.blurb}</p>}
                </div>
              ))}
            </div>
          </>
        )}
        </ListBox>
      </SectionHeader>
    </div>
  );
};
