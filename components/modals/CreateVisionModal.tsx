
import React, { useState, FormEvent } from 'react';
import { showAlert } from "../ui/Dialog";
import { useLanguage } from '../../contexts/LanguageContext';
import { Icons } from '../ui/Icons';
import { Modal } from '../ui/Modal';
import { ImagePicker } from '../ui/ImagePicker';
import { Lightseed, Lifetree } from '../../types';
import { generateVisionImage } from '../../services/gemini';
import { checkAndIncrementAiUsage } from '../../services/firebase';

interface CreateVisionModalProps {
  lightseed: Lightseed | null;
  activeTree: Lifetree | null;
  onClose: () => void;
  onCreate: (data: any) => Promise<void>;
  uploading: boolean;
  handleImageUpload: (file: File, path: string) => Promise<string>;
  uploadBase64Image: (base64: string, path: string) => Promise<string>;
}

export const CreateVisionModal: React.FC<CreateVisionModalProps> = ({
  lightseed,
  activeTree,
  onClose,
  onCreate,
  uploading,
  handleImageUpload,
  uploadBase64Image
}) => {
  const { t } = useLanguage();
  const [visionTitle, setVisionTitle] = useState('');
  const [visionBody, setVisionBody] = useState('');
  const [visionLink, setVisionLink] = useState('');
  const [visionImageUrl, setVisionImageUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localUploading, setLocalUploading] = useState(false);

  const handleGenerateImage = async () => {
    if (!visionBody) { showAlert("Please enter a vision description first."); return; }
    setLocalUploading(true);
    try {
        const allowed = await checkAndIncrementAiUsage('image');
        if (!allowed) {
            showAlert(t('ai_login_required'));
            setLocalUploading(false);
            return;
        }

        const url = await generateVisionImage(visionBody);
        if (url) {
            setVisionImageUrl(url);
        } else {
            throw new Error("No image data returned from AI service.");
        }
    } catch (e: any) {
         showAlert(`Image generation failed: ${e.message || t('daily_limit_image')}`);
    } finally { setLocalUploading(true); }
    setLocalUploading(false);
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!lightseed || !activeTree || isSubmitting) return;
    setIsSubmitting(true);

    try {
        let finalImageUrl = visionImageUrl;
        if (visionImageUrl.startsWith('data:')) {
            finalImageUrl = await uploadBase64Image(visionImageUrl, `users/${lightseed.uid}/visions/ai/${Date.now()}`);
        }

        await onCreate({
            lifetreeId: activeTree.id,
            authorId: lightseed.uid,
            title: visionTitle,
            body: visionBody,
            link: visionLink,
            imageUrl: finalImageUrl
        });
        onClose();
    } catch(e:any) { 
        showAlert(e.message); 
    } finally { setIsSubmitting(false); }
  }

  return (
    <Modal title={t('create_vision')} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <ImagePicker 
            onImageSelect={(file) => handleImageUpload(file, `users/${lightseed?.uid}/visions/${Date.now()}`).then(setVisionImageUrl)} 
            previewUrl={visionImageUrl} 
            loading={uploading || localUploading} 
        />
        
        <div className="flex justify-end">
             <button 
                type="button" 
                onClick={handleGenerateImage}
                disabled={uploading || localUploading || !visionBody}
                className="text-xs bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-bold hover:bg-amber-200 disabled:opacity-50 flex items-center gap-1"
             >
                 <Icons.Sparkles /> 
                 <span>{t('generate_image')}</span>
             </button>
        </div>

        <input 
            dir="auto" 
            className="block w-full border border-slate-300 p-2 rounded-lg" 
            placeholder={t('title')} 
            value={visionTitle} 
            onChange={e=>setVisionTitle(e.target.value)} 
            required 
        />
        
        <textarea 
            dir="auto" 
            rows={3}
            className="block w-full resize-none overflow-hidden border border-slate-300 p-2 rounded-lg min-h-[76px]" 
            placeholder={t('body')} 
            value={visionBody} 
            onChange={e=>setVisionBody(e.target.value)}
            onInput={(e) => {
                const target = e.currentTarget;
                target.style.height = '0px';
                target.style.height = `${target.scrollHeight}px`;
            }}
            required 
        />

        <input 
            dir="ltr" 
            className="block w-full border border-slate-300 p-2 rounded-lg" 
            placeholder={t('webpage')} 
            value={visionLink} 
            onChange={e=>setVisionLink(e.target.value)} 
        />

        <button 
            type="submit" 
            disabled={uploading || localUploading || isSubmitting} 
            className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 rounded-xl font-bold shadow-md disabled:opacity-50"
        >
            {isSubmitting ? t('creating') : t('create_vision')}
        </button>
      </form>
    </Modal>
  );
};
