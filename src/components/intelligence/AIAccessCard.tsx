import { useEffect, useState } from 'react';
import { resolveAISource } from '../../services/intelligence';
import { aiSourceLabels, type AIAccessState } from '../../domain/aiAccess';
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
    <div className={`flex items-center gap-3 rounded-2xl border p-4 ${ok ? 'border-emerald-100 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/30' : 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30'}`}>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${ok ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300'}`}>
        <Icons.Intelligence />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{state.label}</p>
        {state.detail && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{state.detail}</p>}
      </div>
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${ok ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300'}`}>
        {aiSourceLabels[state.source]}
      </span>
    </div>
  );
};
