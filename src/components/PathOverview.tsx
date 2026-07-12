import React from 'react';
import { PATHWAY_RULESET, PATHWAY_STAGES, type PathwayStage } from '../domain/pathway';

// The Path, whole — the Light Path's ruleset laid out as one trail, from first seed to
// sovereign node. Rendered wherever a being wants to see the road rather than only the next
// step (the Light Path card shows one step; this shows the map). Ultimately each community
// will shape its own ruleset; until then this is the node's.

interface PathOverviewProps {
  // The viewer's current stage — walked stages dim to done, the current one glows.
  // Omit for the pure ruleset view (e.g. on a community page).
  current?: PathwayStage;
}

export const PathOverview: React.FC<PathOverviewProps> = ({ current }) => {
  const currentIndex = current ? PATHWAY_STAGES.indexOf(current) : -1;

  return (
    <div className="relative">
      {/* The trail line */}
      <div className="absolute bottom-4 left-[15px] top-4 w-0.5 bg-gradient-to-b from-emerald-200 via-emerald-300 to-amber-300" aria-hidden />

      <ol className="space-y-4">
        {PATHWAY_RULESET.map(({ stage, step }, i) => {
          const stageIndex = PATHWAY_STAGES.indexOf(stage);
          const done = currentIndex > -1 && stageIndex < currentIndex;
          const here = currentIndex > -1 && stageIndex === currentIndex;
          return (
            <li key={step.key} className="relative flex gap-4 pl-0">
              <span
                className={`z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                  done
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : here
                      ? 'border-emerald-500 bg-white text-emerald-600 ring-4 ring-emerald-100'
                      : 'border-slate-200 bg-white text-slate-400'
                }`}
              >
                {done ? '✓' : i + 1}
              </span>
              <div className={`min-w-0 pb-1 ${done ? 'opacity-60' : ''}`}>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">{stage}{here && <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] text-emerald-700">you are here</span>}</p>
                <p className="text-sm font-bold text-slate-800">{step.label}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{step.description}</p>
              </div>
            </li>
          );
        })}

        {/* The summit — sovereign carries no step; the path becomes practice. */}
        <li className="relative flex gap-4">
          <span className={`z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm ${current === 'sovereign' ? 'border-amber-400 bg-amber-400 text-white' : 'border-amber-200 bg-white text-amber-400'}`}>☀</span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-500">sovereign</p>
            <p className="text-sm font-bold text-slate-800">The path is walked</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">A community on its own domain, in its own colours. Nothing left but the practice: keep tending.</p>
          </div>
        </li>
      </ol>

      <p className="mt-6 rounded-xl bg-slate-50 px-4 py-3 text-[11px] leading-relaxed text-slate-400">
        This is the node's ruleset — the trail the Light Path walks you along, one step at a time.
        In time, each community will shape its own path for the beings it welcomes.
      </p>
    </div>
  );
};
