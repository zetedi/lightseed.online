
import React, { useState, FormEvent } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Icons } from '../ui/Icons';
import { Modal } from '../ui/Modal';
import { ImagePicker } from '../ui/ImagePicker';
import { Pulse, Lightseed, Lifetree } from '../../types';

interface EmitPulseModalProps {
  lightseed: Lightseed | null;
  activeTree: Lifetree | null;
  matchCandidate: Pulse | null;
  onClose: () => void;
  onMint: (data: any) => Promise<void>;
  onProposeMatch: (data: any) => Promise<void>;
  uploading: boolean;
  handleImageUpload: (file: File, path: string) => Promise<string>;
  uploadBase64Image: (base64: string, path: string) => Promise<string>;
}

export const EmitPulseModal: React.FC<EmitPulseModalProps> = ({
  lightseed,
  activeTree,
  matchCandidate,
  onClose,
  onMint,
  onProposeMatch,
  uploading,
  handleImageUpload,
  uploadBase64Image
}) => {
  const { t } = useLanguage();
  const [pulseTitle, setPulseTitle] = useState('');
  const [pulseBody, setPulseBody] = useState('');
  const [pulseImageUrl, setPulseImageUrl] = useState('');
  const [isGrowth, setIsGrowth] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleMint = async (e: FormEvent) => {
    e.preventDefault();
    if (!lightseed || !activeTree || isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      let finalImageUrl = pulseImageUrl;
      if (pulseImageUrl.startsWith('data:')) {
        finalImageUrl = await uploadBase64Image(pulseImageUrl, `users/${lightseed.uid}/pulses/ai/${Date.now()}`);
      }

      await onMint({
        lifetreeId: activeTree.id,
        type: isGrowth ? 'GROWTH' : 'STANDARD',
        title: pulseTitle,
        body: pulseBody,
        imageUrl: finalImageUrl,
        authorId: lightseed.uid,
        authorName: lightseed.displayName || "Soul",
        authorPhoto: lightseed.photoURL || undefined,
      });
      onClose();
    } catch(e: any) { 
        alert(e.message); 
    } finally { setIsSubmitting(false); }
  };

  const handleMatch = async (e: FormEvent) => {
    e.preventDefault();
    if (!lightseed || !activeTree || !matchCandidate || isSubmitting) return;
    setIsSubmitting(true);
    try {
         await onProposeMatch({
             initiatorPulseId: "PENDING_CREATION",
             initiatorTreeId: activeTree.id,
             initiatorUid: lightseed.uid,
             targetPulseId: matchCandidate.id,
             targetTreeId: matchCandidate.lifetreeId,
             targetUid: matchCandidate.authorId
         });
         alert("Match Proposed! Waiting for resonance.");
         onClose();
    } catch(e:any) { 
        alert(e.message); 
    } finally { setIsSubmitting(false); }
  }

  return (
    <Modal title={matchCandidate ? t('propose_match') : t('emit_pulse')} onClose={onClose}>
      <form onSubmit={matchCandidate ? handleMatch : handleMint} className="flex flex-col gap-4">
        {matchCandidate ? (
          <div className="bg-sky-50 p-4 rounded text-sky-800">
            {t('matching_with')} <strong>{matchCandidate.title}</strong>. 
            <br/><span className="text-xs">{t('match_request_desc')}</span>
          </div>
        ) : (
          <>
            <ImagePicker 
                onImageSelect={(file) => handleImageUpload(file, `users/${lightseed?.uid}/pulses/${Date.now()}`).then(setPulseImageUrl)} 
                previewUrl={pulseImageUrl} 
                loading={uploading} 
            />
            <div className="flex items-center gap-2">
              <input type="checkbox" id="growth" checked={isGrowth} onChange={e => setIsGrowth(e.target.checked)} className="rounded text-emerald-600 focus:ring-emerald-500" />
              <label htmlFor="growth" className="text-sm font-medium text-slate-700">{t('internal_pulse')}</label>
            </div>
            <input dir="auto" className="block w-full border p-2 rounded" placeholder={t('title')} value={pulseTitle} onChange={e=>setPulseTitle(e.target.value)} required />
            <textarea dir="auto" className="block w-full border p-2 rounded" placeholder={t('body')} value={pulseBody} onChange={e=>setPulseBody(e.target.value)} required />
          </>
        )}
        <button type="submit" disabled={uploading || isSubmitting} className="w-full bg-emerald-600 text-white py-2 rounded disabled:opacity-50 font-bold uppercase tracking-wider shadow-md">
          {isSubmitting ? t('minting') : (matchCandidate ? t('send_request') : t('mint'))}
        </button>
      </form>
    </Modal>
  );
};
