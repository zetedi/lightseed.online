import { useState } from 'react';
import { derivePathway, type PathwayInput, type PathwayStepKey } from '../domain/pathway';
import { CTA_GLOW } from '../utils/tabTheme';
import { headerSurface } from '../domain/themeSurface';

// The Pathway CTA — the trail's ONE next step, rendered as a single glowing call with a subtle
// progress hint. It replaces the FirstRunChecklist: instead of a card of steps it derives the
// being's stage from live facts (domain/pathway) and offers only what comes next. All actions
// arrive as callbacks from the shell — this component never touches services. Each step is
// dismissable ("Not now", localStorage), so the trail invites without nagging: a dismissed step
// stays quiet, and the next stage brings a fresh, undismissed call.

const STORAGE_KEY = 'lifeseed.pathway.dismissed';

const readDismissed = (): PathwayStepKey[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed.filter(k => typeof k === 'string') as PathwayStepKey[]) : [];
  } catch {
    return [];
  }
};

// Short button captions — the step's label is the headline, the button stays a verb.
const CAPTIONS: Record<PathwayStepKey, string> = {
  signUp: 'Begin',
  plant: 'Plant',
  tend: 'Tend',
  connect: 'Connect',
  join: 'Join',
  followVision: 'Follow',
  formCircle: 'Invite',
  nameCommunity: 'Name it',
  rootDomain: 'Root it',
  tailorTheme: 'Tailor',
};

interface ThemeLike {
  primary?: string;
  secondary?: string;
  accent?: string;
  neutral?: string;
  background?: string;
  surface?: string;
  text?: string;
}

interface Props {
  input: PathwayInput;
  actions: Record<PathwayStepKey, () => void>;
  theme?: ThemeLike;
  isDark?: boolean;
}

export const PathwayCTA = ({ input, actions, theme, isDark = false }: Props) => {
  const [dismissed, setDismissed] = useState<PathwayStepKey[]>(readDismissed);
  const { stageIndex, stageCount, next, stage } = derivePathway(input);
  if (!next || dismissed.includes(next.key)) return null;

  const surface = headerSurface(theme, isDark);
  const primary = theme?.primary || '#059669';
  const dotOff = surface.isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)';

  const dismiss = () => {
    const nextDismissed = [...dismissed, next.key];
    setDismissed(nextDismissed);
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextDismissed)); } catch { /* private mode */ }
  };

  return (
    <div className="mx-auto mb-6 flex max-w-2xl flex-wrap items-center gap-4 rounded-3xl border p-5 shadow-xl"
         style={{ backgroundColor: surface.background, color: surface.text, borderColor: surface.border }}>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold" style={{ color: surface.text }}>{next.label}</p>
        <p className="mt-0.5 text-xs" style={{ color: surface.muted }}>{next.description}</p>
        <div className="mt-2 flex items-center gap-1" title={`Stage ${stageIndex + 1} of ${stageCount}: ${stage}`}>
          {Array.from({ length: stageCount }, (_, i) => (
            <span key={i} className="h-1.5 w-1.5 rounded-full transition-colors"
                  style={{ backgroundColor: i <= stageIndex ? primary : dotOff }} />
          ))}
          <span className="ml-1.5 text-[10px] font-medium" style={{ color: surface.muted }}>
            {stageIndex + 1}/{stageCount}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button onClick={dismiss} className="rounded-full px-2.5 py-1 text-xs font-medium opacity-70 transition-opacity hover:opacity-100"
                style={{ color: surface.muted }}>
          Not now
        </button>
        <button onClick={actions[next.key]}
                className={`rounded-full px-4 py-2 text-sm font-bold text-white transition-all active:scale-95 ${CTA_GLOW}`}
                style={{ backgroundColor: primary }}>
          {CAPTIONS[next.key]}
        </button>
      </div>
    </div>
  );
};
