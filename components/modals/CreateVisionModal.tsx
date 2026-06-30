
import React, { useState, FormEvent } from 'react';
import { showAlert } from "../ui/Dialog";
import { useLanguage } from '../../contexts/LanguageContext';
import { Icons } from '../ui/Icons';
import { Modal } from '../ui/Modal';
import { ImagePicker } from '../ui/ImagePicker';
import { AutocompleteInput } from '../ui/AutocompleteInput';
import { Lightseed, Lifetree } from '../../types';
import { generateVisionImage } from '../../services/gemini';
import { checkAndIncrementAiUsage } from '../../services/firebase';

interface CreateVisionModalProps {
  lightseed: Lightseed | null;
  activeTree: Lifetree | null;
  trees?: Lifetree[]; // the author's trees — to ground the vision in one
  onClose: () => void;
  onCreate: (data: any) => Promise<void>;
  uploading: boolean;
  handleImageUpload: (file: File, path: string) => Promise<string>;
  uploadBase64Image: (base64: string, path: string) => Promise<string>;
}

export const CreateVisionModal: React.FC<CreateVisionModalProps> = ({
  lightseed,
  activeTree,
  trees = [],
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
  const [visibility, setVisibility] = useState<'public' | 'node' | 'private'>('public');
  // Grounding — the tree this vision is rooted in, and the community/site domain it links to.
  const groundOptions = trees.length ? trees : (activeTree ? [activeTree] : []);
  const [groundTreeId, setGroundTreeId] = useState<string>(activeTree?.id || groundOptions[0]?.id || '');
  const [visionDomain, setVisionDomain] = useState<string>('');
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
    if (!lightseed || isSubmitting) return;
    if (!groundTreeId) { showAlert('Plant or choose a tree to root this vision in.'); return; }
    setIsSubmitting(true);

    try {
        let finalImageUrl = visionImageUrl;
        if (visionImageUrl.startsWith('data:')) {
            finalImageUrl = await uploadBase64Image(visionImageUrl, `users/${lightseed.uid}/visions/ai/${Date.now()}`);
        }

        await onCreate({
            lifetreeId: groundTreeId,
            authorId: lightseed.uid,
            title: visionTitle,
            body: visionBody,
            link: visionLink,
            imageUrl: finalImageUrl,
            visibility,
            domain: visionDomain.trim() || undefined,
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
                 <Icons.Wizard /> 
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

        {/* Ground the vision — the tree it's rooted in + the community/site it links to. */}
        <div className="space-y-2 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700"><Icons.Tree /> Ground this vision</p>
            <label className="block">
                <span className="mb-1 block text-[11px] font-semibold text-slate-500">Rooted in tree</span>
                <select value={groundTreeId} onChange={e => setGroundTreeId(e.target.value)} className="block w-full rounded-lg border border-slate-300 bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    {groundOptions.length === 0 && <option value="">No tree yet — plant one first</option>}
                    {groundOptions.map(tr => <option key={tr.id} value={tr.id}>{tr.name}</option>)}
                </select>
            </label>
            <AutocompleteInput
                value={visionDomain}
                onChange={setVisionDomain}
                placeholder="Community or website domain (optional)"
                hint="Link this vision to a community/site. Leave blank to use this node."
                className="block w-full rounded-lg border border-slate-300 bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
        </div>

        {/* Protect fragile, early visions: choose who can see this. */}
        <label className="block">
            <span className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400"><Icons.Eye /> {t('visibility')}</span>
            <select
                value={visibility}
                onChange={e => setVisibility(e.target.value as 'public' | 'node' | 'private')}
                className="block w-full rounded-lg border border-slate-300 bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
                <option value="public">{t('vis_public')}</option>
                <option value="node">{t('vis_node')}</option>
                <option value="private">{t('vis_private')}</option>
            </select>
        </label>

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
