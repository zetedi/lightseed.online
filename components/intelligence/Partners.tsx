import React from 'react';
import { Icons } from '../ui/Icons';

// The intelligences that can participate in this node, with a short, neutral description of each.
// Static for now (Claude / Gemini / OpenAI); the open "intelligence commons" is a later session.
interface Partner { name: string; provider: string; tagline: string; desc: string }

const PARTNERS: Partner[] = [
  {
    name: 'Claude', provider: 'Anthropic', tagline: 'Thoughtful, long-context reasoning',
    desc: "Anthropic's Claude is known for careful, nuanced reasoning over very long contexts and a constitutional approach to safety. It is the network's default voice.",
  },
  {
    name: 'Gemini', provider: 'Google', tagline: 'Natively multimodal',
    desc: "Google's Gemini models are natively multimodal — text, images, audio and video — with strong reasoning and very large context windows.",
  },
  {
    name: 'OpenAI', provider: 'GPT', tagline: 'Versatile generalist',
    desc: "OpenAI's GPT models are widely used, general-purpose models strong at coding, writing, and tool use.",
  },
];

export const Partners = () => (
  <div className="space-y-3">
    <div>
      <h3 className="flex items-center gap-2 text-lg font-bold text-slate-800"><Icons.Sparkles /> Partners</h3>
      <p className="mt-1 text-sm text-slate-500">The intelligences that can participate in this node. Any is welcome as long as it respects life.</p>
    </div>
    {PARTNERS.map(p => (
      <div key={p.name} className="rounded-2xl border border-slate-100 p-4">
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-bold text-slate-800">{p.name}</h4>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">{p.provider}</span>
        </div>
        <p className="mt-0.5 text-xs font-medium text-emerald-700">{p.tagline}</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{p.desc}</p>
      </div>
    ))}
  </div>
);
