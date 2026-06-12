
import React, { useState, useEffect, FormEvent } from 'react';
import { showAlert } from "../ui/Dialog";
import { useLanguage } from '../../contexts/LanguageContext';
import { Icons } from '../ui/Icons';
import { Modal } from '../ui/Modal';
import { ImagePicker } from '../ui/ImagePicker';
import { Pulse, Lightseed, Lifetree, Vision } from '../../types';
import { getMyVisions } from '../../services/firebase';

interface EmitPulseModalProps {
  lightseed: Lightseed | null;
  activeTree: Lifetree | null;
  matchCandidate: Pulse | null;
  onClose: () => void;
  onMint: (data: any) => Promise<void>;
  onProposeAlignment: (data: any) => Promise<void>;
  uploading: boolean;
  handleImageUpload: (file: File, path: string) => Promise<string>;
  uploadBase64Image: (base64: string, path: string) => Promise<string>;
}

type GrowthKind = 'tree' | 'vision';

// A large, image-backed choice card (mirrors the plant-tree modal's first step).
const GrowthCard = ({ onClick, disabled, image, icon, title, desc, note, gradient }: {
  onClick: () => void; disabled?: boolean; image?: string; icon: React.ReactNode;
  title: string; desc: string; note?: string; gradient: string;
}) => (
  <button
    type="button"
    onClick={disabled ? undefined : onClick}
    disabled={disabled}
    className={`group relative min-h-[170px] overflow-hidden rounded-2xl border border-white/10 text-left shadow-lg transition-transform ${disabled ? 'cursor-not-allowed opacity-60' : 'hover:scale-[1.02]'}`}
  >
    {image
      ? <img src={image} alt={title} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
      : <div className={`absolute inset-0 bg-gradient-to-br ${gradient}`} />}
    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/10" />
    <div className="relative flex h-full flex-col justify-end p-4 text-white">
      <span className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 backdrop-blur">{icon}</span>
      <div className="text-sm font-bold uppercase tracking-widest">{title}</div>
      <div className="mt-1 text-xs opacity-80">{desc}</div>
      {note && <div className="mt-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-300">{note}</div>}
    </div>
  </button>
);

export const EmitPulseModal: React.FC<EmitPulseModalProps> = ({
  lightseed,
  activeTree,
  matchCandidate,
  onClose,
  onMint,
  onProposeAlignment,
  uploading,
  handleImageUpload,
  uploadBase64Image
}) => {
  const { t } = useLanguage();
  const [growthKind, setGrowthKind] = useState<GrowthKind | null>(null);
  const [myVisions, setMyVisions] = useState<Vision[]>([]);
  const [selectedVision, setSelectedVision] = useState<Vision | null>(null);
  const [growthCategory, setGrowthCategory] = useState<string>('');
  const [pulseTitle, setPulseTitle] = useState('');
  const [pulseBody, setPulseBody] = useState('');
  const [pulseImageUrl, setPulseImageUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (lightseed?.uid) getMyVisions(lightseed.uid).then(setMyVisions).catch(() => {});
  }, [lightseed?.uid]);

  const treeImage = activeTree?.latestGrowthUrl || activeTree?.imageUrl || '';

  const chooseTree = () => { setGrowthKind('tree'); setPulseImageUrl(''); };
  const chooseVision = () => {
    setGrowthKind('vision');
    if (myVisions.length === 1) pickVision(myVisions[0]);
  };
  const pickVision = (v: Vision) => { setSelectedVision(v); setPulseImageUrl(v.imageUrl || ''); };
  const backToChoice = () => { setGrowthKind(null); setSelectedVision(null); setGrowthCategory(''); setPulseImageUrl(''); };

  const handleMint = async (e: FormEvent) => {
    e.preventDefault();
    if (!lightseed || isSubmitting) return;

    // Every growth pulse is sealed onto a tree's chain. A vision grows on its rooted tree.
    const lifetreeId = growthKind === 'tree'
      ? (activeTree?.id || '')
      : ((selectedVision as any)?.treeId || selectedVision?.lifetreeId || activeTree?.id || '');
    if (!lifetreeId) {
      showAlert(growthKind === 'vision' ? 'This vision is not rooted in a tree yet, so it cannot grow.' : 'Plant a lifetree before emitting growth.');
      return;
    }

    setIsSubmitting(true);
    try {
      let finalImageUrl = pulseImageUrl;
      if (pulseImageUrl.startsWith('data:')) {
        finalImageUrl = await uploadBase64Image(pulseImageUrl, `users/${lightseed.uid}/pulses/ai/${Date.now()}`);
      }
      await onMint({
        lifetreeId,
        // Tree growth keeps the legacy 'GROWTH' (updates the tree's latest growth view);
        // vision growth is a 'growth' pulse tied to the vision.
        type: growthKind === 'tree' ? 'GROWTH' : 'growth',
        ...(growthKind === 'vision' && selectedVision
          ? { visionId: selectedVision.id, visionTitle: selectedVision.title, growthCategory }
          : {}),
        title: pulseTitle.trim() || (growthKind === 'tree'
          ? `${activeTree?.name || 'Tree'} growth`
          : (selectedVision?.title ? `${selectedVision.title} growth` : 'Vision growth')),
        body: pulseBody,
        imageUrl: finalImageUrl,
        authorId: lightseed.uid,
        authorName: lightseed.displayName || "Soul",
        authorPhoto: lightseed.photoURL || undefined,
      });
      onClose();
    } catch (e: any) {
      showAlert(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAlignment = async (e: FormEvent) => {
    e.preventDefault();
    if (!lightseed || !activeTree || !matchCandidate || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onProposeAlignment({
        initiatorPulseId: "PENDING_CREATION",
        initiatorTreeId: activeTree.id,
        initiatorUid: lightseed.uid,
        targetPulseId: matchCandidate.id,
        targetTreeId: matchCandidate.lifetreeId,
        targetUid: matchCandidate.authorId
      });
      showAlert("Alignment Proposed! Waiting for resonance.");
      onClose();
    } catch (e: any) {
      showAlert(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal title={matchCandidate ? t('propose_alignment') : t('emit_pulse')} onClose={onClose}>
      {matchCandidate ? (
        <form onSubmit={handleAlignment} className="flex flex-col gap-4">
          <div className="bg-sky-50 p-4 rounded text-sky-800">
            {t('alignment_with')} <strong>{matchCandidate.title}</strong>.
            <br /><span className="text-xs">{t('alignment_request_desc')}</span>
          </div>
          <button type="submit" disabled={isSubmitting} className="w-full bg-emerald-600 text-white py-2 rounded disabled:opacity-50 font-bold uppercase tracking-wider shadow-md">
            {isSubmitting ? t('minting') : t('send_request')}
          </button>
        </form>
      ) : growthKind === null ? (
        // STEP 1 — what are you growing?
        <div className="space-y-3">
          <p className="text-center text-sm text-slate-500">A pulse is a moment of growth. What is growing?</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <GrowthCard
              onClick={chooseTree}
              disabled={!activeTree}
              image={treeImage}
              gradient="from-emerald-500 to-emerald-800"
              icon={<Icons.Tree />}
              title="Tree Growth"
              desc="New leaves, photos, milestones — observe your tree growing."
              note={!activeTree ? 'Plant a lifetree first' : undefined}
            />
            <GrowthCard
              onClick={chooseVision}
              disabled={myVisions.length === 0}
              image={myVisions[0]?.imageUrl}
              gradient="from-amber-500 to-purple-700"
              icon={<Icons.Sparkles />}
              title="Vision Growth"
              desc="Inspiration, funding, collaboration — observe a vision growing."
              note={myVisions.length === 0 ? 'Create a vision first' : undefined}
            />
          </div>
        </div>
      ) : (
        // STEP 2 — the growth details
        <form onSubmit={handleMint} className="flex flex-col gap-4">
          <button type="button" onClick={backToChoice} className="flex w-fit items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800">
            <Icons.ArrowLeft /> <span>Back</span>
          </button>

          {growthKind === 'tree' && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
              <p className="text-xs leading-relaxed text-emerald-800/80">
                Upload a new photo of your tree. It becomes the tree's <span className="font-bold">latest image</span> and joins its growth timeline — played from the tree's profile.
              </p>
              {treeImage && (
                <div className="mt-2 flex items-center gap-2">
                  <img src={treeImage} alt="Current tree" className="h-12 w-12 rounded-lg border border-emerald-200 object-cover" />
                  <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Current latest</span>
                </div>
              )}
            </div>
          )}

          {growthKind === 'vision' && (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Choose the vision</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {myVisions.map(v => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => pickVision(v)}
                    title={v.title}
                    className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition-all ${selectedVision?.id === v.id ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-transparent opacity-80 hover:opacity-100'}`}
                  >
                    {v.imageUrl
                      ? <img src={v.imageUrl} alt={v.title} className="h-full w-full object-cover" />
                      : <span className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-300"><Icons.Eye /></span>}
                  </button>
                ))}
              </div>
              {selectedVision && <p className="text-xs text-slate-500">Growing: <span className="font-bold text-slate-700">{selectedVision.title}</span></p>}
              <div className="flex flex-wrap gap-2 pt-1">
                {['Inspiration', 'Funding', 'Collaboration', 'Other'].map(c => (
                  <button key={c} type="button" onClick={() => setGrowthCategory(c)} className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${growthCategory === c ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{c}</button>
                ))}
              </div>
            </div>
          )}

          <ImagePicker
            onImageSelect={(file) => handleImageUpload(file, `users/${lightseed?.uid}/pulses/${Date.now()}`).then(setPulseImageUrl)}
            previewUrl={pulseImageUrl}
            loading={uploading}
          />
          <input dir="auto" className="block w-full border p-2 rounded" placeholder={growthKind === 'tree' ? 'Caption (optional)' : t('title')} value={pulseTitle} onChange={e => setPulseTitle(e.target.value)} />
          <textarea
            dir="auto"
            className="block w-full border p-2 rounded"
            placeholder={growthKind === 'vision' ? 'What inspiration, funding or collaboration is growing? (optional)' : `${t('body')} (optional)`}
            value={pulseBody}
            onChange={e => setPulseBody(e.target.value)}
          />
          <button
            type="submit"
            disabled={uploading || isSubmitting || (growthKind === 'tree' && !pulseImageUrl) || (growthKind === 'vision' && !selectedVision)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 font-bold uppercase tracking-wider text-white shadow-md transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            <Icons.Stamp />
            <span>{isSubmitting ? t('minting') : t('mint')}</span>
          </button>
        </form>
      )}
    </Modal>
  );
};
