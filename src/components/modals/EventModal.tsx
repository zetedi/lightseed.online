import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Icons } from '../ui/Icons';
import { ImagePicker } from '../ui/ImagePicker';
import { showAlert } from '../ui/Dialog';
import { useLanguage } from '../../contexts/LanguageContext';
import { visibilitiesForScope, type PulseScope } from '../../domain/pulseVisibility';
import type { Pulse, PulseVisibility } from '../../domain/pulse';

/**
 * Plant a standalone event — anyone can, no community required. A community can later form
 * around it. On submit it becomes a pulse of type 'event' on the chain. Pass `event` to edit
 * an existing one (prefilled; authorship is preserved). `scope` drives the visibility options.
 */
export const EventModal = ({
  lightseed,
  onClose,
  onCreate,
  uploading,
  handleImageUpload,
  event = null,
  scope = 'node',
}: {
  lightseed: any;
  onClose: () => void;
  onCreate: (data: any) => Promise<void>;
  uploading?: boolean;
  handleImageUpload: (file: File, path: string) => Promise<string>;
  event?: Pulse | null;
  scope?: PulseScope;
}) => {
  const { t } = useLanguage();
  const isEdit = !!event;
  const [title, setTitle] = useState(event?.title || '');
  const [date, setDate] = useState(event?.eventDate || '');
  const [location, setLocation] = useState(event?.eventLocation || '');
  const [body, setBody] = useState(event?.content || event?.body || '');
  const [visibility, setVisibility] = useState<PulseVisibility>((event?.visibility as PulseVisibility) || 'public');
  const [imageUrls, setImageUrls] = useState<string[]>(event?.imageUrls?.length ? event.imageUrls : (event?.imageUrl ? [event.imageUrl] : []));
  const [saving, setSaving] = useState(false);

  const addImage = async (file: File) => {
    try {
      const url = await handleImageUpload(file, `events/${lightseed?.uid || 'anon'}/${Date.now()}`);
      if (url) setImageUrls(prev => [...prev, url]);
    } catch (e: any) {
      showAlert(e?.message || 'Failed to upload image.');
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || saving || !lightseed) return;
    setSaving(true);
    try {
      const base = {
        title: title.trim(),
        body: body.trim(),
        content: body.trim(),
        imageUrl: imageUrls[0] || '',
        imageUrls,
        eventDate: date || '',
        eventLocation: location.trim(),
        visibility,
      };
      // On edit, never overwrite authorship (an admin editing another's event keeps the author).
      await onCreate(isEdit ? base : {
        ...base,
        authorId: lightseed.uid,
        authorName: lightseed.displayName || 'Soul',
        authorPhoto: lightseed.photoURL || undefined,
      });
      onClose();
    } catch (err: any) {
      showAlert(err?.message || 'Could not save the event.');
    }
    setSaving(false);
  };

  return (
    <Modal title={isEdit ? t('edit_event') : t('create_event')} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <input dir="auto" value={title} onChange={e => setTitle(e.target.value)} required placeholder={t('event_title_ph')} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        <div className="grid gap-3 sm:grid-cols-2">
          <input type="datetime-local" value={date} onChange={e => setDate(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <input dir="auto" value={location} onChange={e => setLocation(e.target.value)} placeholder={t('location')} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <textarea dir="auto" value={body} onChange={e => setBody(e.target.value)} placeholder={t('event_details_ph')} className="min-h-24 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase text-slate-400">{t('visibility')}</span>
          <select value={visibility} onChange={e => setVisibility(e.target.value as PulseVisibility)} className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
            {visibilitiesForScope(scope).map(v => <option key={v} value={v}>{t(`vis_${v}` as any)}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-3 gap-2">
          {imageUrls.map((url, index) => (
            <div key={url} className="relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              <img src={url} className="h-full w-full object-cover" alt="" />
              <button type="button" onClick={() => setImageUrls(prev => prev.filter((_, i) => i !== index))} className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-red-500 shadow-sm" title={t('remove')}>
                <Icons.Close />
              </button>
            </div>
          ))}
          <ImagePicker onImageSelect={addImage} loading={uploading} className="flex aspect-square cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-white text-slate-400 hover:border-emerald-400 hover:text-emerald-600">
            <Icons.Plus />
          </ImagePicker>
        </div>
        <button type="submit" disabled={saving || uploading || !title.trim()} className="w-full rounded-2xl bg-sky-600 py-3 text-sm font-bold text-white shadow-lg shadow-sky-600/20 transition-all hover:bg-sky-700 disabled:opacity-50">
          {saving ? t('creating') : (isEdit ? t('save_changes') : t('create_event'))}
        </button>
      </form>
    </Modal>
  );
};
