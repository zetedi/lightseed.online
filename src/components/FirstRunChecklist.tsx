import { Icons } from './ui/Icons';
import type { Lifetree } from '../types';
import type { useOnboardingState } from '../hooks/useOnboardingState';
import { headerSurface } from '../domain/themeSurface';

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
  theme?: any;
  isDark?: boolean;
  onPlant: (init?: { type?: 'LIFETREE' | 'GUARDED'; step?: number }) => void;
  onOpenTree: (tree: Lifetree) => void;
  onGoObservatory: () => void;
}

// A live first-run guide rooted in the user's first tree. It REUSES the existing flows (plant,
// watering, circle invite, growth, resonance) — every CTA just opens the real thing, and steps
// tick themselves as the underlying data changes. Styled to match the community header.
export const FirstRunChecklist = ({ state, myTrees, guardedTrees, theme, isDark = false, onPlant, onOpenTree, onGoObservatory }: Props) => {
  const surface = headerSurface(theme, isDark);
  const primary = theme?.primary || '#059669';
  const accent = theme?.accent || primary;
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

  const rowBg = surface.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)';
  const trackBg = surface.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';

  return (
    <div className="mx-auto mb-8 max-w-2xl rounded-3xl border p-6 shadow-xl"
         style={{ backgroundColor: surface.background, color: surface.text, borderColor: surface.border }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold" style={{ color: surface.text }}>🌱 Welcome to lightseed</h2>
          <p className="mt-0.5 text-sm" style={{ color: surface.muted }}>{choosePath ? 'How would you like to begin?' : allDone ? 'You are rooted — beautifully done.' : 'A few gentle steps to take root.'}</p>
        </div>
        <button onClick={state.dismiss} title="Maybe later" className="shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-opacity hover:opacity-100" style={{ color: surface.muted, opacity: 0.8 }}>Maybe later</button>
      </div>

      {choosePath ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button onClick={() => state.choosePath('care')} className="group rounded-2xl border p-5 text-left transition-all hover:shadow-md"
                  style={{ borderColor: surface.border }}>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full text-white" style={{ backgroundColor: primary }}><Icons.Droplet /></div>
            <h3 className="font-bold" style={{ color: surface.text }}>Tend a tree</h3>
            <p className="mt-1 text-xs" style={{ color: surface.muted }}>Plant or adopt a tree, set its rhythm, and care for it with a small circle.</p>
          </button>
          <button onClick={() => state.choosePath('vision')} className="group rounded-2xl border p-5 text-left transition-all hover:shadow-md"
                  style={{ borderColor: surface.border }}>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full text-white" style={{ backgroundColor: accent }}><Icons.Eye /></div>
            <h3 className="font-bold" style={{ color: surface.text }}>Grow a vision</h3>
            <p className="mt-1 text-xs" style={{ color: surface.muted }}>Root a vision in a tree, invite participation, and let it meet other visions.</p>
          </button>
        </div>
      ) : (
        <>
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: trackBg }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${(doneCount / steps.length) * 100}%`, backgroundColor: primary }} />
          </div>
          <div className="mt-4 space-y-2">
            {steps.map(s => (
              <div key={s.n} className="flex items-center gap-3 rounded-2xl border p-3"
                   style={{ borderColor: surface.border, backgroundColor: s.done ? 'transparent' : rowBg }}>
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                     style={{ backgroundColor: s.done ? primary : (surface.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)') }}>
                  {s.done ? '✓' : s.n + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold ${s.done ? 'line-through opacity-60' : ''}`} style={{ color: surface.text }}>{s.title}</p>
                  {!s.done && <p className="text-xs" style={{ color: surface.muted }}>{s.desc}</p>}
                </div>
                {!s.done && (
                  <div className="flex shrink-0 items-center gap-2">
                    {s.manual && <button onClick={() => state.markStep(s.n)} className="text-[11px] font-medium opacity-70 hover:opacity-100" style={{ color: surface.muted }}>Mark done</button>}
                    <button onClick={s.act} disabled={s.disabled} className="rounded-full px-3 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-40" style={{ backgroundColor: primary }}>{s.cta}</button>
                  </div>
                )}
              </div>
            ))}
          </div>
          {allDone && (
            <button onClick={state.dismiss} className="mt-4 w-full rounded-full py-2.5 text-sm font-bold text-white shadow-lg transition-opacity hover:opacity-90" style={{ backgroundColor: primary }}>Begin 🌱</button>
          )}
        </>
      )}
    </div>
  );
};
