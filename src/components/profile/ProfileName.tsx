import React, { useState } from 'react';
import { Icons } from '../ui/Icons';
import { useLanguage } from '../../contexts/LanguageContext';
import { useSession } from '../../contexts/SessionContext';
import { renamePerson } from '../../services/firebase';
import { PERSON_NAME_MAX, normalizePersonName, personNameProblem } from '../../domain/personName';
import { notify } from '../ui/Toast';
import { speak, spokenLine } from '../../utils/translations';

// THE NAME, EDITABLE IN PLACE (ring 2026-09-07). The profile hero's title: the being's name
// with a small pencil at its corner. A tap turns the name into a field; Enter or the check
// saves, Escape or the cross lets go. The law (domain/personName) keeps it a name; the service
// moves auth profile and users document together; the session wears it at once.
export const ProfileName: React.FC<{ name: string | null | undefined }> = ({ name }) => {
  const { t } = useLanguage();
  const { setDisplayName } = useSession();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const open = () => { setDraft(name || ''); setEditing(true); };
  const close = () => { setEditing(false); setSaving(false); };
  const save = async () => {
    const problem = personNameProblem(draft);
    if (problem) { notify(spokenLine(problem, { max: PERSON_NAME_MAX }), 'error'); return; }
    const next = normalizePersonName(draft);
    if (next === (name || '')) { close(); return; }
    setSaving(true);
    try {
      await renamePerson(next);
      setDisplayName(next);
      notify(`🌱 ${speak('name_saved')}`);
      close();
    } catch (e: unknown) {
      setSaving(false);
      notify(e instanceof Error && e.message ? speak(e.message) : speak('err_save_retry'), 'error');
    }
  };

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
        maxLength={PERSON_NAME_MAX}
        placeholder={t('name_ph')}
        aria-label={t('edit_name')}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void save(); } if (e.key === 'Escape') close(); }}
        disabled={saving}
        className="min-w-0 rounded-lg border border-white/30 bg-black/30 px-3 py-1 text-2xl font-light tracking-wide text-white placeholder-white/50 backdrop-blur focus:outline-none focus:ring-2 focus:ring-emerald-400 md:text-3xl"
      />
      <button type="button" onClick={() => void save()} disabled={saving} aria-label={t('save')} className="rounded-full bg-emerald-500 p-1.5 text-white transition-colors hover:bg-emerald-400 disabled:opacity-50">
        <Icons.ShieldCheck className="h-4 w-4" />
      </button>
      <button type="button" onClick={close} disabled={saving} aria-label={t('cancel')} className="rounded-full bg-white/15 p-1.5 text-white transition-colors hover:bg-white/30 disabled:opacity-50">
        <Icons.Close />
      </button>
    </span>
  );
};
