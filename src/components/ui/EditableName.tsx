import React, { useState } from 'react';
import { Icons } from './Icons';
import { useLanguage } from '../../contexts/LanguageContext';
import { notify } from './Toast';
import { speak, spokenLine, type TranslationKey } from '../../utils/translations';
import type { DomainKey } from '../../domain/words';

// A NAME, EDITABLE IN PLACE (ring 2026-09-07, generalised 2026-09-13). A being's name in its
// hero with a small pencil at its corner; a tap turns the name into a field; Enter or the check
// saves, Escape or the cross lets go. The caller brings the law (what is a name) and the hand
// (how it is saved); this keeps the one shape every being's name is edited in — a person's,
// a tree's — so the two can never look or behave differently.
export interface EditableNameProps {
  name: string | null | undefined;
  /** Without the hand to edit, the name is simply shown. */
  canEdit?: boolean;
  placeholderKey: TranslationKey;
  savedKey: TranslationKey;
  max: number;
  normalize: (raw: string) => string;
  problemOf: (raw: string) => DomainKey | null;
  /** Persist the normalised name; throw (a key or a message) to refuse. */
  onSave: (next: string) => Promise<void>;
}

export const EditableName: React.FC<EditableNameProps> = ({ name, canEdit = true, placeholderKey, savedKey, max, normalize, problemOf, onSave }) => {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const open = () => { setDraft(name || ''); setEditing(true); };
  const close = () => { setEditing(false); setSaving(false); };
  const save = async () => {
    const problem = problemOf(draft);
    if (problem) { notify(spokenLine(problem, { max }), 'error'); return; }
    const next = normalize(draft);
    if (next === (name || '')) { close(); return; }
    setSaving(true);
    try {
      await onSave(next);
      notify(`🌱 ${speak(savedKey)}`);
      close();
    } catch (e: unknown) {
      setSaving(false);
      notify(e instanceof Error && e.message ? speak(e.message) : speak('err_save_retry'), 'error');
    }
  };

  if (!canEdit) return <span dir="auto">{name}</span>;
  if (!editing) {
    return (
      <span className="inline-flex items-center gap-2 align-middle">
        <span dir="auto">{name}</span>
        <button
          type="button"
          onClick={open}
          aria-label={t('edit_name')}
          title={t('edit_name')}
          className="rounded-full p-1 text-white/60 transition-colors hover:bg-white/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
        >
          <Icons.Pencil />
        </button>
      </span>
    );
  }
  return (
    <span className="inline-flex max-w-full items-center gap-2 align-middle">
      <input
        dir="auto"
        autoFocus
        type="text"
        value={draft}
        maxLength={max}
        placeholder={t(placeholderKey)}
        aria-label={t('edit_name')}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void save(); } if (e.key === 'Escape') close(); }}
        disabled={saving}
        className="min-w-0 rounded-lg border border-white/30 bg-black/30 px-3 py-1 text-2xl font-light tracking-wide text-white placeholder-white/50 backdrop-blur focus:outline-none focus:ring-2 focus:ring-emerald-400 md:text-3xl"
      />
      <button type="button" onClick={() => void save()} disabled={saving} aria-label={t('save')} className="rounded-full bg-emerald-500 p-1.5 text-white transition-colors hover:bg-emerald-400 disabled:opacity-50">
        <Icons.ShieldCheck className="h-4 w-4" />
      </button>
      <button type="button" onClick={close} disabled={saving} aria-label={t('cancel')} className="rounded-full bg-white/15 p-1.5 text-white transition-colors hover:bg-white/30 disabled:opacity-50 dark:bg-slate-900/15">
        <Icons.Close />
      </button>
    </span>
  );
};
