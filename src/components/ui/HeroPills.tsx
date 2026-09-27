import { useLanguage } from '../../contexts/LanguageContext';
import { Icons } from './Icons';
import { SuperDot } from './SuperDot';

// THE ONE EDIT AND THE ONE DELETE — shared hero-bar pills so every being's profile wears the
// same hands (Zoltán, 2026-07-22: "Same Edit button. Everywhere btw."). Full label on desktop,
// icon alone on mobile; both sit at the action row's 32px height (px-3 py-2 text-xs).

export const EditPill = ({ onClick, themeColor, title = 'Edit' }: {
    onClick: () => void;
    /** A community-themed header may tint the pill (EventProfile). */
    themeColor?: string;
    title?: string;
}) => {
    const { t } = useLanguage();
    return (
    <button
        onClick={onClick}
        title={title}
        style={themeColor ? { backgroundColor: themeColor } : undefined}
        className="btn-theme flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold shadow-sm ring-1 ring-white/25 transition-all"
    >
        <Icons.Pencil /> <span className="hidden sm:inline">{t('edit')}</span>
    </button>
    );
};

export const DeletePill = ({ onClick, disabled, staffDot, title = 'Delete' }: {
    onClick: () => void;
    disabled?: boolean;
    /** The amber dot: this hand acts by staff role, not ownership. */
    staffDot?: boolean;
    title?: string;
}) => {
    const { t } = useLanguage();
    return (
    <button
        onClick={onClick}
        disabled={disabled}
        title={title}
        aria-label={title}
        className="relative flex items-center gap-1.5 rounded-full border border-red-400/40 bg-red-500/20 px-3 py-2 text-xs font-bold text-red-200 shadow-sm transition-colors hover:bg-red-500 hover:text-white disabled:opacity-50"
    >
        <Icons.Trash /> <span className="hidden sm:inline">{t('delete')}</span>
        {staffDot && <SuperDot />}
    </button>
    );
};

// THE ONE DUPLICATE (ring 2026-09-27): a copy of a being's record, opened for editing at once.
export const DuplicatePill = ({ onClick, disabled, title = 'Duplicate' }: {
    onClick: () => void;
    disabled?: boolean;
    title?: string;
}) => {
    const { t } = useLanguage();
    return (
    <button
        onClick={onClick}
        disabled={disabled}
        title={title}
        aria-label={title}
        className="flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-white/25 disabled:opacity-50 dark:bg-slate-900/10"
    >
        <Icons.Copy /> <span className="hidden sm:inline">{t('event_duplicate')}</span>
    </button>
    );
};
