// THE ONE SWITCH — every on/off dial in the app. Before this there were two hand-drawn shapes
// (a 20px knob in a padded track, a 16px knob in a bare one) and two greens; a setting read
// differently depending on which panel it lived in. One track, one knob; the hue says whose
// hand it is (violet = a staff hand, the same violet the admin panel wears).
export type SwitchTone = 'emerald' | 'violet';
const ON: Record<SwitchTone, string> = { emerald: 'bg-emerald-500', violet: 'bg-violet-600' };

export const Switch = ({ on, onChange, disabled, tone = 'emerald', title, className = '' }: {
    on: boolean;
    /** Receives the value the switch would move to. */
    onChange: (next: boolean) => void;
    disabled?: boolean;
    tone?: SwitchTone;
    title?: string;
    className?: string;
}) => (
    <button
        type="button"
        role="switch"
        aria-checked={on}
        title={title}
        disabled={disabled}
        onClick={() => onChange(!on)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-50 ${on ? ON[tone] : 'bg-slate-300 dark:bg-slate-700'} ${className}`}
    >
        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform duration-200 ${on ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
);
