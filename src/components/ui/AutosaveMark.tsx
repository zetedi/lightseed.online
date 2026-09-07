import type { AutosaveState } from '../../domain/autosave';
import { useLanguage } from '../../contexts/LanguageContext';

// The small word beside a live-edited section: the change is waiting, riding, landed, or
// refused. Silent while nothing has changed.
export const AutosaveMark = ({ state }: { state: AutosaveState }) => {
  const { t } = useLanguage();
  if (state === 'idle') return null;
  const tone = state === 'error' ? 'text-red-500' : state === 'saved' ? 'text-emerald-600' : 'text-slate-400';
  const word = state === 'pending' ? '…' : state === 'saving' ? t('saving') : state === 'saved' ? `✓ ${t('autosaved')}` : t('err_autosave');
  return <span role="status" aria-live="polite" className={`text-xs font-semibold ${tone}`}>{word}</span>;
};
