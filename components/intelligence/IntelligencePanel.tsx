import React, { useEffect, useRef, useState } from 'react';
import { Icons } from '../ui/Icons';
import { showAlert } from '../ui/Dialog';
import type { Intelligence } from '../../src/domain/intelligence';
import {
  getSelectableIntelligences, createIntelligence, updateIntelligence,
  saveProviderCredential, disconnectProviderCredential, type CredentialScope,
} from '../../services/intelligence';
import { testIntelligenceConnection } from '../../services/gemini';

const CLAUDE_MODELS = [
  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8 — deepest' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 — balanced' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 — fast & light' },
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
  title = 'Your intelligence',
  subtitle = 'Choose whose whispers to listen to. It shapes your matches and answers in your messages.',
}: {
  scope: CredentialScope;
  credentialOwnerId: string;       // uid (user) or communityId (community) — owner of the key
  intelligenceOwnerUid: string;    // uid that owns created intelligence docs
  selectedIntelligenceId?: string;
  onSelect: (intelligenceId: string) => void;
  title?: string;
  subtitle?: string;
}) => {
  const [intelligences, setIntelligences] = useState<Intelligence[]>([]);
  const [showConnect, setShowConnect] = useState(false);
  const [name, setName] = useState(scope === 'community' ? 'Our Claude' : 'Claude');
  const [model, setModel] = useState('claude-sonnet-4-6');
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<{ question: string; reply: string } | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const refresh = () => {
    getSelectableIntelligences(intelligenceOwnerUid).then(setIntelligences).catch(() => {});
  };
  useEffect(refresh, [intelligenceOwnerUid]);

  // The anthropic intelligence already bound to this scope's key, if any.
  const existingClaude = intelligences.find(
    i => i.provider === 'anthropic' && i.credentialOwnerId === credentialOwnerId,
  );

  // Show the walkthrough open by default until Claude is connected, so it's discoverable.
  const inited = useRef(false);
  useEffect(() => {
    if (inited.current || intelligences.length === 0) return;
    inited.current = true;
    if (!existingClaude?.connected) setShowConnect(true);
  }, [intelligences, existingClaude]);

  const handleConnect = async () => {
    if (!apiKey.trim()) { showAlert('Paste your Claude API key first.'); return; }
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
      if (!res.connected) throw new Error('Could not store the key.');
      setApiKey(''); setShowConnect(false);
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

  return (
    <div className="space-y-5">
      <div>
        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800"><Icons.Sparkles /> {title}</h3>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>

      {/* Choose the listening intelligence */}
      <div className="grid gap-2 sm:grid-cols-2">
        {intelligences.map(intel => {
          const active = selectedIntelligenceId === intel.id;
          return (
            <button key={intel.id} type="button" onClick={() => onSelect(intel.id)}
              className={`rounded-2xl border p-3 text-left transition-all ${active ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-bold text-slate-800">{intel.name}</span>
                {active && <span className="text-[10px] font-bold uppercase text-emerald-600">Listening</span>}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500">{PROVIDER_LABEL[intel.provider] || intel.provider}{intel.connected ? ` · key ${intel.keyHint || 'set'}` : ''}</div>
              {intel.description && <div className="mt-1 line-clamp-2 text-xs text-slate-400">{intel.description}</div>}
            </button>
          );
        })}
      </div>

      {/* Test the listening intelligence with a real, genesis-grounded question */}
      <div className="space-y-2">
        <button type="button" onClick={runTest} disabled={testing || !selectedIntelligenceId}
          className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-amber-300 transition-colors hover:bg-slate-800 disabled:opacity-50">
          {testing ? 'Asking…' : '✦ Test with a genesis question'}
        </button>
        {testError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            <p className="font-bold">The intelligence didn’t answer.</p>
            <p className="mt-1 font-mono">{testError}</p>
            <p className="mt-1 text-red-500">If this says “internal”, the Cloud Functions or the <code>ANTHROPIC_API_KEY</code> secret likely aren’t deployed yet.</p>
          </div>
        )}
        {test && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs">
            <p className="font-bold text-emerald-700">✓ It’s alive.</p>
            <p className="mt-1 text-slate-500"><span className="font-semibold">Asked:</span> {test.question}</p>
            <p dir="auto" className="mt-1 italic text-slate-700"><span className="font-semibold not-italic text-emerald-700">Answered:</span> {test.reply}</p>
          </div>
        )}
      </div>

      {/* Connect Claude with your own key */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-amber-300"><Icons.Sparkles /></span>
            <div>
              <div className="text-sm font-bold text-slate-800">Claude {existingClaude?.connected && <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">connected {existingClaude.keyHint}</span>}</div>
              <div className="text-[11px] text-slate-500">Bring your own Anthropic key — {scope === 'community' ? 'the community' : 'you'} pay Anthropic directly, and the whispers are truly yours.</div>
            </div>
          </div>
          <button type="button" onClick={() => setShowConnect(s => !s)} className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100">
            {existingClaude?.connected ? 'Update' : 'Connect'}
          </button>
        </div>

        {showConnect && (
          <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
            <ol className="list-decimal space-y-1 pl-5 text-xs text-slate-500">
              <li>Open <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="font-bold text-emerald-600 underline">console.anthropic.com → API Keys</a> and sign in (or create an account).</li>
              <li>Click <span className="font-semibold">Create Key</span>, name it “Lightseed”, and copy it (it starts with <code className="rounded bg-slate-200 px-1">sk-ant-</code>).</li>
              <li>Add a little credit under <span className="font-semibold">Billing</span> if you haven’t — Claude charges per use.</li>
              <li>Paste the key below. It’s sent straight to our server, stored encrypted, and never shown in your browser again.</li>
            </ol>

            <div className="rounded-lg border border-slate-200 bg-white p-3 text-[11px] leading-relaxed text-slate-500">
              <p className="font-bold text-slate-600">Cost, quota & billing</p>
              <p className="mt-1">Claude is pay-as-you-go: you add credit and Anthropic charges per message — roughly a fraction of a cent (Haiku) up to a few cents (Opus) each, by length and model. New keys start with low rate limits that rise automatically as you spend. You can set a hard monthly spend cap so it can never surprise you.</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <a href="https://console.anthropic.com/settings/billing" target="_blank" rel="noreferrer" className="rounded-full border border-slate-200 px-2 py-0.5 font-bold text-emerald-600 hover:bg-slate-50">Add credit ↗</a>
                <a href="https://console.anthropic.com/settings/usage" target="_blank" rel="noreferrer" className="rounded-full border border-slate-200 px-2 py-0.5 font-bold text-emerald-600 hover:bg-slate-50">Usage & limits ↗</a>
                <a href="https://console.anthropic.com/settings/limits" target="_blank" rel="noreferrer" className="rounded-full border border-slate-200 px-2 py-0.5 font-bold text-emerald-600 hover:bg-slate-50">Set a spend cap ↗</a>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400">Name</span>
                <input value={name} onChange={e => setName(e.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400">Model</span>
                <select value={model} onChange={e => setModel(e.target.value)} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  {CLAUDE_MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </label>
            </div>
            <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-ant-…" autoComplete="off"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            <div className="flex items-center gap-2">
              <button type="button" onClick={handleConnect} disabled={busy} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                {busy ? 'Connecting…' : 'Connect Claude'}
              </button>
              {existingClaude?.connected && (
                <button type="button" onClick={handleDisconnect} disabled={busy} className="rounded-lg px-3 py-2 text-xs font-bold text-red-500 hover:text-red-600 disabled:opacity-50">Disconnect</button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
