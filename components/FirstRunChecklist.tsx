import React from 'react';
import { Icons } from './ui/Icons';
import type { Lifetree } from '../types';
import type { useOnboardingState } from '../hooks/useOnboardingState';

type OnboardingApi = ReturnType<typeof useOnboardingState>;

interface Step {
  n: number;
  title: string;
  desc: string;
  done: boolean;
  cta: string;
  act: () => void;
  disabled?: boolean;
  manual?: boolean; // can't be derived from data — offer a "mark done" affordance
}

interface Props {
  state: OnboardingApi;
  myTrees: Lifetree[];
  guardedTrees: Lifetree[];
  onPlant: (init?: { type?: 'LIFETREE' | 'GUARDED'; step?: number }) => void;
  onOpenTree: (tree: Lifetree) => void;
  onGoObservatory: () => void;
}

// A live first-run guide rooted in the user's first tree. It REUSES the existing flows (plant,
// watering, circle invite, growth, resonance) — every CTA just opens the real thing, and steps
// tick themselves as the underlying data changes. Rendered as a card above the shell content.
export const FirstRunChecklist = ({ state, myTrees, guardedTrees, onPlant, onOpenTree, onGoObservatory }: Props) => {
  const allTrees = [...myTrees, ...guardedTrees];
  const first = allTrees[0];
  const myFirst = myTrees[0];
  const has = (n: number) => state.completedSteps.includes(n);

  const careSteps: Step[] = [
    { n: 0, title: 'Plant or adopt a tree', desc: 'Begin with a guarded tree to tend together.', done: allTrees.length > 0, cta: 'Plant a tree', act: () => onPlant({ type: 'GUARDED' }) },
    { n: 1, title: 'Set its care rhythm', desc: 'Give it a watering schedule — or mark it self-sustaining.', done: allTrees.some(t => t.watering?.mode), cta: 'Open the tree', act: () => first && onOpenTree(first), disabled: allTrees.length === 0 },
    { n: 2, title: 'Invite a small circle', desc: 'Invite a guardian or two into shared care.', done: myTrees.some(t => !!t.communityId) || has(2), cta: 'Open the tree', act: () => first && onOpenTree(first), disabled: allTrees.length === 0, manual: true },
    { n: 3, title: 'Add a growth moment', desc: 'Snap a photo or emit a growth pulse.', done: allTrees.some(t => (t.blockHeight || 0) > 0) || has(3), cta: 'Open the tree', act: () => first && onOpenTree(first), disabled: allTrees.length === 0, manual: true },
  ];
  const visionSteps: Step[] = [
    { n: 0, title: 'Plant a lifetree', desc: 'Your own living node in the network.', done: myTrees.length > 0, cta: 'Plant a tree', act: () => onPlant({ type: 'LIFETREE' }) },
    { n: 1, title: 'Root a vision', desc: 'A direction of growth for your tree.', done: has(1), cta: 'Open the tree', act: () => myFirst && onOpenTree(myFirst), disabled: myTrees.length === 0, manual: true },
    { n: 2, title: 'Invite participation', desc: 'Invite others to join your vision.', done: has(2), cta: 'Open the tree', act: () => myFirst && onOpenTree(myFirst), disabled: myTrees.length === 0, manual: true },
    { n: 3, title: 'Find a resonance', desc: 'See which visions meet yours in the Observatory.', done: has(3), cta: 'Open Observatory', act: onGoObservatory, manual: true },
  ];

  const choosePath = !state.path;
  const steps = state.path === 'vision' ? visionSteps : careSteps;
  const doneCount = steps.filter(s => s.done).length;
  const allDone = !choosePath && doneCount === steps.length;

  return (
    <div className="mx-auto mb-8 max-w-2xl rounded-3xl border border-emerald-100 bg-white/80 p-6 shadow-xl backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-800">🌱 Welcome to lightseed</h2>
          <p className="mt-0.5 text-sm text-slate-500">{choosePath ? 'How would you like to begin?' : allDone ? 'You are rooted — beautifully done.' : 'A few gentle steps to take root.'}</p>
        </div>
        <button onClick={state.dismiss} title="Maybe later" className="shrink-0 rounded-full px-3 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">Maybe later</button>
      </div>

      {choosePath ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button onClick={() => state.choosePath('care')} className="group rounded-2xl border border-sky-100 bg-sky-50/60 p-5 text-left transition-all hover:border-sky-300 hover:shadow-md">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-sky-600"><Icons.Droplet /></div>
            <h3 className="font-bold text-slate-800">Tend a tree</h3>
            <p className="mt-1 text-xs text-slate-500">Plant or adopt a tree, set its rhythm, and care for it with a small circle.</p>
          </button>
          <button onClick={() => state.choosePath('vision')} className="group rounded-2xl border border-emerald-100 bg-emerald-50/60 p-5 text-left transition-all hover:border-emerald-300 hover:shadow-md">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><Icons.FingerPrint /></div>
            <h3 className="font-bold text-slate-800">Grow a vision</h3>
            <p className="mt-1 text-xs text-slate-500">Root a vision in a tree, invite participation, and let it meet other visions.</p>
          </button>
        </div>
      ) : (
        <>
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
          </div>
          <div className="mt-4 space-y-2">
            {steps.map(s => (
              <div key={s.n} className={`flex items-center gap-3 rounded-2xl border p-3 ${s.done ? 'border-emerald-100 bg-emerald-50/40' : 'border-slate-100 bg-white'}`}>
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${s.done ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {s.done ? '✓' : s.n + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold ${s.done ? 'text-slate-500 line-through' : 'text-slate-800'}`}>{s.title}</p>
                  {!s.done && <p className="text-xs text-slate-500">{s.desc}</p>}
                </div>
                {!s.done && (
                  <div className="flex shrink-0 items-center gap-2">
                    {s.manual && <button onClick={() => state.markStep(s.n)} className="text-[11px] font-medium text-slate-400 hover:text-emerald-600">Mark done</button>}
                    <button onClick={s.act} disabled={s.disabled} className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-40">{s.cta}</button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {allDone && (
            <button onClick={state.dismiss} className="mt-4 w-full rounded-full bg-emerald-600 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition-colors hover:bg-emerald-700">Begin 🌱</button>
          )}
        </>
      )}
    </div>
  );
};
