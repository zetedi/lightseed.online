import React, { useEffect, useState } from 'react';
import { Icons } from '../ui/Icons';
import { getPublicIntelligences, DEFAULT_INTELLIGENCE_ID } from '../../services/intelligence';
import { providerLabel } from '../../src/domain/aiAccess';
import type { Intelligence } from '../../src/domain/intelligence';

// Per-provider fallback descriptions, used when an intelligence has no description of its own.
const PROVIDER_BLURB: Record<string, string> = {
  anthropic: "Anthropic's Claude — careful, nuanced reasoning over very long contexts, with a constitutional approach to safety.",
  google: "Google's Gemini — natively multimodal (text, images, audio, video) with strong reasoning and very large context windows.",
  openai: "OpenAI's GPT — versatile, general-purpose models, strong at coding, writing, and tool use.",
  deepseek: "DeepSeek — open-weight models with strong reasoning and coding at low cost.",
  local: "A locally-hosted model running on the node's own compute.",
};

// The AIs actually configured on this node (pulled live from the public intelligences), with a
// short description of each. Replaces the old static list.
export const Partners = () => {
  const [list, setList] = useState<Intelligence[] | null>(null);

  useEffect(() => {
    let alive = true;
    getPublicIntelligences().then(items => { if (alive) setList(items); }).catch(() => { if (alive) setList([]); });
    return () => { alive = false; };
  }, []);

  return (
    <div className="space-y-3">
      <div>
        <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800"><Icons.Sparkles /> Partners</h3>
        <p className="mt-1 text-sm text-slate-500">The intelligences configured on this node. Any is welcome as long as it respects life.</p>
      </div>
      {list === null ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-slate-400">No intelligences are configured on this node yet.</p>
      ) : list.map(intel => {
        const provider = providerLabel(intel.provider);
        const isDefault = intel.id === DEFAULT_INTELLIGENCE_ID;
        return (
          <div key={intel.id} className="rounded-2xl border border-slate-100 p-4">
            <div className="flex items-center justify-between gap-2">
              <h4 className="flex items-center gap-2 font-bold text-slate-800">
                {intel.name}
                {isDefault && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">Default voice</span>}
                {intel.connected && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-700">Connected</span>}
              </h4>
              <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">{provider}</span>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">{intel.description || PROVIDER_BLURB[intel.provider] || `An intelligence running on ${provider}.`}</p>
          </div>
        );
      })}
    </div>
  );
};
