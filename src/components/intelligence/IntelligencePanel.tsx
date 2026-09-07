import { useEffect, useRef, useState } from 'react';
import { Icons } from '../ui/Icons';
import { showAlert } from '../ui/Dialog';
import { useLanguage } from '../../contexts/LanguageContext';
import type { Intelligence } from '../../domain/intelligence';
import {
  getManageableIntelligences, createIntelligence, updateIntelligence,
  saveProviderCredential, disconnectProviderCredential, addIntelligenceMemory, promoteToDefaultVoice, type CredentialScope,
} from '../../services/intelligence';
import { testIntelligenceConnection } from '../../services/gemini';
import { AIAccessCard } from './AIAccessCard';
import { SectionMenu } from '../ui/SectionMenu';

const CLAUDE_MODELS = [
  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8 (deepest)' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5 (balanced)' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (fast & light)' },
];

const PROVIDER_LABEL: Record<string, string> = {
  google: 'Google · Gemini', anthropic: 'Anthropic · Claude', openai: 'OpenAI', deepseek: 'DeepSeek', local: 'Local',
};

/**
 * Choose which intelligence's whispers to listen to, and connect Claude with your own
 * key. Reused for a person (scope 'user') and for a community (scope 'community').
 *
 * The key is never held here — it's posted straight to the saveProviderCredential
 * Cloud Function, which stores it server-side and hands back only a hint.
 */
export const IntelligencePanel = ({
  scope,
  credentialOwnerId,
  intelligenceOwnerUid,
  selectedIntelligenceId,
  onSelect,
  viewerUid,
  canManageAll = false,
  title,
  subtitle,
}: {
  scope: CredentialScope;
  credentialOwnerId: string;       // uid (user) or communityId (community) — owner of the key
  intelligenceOwnerUid: string;    // uid that owns created intelligence docs
  selectedIntelligenceId?: string;
  onSelect: (intelligenceId: string) => void;
  viewerUid?: string;              // the signed-in user (for ownership checks)
  canManageAll?: boolean;          // staff/superadmin — may enable/disable shared intelligences too
  title?: string;
  subtitle?: string;
}) => {
  const { t } = useLanguage();
  const [intelligences, setIntelligences] = useState<Intelligence[]>([]);
  const [openSettings, setOpenSettings] = useState<string | null>(null);
  const [name, setName] = useState(scope === 'community' ? 'Our Claude' : 'Claude');
  const [model, setModel] = useState('claude-sonnet-5');
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<{ question: string; reply: string } | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [memText, setMemText] = useState('');
  const [addingMem, setAddingMem] = useState(false);
  const [promoting, setPromoting] = useState(false);

  const refresh = () => {
    getManageableIntelligences(intelligenceOwnerUid).then(setIntelligences).catch(() => {});
  };
  useEffect(refresh, [intelligenceOwnerUid]);

  const canManage = (intel: Intelligence) => !!viewerUid && (intel.ownerId === viewerUid || canManageAll);

  const toggleEnabled = async (intel: Intelligence) => {
    setTogglingId(intel.id);
    try {
      await updateIntelligence(intel.id, { enabled: intel.enabled === false });
      refresh();
    } catch (e: any) {
      showAlert(e?.message || 'Could not change that intelligence.');
    }
    setTogglingId(null);
  };

  // The anthropic intelligence already bound to this scope's key, if any.
  const existingClaude = intelligences.find(
    i => i.provider === 'anthropic' && i.credentialOwnerId === credentialOwnerId,
  );

  // Show the walkthrough open by default until Claude is connected, so it's discoverable.
  const inited = useRef(false);
  useEffect(() => {
    if (inited.current || intelligences.length === 0) return;
    inited.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot (ref-guarded) discoverability default once intelligences load; not derivable at mount
    if (!existingClaude?.connected) setOpenSettings(existingClaude?.id || 'new');
  }, [intelligences, existingClaude]);

  const handleConnect = async () => {
    if (!apiKey.trim()) { showAlert('intel_key_first'); return; }
    setBusy(true);
    try {
      let intelligenceId = existingClaude?.id;
      if (intelligenceId) {
        await updateIntelligence(intelligenceId, { name: name.trim() || 'Claude', model });
      } else {
        intelligenceId = await createIntelligence({
          name: name.trim() || 'Claude',
          description: scope === 'community' ? 'Claude, connected by the community.' : 'Claude, connected with your own key.',
          provider: 'anthropic',
          model,
          enabled: true,
          public: false,
          ownerId: intelligenceOwnerUid,
          personaId: 'persona-oracle',
          credentialScope: scope,
          credentialOwnerId,
        } as any);
      }
      const res = await saveProviderCredential({ scope, ownerId: credentialOwnerId, provider: 'anthropic', key: apiKey.trim(), intelligenceId });
      if (!res.connected) throw new Error('err_key_store');
      setApiKey(''); setOpenSettings(null);
      refresh();
      onSelect(intelligenceId!);
    } catch (e: any) {
      showAlert(e?.message || 'Could not connect Claude.');
    }
    setBusy(false);
  };

  const runTest = async () => {
    setTesting(true); setTest(null); setTestError(null);
    try {
      setTest(await testIntelligenceConnection(selectedIntelligenceId));
    } catch (e: any) {
      setTestError(e?.message || 'The test call failed.');
    }
    setTesting(false);
  };

  const selected = intelligences.find(i => i.id === selectedIntelligenceId);
  const handleAddMemory = async () => {
    if (!selectedIntelligenceId || !memText.trim()) return;
    setAddingMem(true);
    try {
      const name = memText.trim().split('\n')[0].slice(0, 48) || 'Memory';
      await addIntelligenceMemory(selectedIntelligenceId, name, memText.trim());
      setMemText('');
      refresh();
    } catch (e: any) {
      showAlert(e?.message || 'Could not add to memory.');
    }
    setAddingMem(false);
  };

  // Staff only: rebind the network default ('osiris') to this connected Claude, so every
  // member who hasn't chosen their own voice speaks through it — on this key, network-wide.
  const handleMakeDefault = async () => {
    if (!existingClaude) return;
    setPromoting(true);
    try {
      await promoteToDefaultVoice(existingClaude);
      showAlert(`${existingClaude.name} is now the default voice for everyone on the network. Members who haven't picked their own intelligence will speak through it, on this connected key.`);
      refresh();
    } catch (e: any) {
      showAlert(e?.message || 'Could not set the default voice.');
    }
    setPromoting(false);
  };

  const handleDisconnect = async () => {
    if (!existingClaude) return;
    setBusy(true);
    try {
      await disconnectProviderCredential({ scope, ownerId: credentialOwnerId, provider: 'anthropic', intelligenceId: existingClaude.id });
      refresh();
    } catch (e: any) {
      showAlert(e?.message || 'Could not disconnect.');
    }
    setBusy(false);
  };

  const [panelTab, setPanelTab] = useState<'intelligence' | 'memory'>('intelligence');

  // THE KEY LIVES IN THE CARD (ring 2026-09-08): Claude's name, model and key are set inside
  // its own card — a small gear at the corner opens the drawer — instead of a separate block
  // below the grid. A Claude not yet connected is a dashed card in the same grid.
  const claudeSettings = (
    <div className="mt-3 space-y-3 border-t border-slate-200 pt-3 dark:border-slate-700" onClick={e => e.stopPropagation()}>
      <details className="rounded-lg border border-slate-200 bg-white p-3 text-[11px] leading-relaxed text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
        <summary className="cursor-pointer font-bold text-slate-600 dark:text-slate-300">{t('intel_billing_title')}</summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>{t('intel_step1a')} <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="font-bold text-emerald-600 underline dark:text-emerald-400">console.anthropic.com → API Keys</a> {t('intel_step1b')}</li>
          <li>{t('intel_step2a')} <span className="font-semibold">Create Key</span>{t('intel_step2b')} <code className="rounded bg-slate-200 px-1 dark:bg-slate-700">sk-ant-</code>{t('intel_step2c')}</li>
          <li>{t('intel_step3a')} <span className="font-semibold">Billing</span> {t('intel_step3b')}</li>
          <li>{t('intel_step4')}</li>
        </ol>
        <p className="mt-2">{t('intel_billing_body')}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <a href="https://console.anthropic.com/settings/billing" target="_blank" rel="noreferrer" className="rounded-full border border-slate-200 px-2 py-0.5 font-bold text-emerald-600 hover:bg-slate-50 dark:border-slate-700 dark:text-emerald-400 dark:hover:bg-slate-800">{t('intel_add_credit')} ↗</a>
          <a href="https://console.anthropic.com/settings/usage" target="_blank" rel="noreferrer" className="rounded-full border border-slate-200 px-2 py-0.5 font-bold text-emerald-600 hover:bg-slate-50 dark:border-slate-700 dark:text-emerald-400 dark:hover:bg-slate-800">{t('intel_usage_limits')} ↗</a>
          <a href="https://console.anthropic.com/settings/limits" target="_blank" rel="noreferrer" className="rounded-full border border-slate-200 px-2 py-0.5 font-bold text-emerald-600 hover:bg-slate-50 dark:border-slate-700 dark:text-emerald-400 dark:hover:bg-slate-800">{t('intel_spend_cap')} ↗</a>
        </div>
      </details>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-[10px] font-bold uppercase text-slate-400">{t('intel_name')}</span>
          <input value={name} onChange={e => setName(e.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" />
        </label>
        <label className="space-y-1">
          <span className="text-[10px] font-bold uppercase text-slate-400">{t('intel_model')}</span>
          <select value={model} onChange={e => setModel(e.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
            {CLAUDE_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </label>
      </div>
      <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder={existingClaude?.connected ? `sk-ant-… (${t('intel_connected')} ${existingClaude.keyHint || ''})` : 'sk-ant-…'} autoComplete="off"
        className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" />
      <p className="text-[11px] leading-snug text-slate-400">{t('intel_key_note')}</p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={handleConnect} disabled={busy} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
          {busy ? t('intel_connecting') : existingClaude?.connected ? t('intel_update') : t('intel_connect_claude')}
        </button>
        {existingClaude?.connected && (
          <button type="button" onClick={handleDisconnect} disabled={busy} className="rounded-lg px-3 py-2 text-xs font-bold text-red-500 hover:text-red-600 disabled:opacity-50">{t('intel_disconnect')}</button>
        )}
        <button type="button" onClick={() => setOpenSettings(null)} className="rounded-lg px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">{t('close')}</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-100"><Icons.Intelligence /> {title ?? t('intel_your_title')}</h3>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle ?? t('intel_your_sub')}</p>
      </div>

      <SectionMenu
        orientation="horizontal"
        items={[{ key: 'intelligence', label: t('intel_all'), icon: <Icons.Intelligence /> }, { key: 'memory', label: t('intel_memory_title'), icon: <Icons.Leaf /> }]}
        active={panelTab}
        onSelect={(k) => setPanelTab(k as 'intelligence' | 'memory')}
      />

      {panelTab === 'intelligence' && (<div className="space-y-5">
      {/* What's powering AI right now (your key / community / sponsored / network). */}
      <AIAccessCard intelligenceId={selectedIntelligenceId} />

      {/* Choose the listening intelligence; enable/disable to control consumption; a manageable
          Claude carries its own settings — name, model, key — behind the gear at its corner. */}
      <div className="grid gap-2 sm:grid-cols-2">
        {intelligences.map(intel => {
          const isListening = selectedIntelligenceId === intel.id;
          const isEnabled = intel.enabled !== false;
          const manageable = canManage(intel);
          const hasSettings = manageable && existingClaude?.id === intel.id;
          const settingsOpen = openSettings === intel.id;
          return (
            <div key={intel.id}
              onClick={() => { if (isEnabled) onSelect(intel.id); }}
              className={`rounded-2xl border p-3 transition-all ${settingsOpen ? 'sm:col-span-2' : ''} ${
                isListening ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100 dark:bg-emerald-950/40 dark:ring-emerald-900/50'
                : !isEnabled ? 'border-slate-100 bg-slate-50/50 opacity-70 dark:border-slate-800 dark:bg-slate-900/40'
                : 'cursor-pointer border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-slate-600 dark:hover:bg-slate-800/60'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{intel.name}</span>
                    {isListening ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white"><span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />{t('intel_listening')}</span>
                    ) : !isEnabled ? (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500 dark:bg-slate-700 dark:text-slate-300">{t('intel_disabled_badge')}</span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">{t('intel_enabled_badge')}</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">{PROVIDER_LABEL[intel.provider] || intel.provider}{intel.connected ? ` · key ${intel.keyHint || 'set'}` : ''}</div>
                  {intel.description && <div className="mt-1 line-clamp-2 text-xs text-slate-400">{intel.description}</div>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {hasSettings && (
                    <button type="button" title={t('intel_settings')} aria-label={t('intel_settings')} aria-expanded={settingsOpen}
                      onClick={(e) => { e.stopPropagation(); setOpenSettings(settingsOpen ? null : intel.id); }}
                      className={`rounded-full p-1.5 transition-colors ${settingsOpen ? 'bg-slate-900 text-amber-300 dark:bg-amber-400 dark:text-slate-900' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200'}`}>
                      <Icons.Cog size={16} />
                    </button>
                  )}
                  {manageable && (
                    <button type="button" disabled={togglingId === intel.id}
                      onClick={(e) => { e.stopPropagation(); toggleEnabled(intel); }}
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition-colors disabled:opacity-50 ${isEnabled ? 'bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-red-950/40 dark:hover:text-red-400' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
                      {togglingId === intel.id ? '…' : isEnabled ? t('intel_disable') : t('intel_enable')}
                    </button>
                  )}
                </div>
              </div>
              {hasSettings && settingsOpen && claudeSettings}
            </div>
          );
        })}

        {/* A Claude not yet connected: a dashed card in the same grid, its settings inside. */}
        {!existingClaude && (
          <div className={`rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-3 dark:border-slate-600 dark:bg-slate-900/40 ${openSettings === 'new' ? 'sm:col-span-2' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-amber-300 dark:bg-amber-400 dark:text-slate-900"><Icons.Intelligence /></span>
                <div>
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-100">Claude</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">{scope === 'community' ? t('intel_byo_community') : t('intel_byo_user')}</div>
                </div>
              </div>
              <button type="button" onClick={() => setOpenSettings(openSettings === 'new' ? null : 'new')} className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
                {t('intel_connect')}
              </button>
            </div>
            {openSettings === 'new' && claudeSettings}
          </div>
        )}
      </div>

      <p className="text-[11px] leading-snug text-slate-400">{t('intel_note')}</p>

      {/* Test the listening intelligence with a real, genesis-grounded question */}
      <div className="space-y-2">
        <button type="button" onClick={runTest} disabled={testing || !selectedIntelligenceId}
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-amber-300 transition-colors hover:bg-slate-800 disabled:opacity-50 dark:bg-amber-400 dark:text-slate-900 dark:hover:bg-amber-300">
          {testing ? t('intel_asking') : '✦ ' + t('intel_test')}
        </button>
        {testError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            <p className="font-bold">{t('intel_test_fail')}</p>
            <p className="mt-1 font-mono">{testError}</p>
            <p className="mt-1 text-red-500 dark:text-red-400">{t('intel_test_internal')}</p>
          </div>
        )}
        {test && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs dark:border-emerald-900/50 dark:bg-emerald-950/30">
            <p className="font-bold text-emerald-700 dark:text-emerald-300">✓ {t('intel_alive')}</p>
            <p className="mt-1 text-slate-500 dark:text-slate-400"><span className="font-semibold">{t('intel_asked')}</span> {test.question}</p>
            <p dir="auto" className="mt-1 italic text-slate-700 dark:text-slate-200"><span className="font-semibold not-italic text-emerald-700 dark:text-emerald-300">{t('intel_answered')}</span> {test.reply}</p>
          </div>
        )}
      </div>

      {/* Staff: make this connected Claude the voice every member hears by default. */}
      {canManageAll && existingClaude?.connected && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
          <div className="min-w-0">
            <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{t('intel_default_title').replace('{name}', existingClaude.name)}</div>
            <div className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">{t('intel_default_note')}</div>
          </div>
          <button type="button" onClick={handleMakeDefault} disabled={promoting}
            className="shrink-0 rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-amber-300 transition-colors hover:bg-slate-800 disabled:opacity-50 dark:bg-amber-400 dark:text-slate-900">
            {promoting ? '…' : t('intel_set_default')}
          </button>
        </div>
      )}

      {/* Future: a way to keep the whispers flowing when a key's quota runs high. */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-dashed border-rose-200 bg-rose-50/50 p-3 dark:border-rose-900/50 dark:bg-rose-950/20">
        <p className="text-[11px] leading-snug text-rose-700/80 dark:text-rose-300/80">
          <span className="font-bold">{t('intel_costs_adding')}</span> {t('intel_support_note')}
        </p>
        <button type="button" disabled title={t('intel_support_soon')}
          className="inline-flex shrink-0 cursor-not-allowed items-center gap-1 rounded-full bg-rose-100 px-3 py-1.5 text-[11px] font-bold text-rose-400 dark:bg-rose-950/40 dark:text-rose-400">
          <Icons.Heart filled={false} /> {t('intel_support_soon')}
        </button>
      </div>
      </div>)}

      {/* Memory tab — for the selected intelligence. */}
      {panelTab === 'memory' && (selected ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-900/60">
          <div className="flex items-center justify-between gap-2">
            <h4 className="flex items-center gap-1.5 text-sm font-bold text-slate-800 dark:text-slate-100"><Icons.Leaf /> {t('intel_memory_title')}</h4>
            <span className="text-[11px] text-slate-400">{(selected.memoryIds || []).length} {t('intel_memories')}</span>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-slate-500 dark:text-slate-400">{t('intel_memory_desc')}</p>
          <textarea value={memText} onChange={e => setMemText(e.target.value)} placeholder={t('intel_memory_ph')} className="mt-2 min-h-24 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100" />
          <button type="button" onClick={handleAddMemory} disabled={addingMem || !memText.trim()} className="mt-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">{addingMem ? '…' : t('intel_add_memory')}</button>
        </div>
      ) : (
        <p className="text-sm text-slate-400">{t('intel_choose_memory')}</p>
      ))}
    </div>
  );
};
