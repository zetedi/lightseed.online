
import React, { useState, useEffect, useRef, FormEvent } from 'react';
import { showAlert } from "../ui/Dialog";
import { useLanguage } from '../../contexts/LanguageContext';
import { Icons } from '../ui/Icons';
import { Modal } from '../ui/Modal';
import { ImagePicker } from '../ui/ImagePicker';
import { Pulse, Lightseed, Lifetree, Vision } from '../../types';
import { getMyVisions } from '../../services/firebase';
import { generateVisionImage } from '../../services/gemini';

interface EmitPulseModalProps {
  lightseed: Lightseed | null;
  activeTree: Lifetree | null;
  matchCandidate: Pulse | null;
  // When set, grow THIS specific tree (e.g. opened from a tree's page) rather than the
  // user's active tree, and skip the tree/vision choice — it's a focused tree growth.
  targetTree?: Lifetree | null;
  onClose: () => void;
  onMint: (data: any) => Promise<void>;
  onProposeAlignment: (data: any) => Promise<void>;
  // Fired after a tree growth mints, so the caller can refresh the tree's latest image.
  onGrown?: (treeId: string, imageUrl?: string) => void;
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
    className={`group relative min-h-[150px] overflow-hidden rounded-2xl border border-white/10 text-left shadow-lg transition-transform ${disabled ? 'cursor-not-allowed opacity-60' : 'hover:scale-[1.02]'}`}
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

// One snap-page of the walkthrough.
const Page: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="w-full shrink-0 snap-center px-0.5">{children}</div>
);

export const EmitPulseModal: React.FC<EmitPulseModalProps> = ({
  lightseed,
  activeTree,
  matchCandidate,
  targetTree = null,
  onClose,
  onMint,
  onProposeAlignment,
  onGrown,
  uploading,
  handleImageUpload,
  uploadBase64Image
}) => {
  const { t } = useLanguage();
  // The tree being grown: the explicit target (from its page) or the active tree.
  const growthTree = targetTree || activeTree;
  // A focused target jumps straight to tree-growth; otherwise ask what's growing.
  const [growthKind, setGrowthKind] = useState<GrowthKind | null>(targetTree ? 'tree' : null);
  const [myVisions, setMyVisions] = useState<Vision[]>([]);
  const [selectedVision, setSelectedVision] = useState<Vision | null>(null);
  const [growthCategory, setGrowthCategory] = useState<string>('');
  const [pulseTitle, setPulseTitle] = useState('');
  const [pulseBody, setPulseBody] = useState('');
  const [pulseImageUrl, setPulseImageUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // The walkthrough is a horizontal scroll-snap track. targetTree skips the "what's growing?"
  // choice, so its pages are [subject, details]; otherwise [choice, subject, details].
  const pageKeys: Array<'choice' | 'subject' | 'details'> = targetTree
    ? ['subject', 'details'] : ['choice', 'subject', 'details'];
  const trackRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const goToStep = (n: number) => {
    const el = trackRef.current; if (!el) return;
    el.scrollTo({ left: Math.max(0, Math.min(n, pageKeys.length - 1)) * el.clientWidth, behavior: 'smooth' });
  };
  const onTrackScroll = () => {
    const el = trackRef.current; if (!el) return;
    setStep(Math.round(el.scrollLeft / el.clientWidth));
  };

  useEffect(() => {
    if (lightseed?.uid) getMyVisions(lightseed.uid).then(setMyVisions).catch(() => {});
  }, [lightseed?.uid]);

  const treeImage = growthTree?.latestGrowthUrl || growthTree?.imageUrl || '';

  const chooseTree = () => { setGrowthKind('tree'); setPulseImageUrl(''); goToStep(1); };
  const chooseVision = () => {
    setGrowthKind('vision');
    if (myVisions.length === 1) pickVision(myVisions[0]);
    goToStep(1);
  };
  const pickVision = (v: Vision) => { setSelectedVision(v); setPulseImageUrl(v.imageUrl || ''); };

  const handleGenerate = async () => {
    if (!selectedVision || generating) return;
    setGenError(null);
    setGenerating(true);
    try {
      const prompt = `${selectedVision.title}. ${pulseBody}`.trim();
      const img = await generateVisionImage(prompt);
      if (img) setPulseImageUrl(img);
      else setGenError('Could not generate an image right now — try again, or upload one.');
    } catch (e: any) {
      // Inline (the old showAlert appeared *behind* the modal).
      setGenError(e?.message || 'Image generation failed — try again, or upload one.');
    } finally {
      setGenerating(false);
    }
  };

  const inviteTree = () => showAlert('Inviting a tree to grow this vision together is coming soon — it will become an on-chain agreement between trees.');

  const handleMint = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!lightseed || isSubmitting) return;

    // Every growth pulse is sealed onto a tree's chain. A vision grows on its rooted tree.
    const lifetreeId = growthKind === 'tree'
      ? (growthTree?.id || '')
      : (selectedVision?.lifetreeId || growthTree?.id || '');
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
        // Canonical lowercase types: tree growth updates the tree's latest growth view;
        // vision growth is a distinct type tied to the vision (not just a casing).
        type: growthKind === 'tree' ? 'tree_growth' : 'vision_growth',
        ...(growthKind === 'vision' && selectedVision
          ? { visionId: selectedVision.id, visionTitle: selectedVision.title, growthCategory }
          : {}),
        title: pulseTitle.trim() || (growthKind === 'tree'
          ? `${growthTree?.name || 'Tree'} growth`
          : (selectedVision?.title ? `${selectedVision.title} growth` : 'Vision growth')),
        body: pulseBody,
        imageUrl: finalImageUrl,
        authorId: lightseed.uid,
        authorName: lightseed.displayName || "Soul",
        authorPhoto: lightseed.photoURL || undefined,
      });
      // Let the caller refresh the tree's latest image / chain after a tree growth.
      if (growthKind === 'tree' && lifetreeId) onGrown?.(lifetreeId, finalImageUrl || undefined);
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

  // Can the current page advance? (choice needs a kind; subject needs its subject ready.)
  const currentKey = pageKeys[step];
  const canAdvance = currentKey === 'choice' ? growthKind !== null
    : currentKey === 'subject' ? (growthKind === 'tree' ? !!(pulseImageUrl || treeImage) : !!selectedVision)
    : true;
  const isLast = step === pageKeys.length - 1;

  const uploadImage = (file: File) => handleImageUpload(file, `users/${lightseed?.uid}/pulses/${Date.now()}`).then(setPulseImageUrl);

  return (
    <Modal title={matchCandidate ? t('propose_alignment') : (targetTree ? `Grow ${targetTree.name}` : t('emit_pulse'))} onClose={onClose}>
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
      ) : (
        <div>
          {/* The scrollable, page-by-page walkthrough. Swipe or use the buttons below. */}
          <div ref={trackRef} onScroll={onTrackScroll} className="flex snap-x snap-mandatory overflow-x-auto scroll-hide-bar">
            {pageKeys.map(key => {
              if (key === 'choice') return (
                <Page key="choice">
                  <p className="mb-3 text-center text-sm text-slate-500">A pulse is a moment of growth. What is growing?</p>
                  <div className="grid grid-cols-1 gap-3">
                    {/* Vision growth on top. */}
                    <GrowthCard
                      onClick={chooseVision}
                      disabled={myVisions.length === 0}
                      image={myVisions[0]?.imageUrl}
                      gradient="from-amber-500 to-purple-700"
                      icon={<Icons.Wizard />}
                      title="Vision Growth"
                      desc="Inspiration, funding, collaboration — observe a vision growing."
                      note={myVisions.length === 0 ? 'Create a vision first' : undefined}
                    />
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
                  </div>
                </Page>
              );

              if (key === 'subject') return (
                <Page key="subject">
                  {growthKind === 'tree' || (!growthKind && targetTree) ? (
                    <div className="space-y-3">
                      <div className="relative h-44 w-full overflow-hidden rounded-2xl border border-emerald-200 bg-slate-100">
                        {(pulseImageUrl || treeImage)
                          ? <img src={pulseImageUrl || treeImage} alt={growthTree?.name} className="h-full w-full object-cover" />
                          : <div className="flex h-full items-center justify-center text-slate-300"><Icons.Tree /></div>}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3"><p className="truncate text-sm font-bold text-white drop-shadow">{growthTree?.name}</p></div>
                      </div>
                      <ImagePicker onImageSelect={uploadImage} previewUrl={pulseImageUrl} loading={uploading} />
                      <p className="text-xs leading-relaxed text-emerald-800/80">Upload a new photo — it becomes the tree's <span className="font-bold">latest image</span> and joins its growth timeline.</p>
                    </div>
                  ) : growthKind === 'vision' ? (
                    <div className="space-y-3">
                      {/* Large selected vision, above the filmstrip. */}
                      <div className="relative h-44 w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                        {pulseImageUrl
                          ? <img src={pulseImageUrl} alt={selectedVision?.title} className="h-full w-full object-cover" />
                          : <div className="flex h-full flex-col items-center justify-center gap-1.5 text-slate-400"><Icons.Eye /><span className="text-xs">{selectedVision ? 'No image yet — generate or upload one' : 'Pick a vision below'}</span></div>}
                        {selectedVision && <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3"><p className="truncate text-sm font-bold text-white drop-shadow">{selectedVision.title}</p></div>}
                      </div>

                      {/* Generate (Gemini) or upload the growth image — two equal-sized buttons. */}
                      {selectedVision && (
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <button type="button" onClick={handleGenerate} disabled={generating} className="inline-flex items-center justify-center gap-1.5 rounded-full bg-slate-900 px-3 py-2.5 text-xs font-bold text-amber-300 transition-colors hover:bg-slate-800 disabled:opacity-50">
                              {generating ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-amber-300/40 border-t-amber-300" /> : <Icons.Wizard size={16} />}
                              <span>{generating ? 'Generating…' : (pulseImageUrl ? 'Regenerate' : 'Generate')}</span>
                            </button>
                            <label className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50">
                              <Icons.Image size={16} /> <span>{uploading ? 'Uploading…' : 'Upload'}</span>
                              <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); }} />
                            </label>
                          </div>
                          {genError && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{genError}</p>}
                        </div>
                      )}

                      {/* Filmstrip of visions. */}
                      <div>
                        <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Your visions</p>
                        <div className="flex gap-2 overflow-x-auto pb-1 scroll-hide-bar">
                          {myVisions.map(v => (
                            <button key={v.id} type="button" onClick={() => pickVision(v)} title={v.title}
                              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition-all ${selectedVision?.id === v.id ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-transparent opacity-80 hover:opacity-100'}`}>
                              {v.imageUrl
                                ? <img src={v.imageUrl} alt={v.title} className="h-full w-full object-cover" />
                                : <span className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-300"><Icons.Eye /></span>}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Growth category + invite a tree (future smart contract). */}
                      <div className="flex flex-wrap gap-2">
                        {['Inspiration', 'Funding', 'Collaboration', 'Other'].map(c => (
                          <button key={c} type="button" onClick={() => setGrowthCategory(c)} className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${growthCategory === c ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{c}</button>
                        ))}
                      </div>
                      <button type="button" onClick={inviteTree} className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-emerald-300 px-3 py-2 text-xs font-bold text-emerald-700 transition-colors hover:bg-emerald-50">
                        <Icons.Tree /> <span>Invite a tree to grow this</span>
                      </button>
                    </div>
                  ) : (
                    <p className="py-12 text-center text-sm text-slate-400">Choose what's growing first.</p>
                  )}
                </Page>
              );

              return (
                <Page key="details">
                  <div className="space-y-3">
                    <input dir="auto" className="block w-full rounded border p-2" placeholder={growthKind === 'tree' ? 'Caption (optional)' : t('title')} value={pulseTitle} onChange={e => setPulseTitle(e.target.value)} />
                    <textarea
                      dir="auto"
                      className="block min-h-24 w-full rounded border p-2"
                      placeholder={growthKind === 'vision' ? 'What inspiration, funding or collaboration is growing? (optional)' : `${t('body')} (optional)`}
                      value={pulseBody}
                      onChange={e => setPulseBody(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => handleMint()}
                      disabled={uploading || isSubmitting || (growthKind === 'tree' && !pulseImageUrl && !treeImage) || (growthKind === 'vision' && !selectedVision)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 font-bold uppercase tracking-wider text-white shadow-md transition-colors hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <Icons.Stamp />
                      <span>{isSubmitting ? t('minting') : t('mint')}</span>
                    </button>
                  </div>
                </Page>
              );
            })}
          </div>

          {/* Walkthrough nav: back · progress dots · next (or mint on the last page). */}
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <button type="button" onClick={() => goToStep(step - 1)} disabled={step === 0}
              className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 transition-colors hover:text-slate-800 disabled:opacity-30">
              <Icons.ArrowLeft /> <span>Back</span>
            </button>
            <div className="flex items-center gap-1.5">
              {pageKeys.map((_, n) => (
                <span key={n} className={`h-1.5 rounded-full transition-all ${n === step ? 'w-5 bg-emerald-600' : 'w-1.5 bg-slate-200'}`} />
              ))}
            </div>
            {isLast ? (
              <span className="w-12" />
            ) : (
              <button type="button" onClick={() => goToStep(step + 1)} disabled={!canAdvance}
                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 transition-colors hover:text-emerald-900 disabled:opacity-30">
                <span>Next</span> <Icons.ArrowRight size={16} />
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
};
