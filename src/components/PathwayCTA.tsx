import { useState } from 'react';
import { derivePathway, type PathwayInput, type PathwayStepKey } from '../domain/pathway';
import { CTA_GLOW } from '../utils/tabTheme';
import { headerSurface } from '../domain/themeSurface';

// The Light Path — the trail's ONE next step, rendered as a single glowing call with a subtle
// progress hint. It replaces the FirstRunChecklist: instead of a card of steps it derives the
// being's stage from live facts (domain/pathway) and offers only what comes next. All actions
// arrive as callbacks from the shell — this component never touches services. Each step is
// dismissable ("Not now", localStorage), so the trail invites without nagging: a dismissed step
// stays quiet, and the next stage brings a fresh, undismissed call. A dismissed path can be
// relit from Profile → Settings (relightPath below).

const STORAGE_KEY = 'lifeseed.pathway.dismissed';
const OFF_KEY = 'lifeseed.pathway.off';

// Is the Light Path lit? (The settings toggle reads this; default is on.)
export const isLightPathOn = (): boolean => {
  try { return window.localStorage.getItem(OFF_KEY) !== 'true'; } catch { return true; }
};

// Turn the Light Path on (also clearing any per-step dismissals, so it truly reappears) or off.
export const setLightPathOn = (on: boolean): void => {
  try {
    if (on) {
      window.localStorage.removeItem(OFF_KEY);
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(OFF_KEY, 'true');
    }
  } catch { /* private mode */ }
};

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
  // Opens the full Path overview (the ruleset) — the label is the door.
  onOpenOverview?: () => void;
}

export const PathwayCTA = ({ input, actions, theme, isDark = false, onOpenOverview }: Props) => {
  const [dismissed, setDismissed] = useState<PathwayStepKey[]>(readDismissed);
  // "Not now" farewell — a brief, self-fading note telling the user where to relight the path.
  // (Dismissal is PER STEP, not the global off toggle, so Settings keeps showing "on"; this
  // message is the bridge between the two.)
  const [farewell, setFarewell] = useState(false);
  const { stageIndex, stageCount, next, stage } = derivePathway(input);

  if (farewell) {
    return (
      <div className="mx-auto max-w-7xl px-4 pt-4 sm:pt-6 animate-in fade-in duration-300">
        <p className="mx-auto max-w-2xl rounded-full border border-emerald-100 bg-emerald-50/80 px-4 py-2 text-center text-xs text-emerald-700">
          🌙 The Light Path rests for this step — relight it anytime in Profile → Settings.
        </p>
      </div>
    );
  }
  if (!isLightPathOn() || !next || dismissed.includes(next.key)) return null;

  const surface = headerSurface(theme, isDark);
  const primary = theme?.primary || '#059669';
  const dotOff = surface.isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)';

  const dismiss = () => {
    const nextDismissed = [...dismissed, next.key];
    setDismissed(nextDismissed);
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextDismissed)); } catch { /* private mode */ }
    setFarewell(true);
    window.setTimeout(() => setFarewell(false), 6000);
  };

  return (
    // The component carries its own page wrapper (padding included), so when the path is off
    // or dismissed the null render leaves NO space behind. Mobile pt-4 matches the dashboard
    // container's own top padding, keeping the card the same distance from the header as the cards.
    <div className="mx-auto max-w-7xl px-4 pt-4 sm:pt-6 animate-in fade-in duration-500">
    <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-4 rounded-3xl border p-5 shadow-xl"
         style={{ backgroundColor: surface.background, color: surface.text, borderColor: surface.border }}>
      <div className="min-w-0 flex-1">
        {/* The membership path (formerly its own About tab) rides here as the label's tooltip —
            the Light Path IS the path, and will ultimately be each community's onboarding ruleset. */}
        <button
          type="button"
          onClick={onOpenOverview}
          className="mb-0.5 block text-[9px] font-bold uppercase tracking-[0.22em] hover:underline"
          style={{ color: primary }}
          title="See the whole path"
        >
          Light Path
        </button>
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
    </div>
  );
};
