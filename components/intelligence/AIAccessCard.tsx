import React, { useEffect, useState } from 'react';
import { resolveAISource } from '../../services/intelligence';
import { aiSourceLabels, type AIAccessState } from '../../src/domain/aiAccess';
import { Icons } from '../ui/Icons';

// Shows which AI allowance is powering calls right now (your key / community key / sponsored /
// network free-tier), so "what's behind the AI" is never a mystery. Display-only for now.
export const AIAccessCard = ({ intelligenceId, dailyTextUsed }: { intelligenceId?: string; dailyTextUsed?: number }) => {
  const [state, setState] = useState<AIAccessState | null>(null);

  useEffect(() => {
    let alive = true;
    resolveAISource({ intelligenceId, dailyTextUsed }).then(s => { if (alive) setState(s); }).catch(() => {});
    return () => { alive = false; };
  }, [intelligenceId, dailyTextUsed]);

  if (!state) return null;
  const ok = state.allowed;
  return (
    <div className={`flex items-center gap-3 rounded-2xl border p-4 ${ok ? 'border-emerald-100 bg-emerald-50/50' : 'border-amber-200 bg-amber-50'}`}>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${ok ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
        <Icons.Wizard />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-800">{state.label}</p>
        {state.detail && <p className="truncate text-xs text-slate-500">{state.detail}</p>}
      </div>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
        {aiSourceLabels[state.source]}
      </span>
    </div>
  );
};
