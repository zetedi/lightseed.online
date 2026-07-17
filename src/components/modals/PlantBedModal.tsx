import React, { useState } from 'react';
import { notify } from '../ui/Toast';
import { useLanguage } from '../../contexts/LanguageContext';
import { Icons } from '../ui/Icons';
import { Modal } from '../ui/Modal';
import { ImagePicker } from '../ui/ImagePicker';
import { useImageUpload } from '../../hooks/useImageUpload';
import { generateImage } from '../../services/gemini';
import { checkAndIncrementAiUsage, uploadBase64Image, plantBed } from '../../services/firebase';
import { announce } from '../../services/refreshBus';
import { bedPlantingProblem } from '../../domain/bed';
import type { LightHouse } from '../../types';

// Offer a bed inside a Light House — the keeper-only door. A bed is a being (plantBed seals its
// genesis chain), so this is deliberately light: a name, a word of welcome, a face. The house
// gives it a home; the rules give it its law. (Loose beds — under open stars — come later.)

export const PlantBedModal: React.FC<{ lightHouse: LightHouse; onClose: () => void; onPlanted?: () => void }> = ({ lightHouse, onClose, onPlanted }) => {
  const { t } = useLanguage();
  const { uploading, handleImageUpload } = useImageUpload();
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imagining, setImagining] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const imagine = async () => {
    if (imagining || uploading) return;
    setErr(null);
    const seed = [name, body].map(s => s.trim()).filter(Boolean).join('. ');
    if (!seed) { setErr('Give the bed a name or a welcome first, so we can imagine its face.'); return; }
    setImagining(true);
    try {
      await checkAndIncrementAiUsage('image');
      const prompt = `A luminous, inviting portrait of a place to sleep called "${name || 'a bed'}": ${seed}. Rest, warmth, sacred hospitality, a bed that welcomes a traveller. Painterly, natural, glowing. Do not include any text, words, or letters.`;
      const dataUrl = await generateImage(prompt);
      if (dataUrl && dataUrl.startsWith('data:')) {
        setImageUrl(await uploadBase64Image(dataUrl, `lightHouses/${lightHouse.id}/beds/ai/${Date.now()}`));
      } else {
        setErr('The vision did not take form. Please try again.');
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not imagine an image right now.');
    }
    setImagining(false);
  };

  const submit = async () => {
    const problem = bedPlantingProblem({ name, lightHouseId: lightHouse.id });
    if (problem) { setErr(problem); return; }
    setSubmitting(true);
    try {
      await plantBed({ name: name.trim(), lightHouseId: lightHouse.id, imageUrl: imageUrl || undefined, body: body.trim() || undefined });
      notify('🛏️ A bed is offered.');
      announce('beds', lightHouse.id);
      onPlanted?.();
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not offer the bed.');
      setSubmitting(false);
    }
  };

  return (
    <Modal title={`${t('offer_a_bed')} · ${lightHouse.name}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">{t('title')}</label>
          <input value={name} onChange={e => setName(e.target.value)} autoFocus
            placeholder="The Cedar Room · a hammock by the river…"
            className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-400">{t('body')}</label>
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={3}
            placeholder="A word of welcome — who this bed is for, what it looks onto…"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400" />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wide text-slate-400">{t('upload_photo')}</label>
            <button type="button" onClick={imagine} disabled={imagining || uploading}
              className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-bold text-violet-700 hover:bg-violet-200 disabled:opacity-50">
              <span className="[&>svg]:h-3 [&>svg]:w-3"><Icons.Wizard /></span>{imagining ? '…' : t('generate_image')}
            </button>
          </div>
          <ImagePicker
            onImageSelect={(file) => handleImageUpload(file, `lightHouses/${lightHouse.id}/beds/${Date.now()}`).then(setImageUrl)}
            previewUrl={imageUrl} loading={uploading} />
        </div>
        {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{err}</p>}
        <button type="button" onClick={submit} disabled={submitting || !name.trim()}
          className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
          {submitting ? t('planting') : t('offer_a_bed')}
        </button>
      </div>
    </Modal>
  );
};
