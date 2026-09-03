
import React, { useState, useEffect, FormEvent } from 'react';
import { showAlert } from "../ui/Dialog";
import { notify } from '../ui/Toast';
import { useLanguage } from '../../contexts/LanguageContext';
import { speak } from '../../utils/translations';
import { Icons } from '../ui/Icons';
import { Modal, modalButton } from '../ui/Modal';
import { ImagePicker } from '../ui/ImagePicker';
import { AutocompleteInput } from '../ui/AutocompleteInput';
import { LocationPicker } from '../ui/LocationPicker';
import { Lightseed } from '../../types';
import { generateLifetreeBio, generateImage } from '../../services/gemini';
import { checkAndIncrementAiUsage, uploadBase64Image } from '../../services/firebase';
import { Timestamp } from 'firebase/firestore';
import { plantedProvenance, type PhotoProvenance } from '../../domain/exif';

interface PlantTreeModalProps {
  lightseed: Lightseed | null;
  onClose: () => void;
  onPlant: (data: any) => Promise<void>;
  uploading: boolean;
  handleImageUpload: (file: File, path: string) => Promise<string>;
  // Reads the photo's EXIF place + moment (utils/exif → domain/exif) from the ORIGINAL file.
  readPhotoProvenance: (file: File) => Promise<PhotoProvenance | null>;
  // Optionally open straight into a type's flow (e.g. the "Guard Tree" button skips
  // the type selection and lands on the planting step).
  initialType?: 'LIFETREE' | 'GUARDED';
  initialStep?: number;
}

const lifetreeImage = '/mother.webp';

export const PlantTreeModal: React.FC<PlantTreeModalProps> = ({
  lightseed,
  onClose,
  onPlant,
  uploading,
  handleImageUpload,
  readPhotoProvenance,
  initialType,
  initialStep
}) => {
  const { t } = useLanguage();
  const [treeType, setTreeType] = useState<'LIFETREE' | 'GUARDED'>(initialType || 'LIFETREE');
  const [plantStep, setPlantStep] = useState(initialStep || 1);
  const [treeName, setTreeName] = useState('');
  const [treeShortTitle] = useState('');
  const [treeSeed, setTreeSeed] = useState('');
  const [treeBio, setTreeBio] = useState('');
  const [treeImageUrl, setTreeImageUrl] = useState('');
  const [treeDomain, setTreeDomain] = useState('');
  const [plantLocation, setPlantLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [treeFile, setTreeFile] = useState<File | null>(null);
  // The photo's own place and moment (EXIF), read the instant a photo is picked: the tree is
  // placed where the photo was taken, and the planting provenance is sealed from it. Null when
  // the photo carries none (or the face was imagined, not photographed).
  const [photoPlace, setPhotoPlace] = useState<PhotoProvenance | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isImagining, setIsImagining] = useState(false);
  const [imagineError, setImagineError] = useState<string | null>(null);
  const [isSeedingBio, setIsSeedingBio] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)');
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Desktop advances like a wizard (slides in from the side); mobile reads top-to-bottom (slides up).
  const stepAnim = isDesktop ? 'animate-in fade-in slide-in-from-right-6' : 'animate-in fade-in slide-in-from-bottom-6';

  // The "AI" button next to the seed keywords — grows a vision text from the keywords.
  const handleSeedBio = async () => {
    if (isSeedingBio) return;
    setIsSeedingBio(true);
    try {
      setTreeBio(await generateLifetreeBio(treeSeed));
    } catch (e: any) {
      showAlert(e?.message || 'err_ai_vision');
    }
    setIsSeedingBio(false);
  };

  const handleImagine = async () => {
    if (isImagining || uploading) return;
    setImagineError(null);
    const seed = [treeName, treeShortTitle, treeBio, treeSeed].map(s => s.trim()).filter(Boolean).join('. ');
    if (!seed) {
      setImagineError('tree_face_seed_first');
      return;
    }
    setIsImagining(true);
    try {
      await checkAndIncrementAiUsage('image');
      const prompt = `Create a luminous, symbolic portrait representing a Lifetree named "${treeName || 'a soul'}": ${seed}. Painterly, natural, sacred, glowing. Do not include any text, words, or letters.`;
      const dataUrl = await generateImage(prompt);
      if (dataUrl && dataUrl.startsWith('data:')) {
        const url = await uploadBase64Image(dataUrl, `users/${lightseed?.uid}/trees/ai/${Date.now()}`);
        setTreeImageUrl(url);
      } else {
        setImagineError('err_vision_no_form');
      }
    } catch (e: any) {
      // Inline (a showAlert here appears BEHIND the fullscreen modal, so the reason was invisible).
      setImagineError(e?.message || 'err_imagine');
    }
    setIsImagining(false);
  };

  useEffect(() => {
    if (treeType === 'GUARDED') {
      // Leave the name empty so the grey "A tree to stand for" suggestion shows.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clears the form when the user switches tree type mid-flow; the fields are user-editable so they can't be derived
      setTreeName("");
      setTreeBio("");
    }
    setPlantLocation(null);
  }, [treeType]);

  // A picked photo places the tree by its own EXIF (the original file — the crop strips it).
  const handlePhotoPicked = (file: File, original: File) => {
    setTreeFile(file);
    handleImageUpload(file, `users/${lightseed?.uid}/trees/${Date.now()}`).then(setTreeImageUrl);
    readPhotoProvenance(original).then(place => {
      setPhotoPlace(place);
      if (place) {
        setPlantLocation({ latitude: place.latitude, longitude: place.longitude });
        notify(t('location_from_photo'));
      }
    }).catch(() => setPhotoPlace(null));
  };

  // Locate: the photo's own place first (the truest witness of where the tree stands), the
  // device's position only when the photo carries none.
  const handleLocate = () => {
    if (photoPlace) {
      setPlantLocation({ latitude: photoPlace.latitude, longitude: photoPlace.longitude });
      notify(t('location_from_photo'));
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPlantLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setIsLocating(false);
      },
      (err) => {
        console.error(err);
        showAlert(treeFile ? 'err_location_manual' : 'err_location');
        setIsLocating(false);
      }
    );
  };

  const placedFromPhoto = !!photoPlace && !!plantLocation
    && plantLocation.latitude === photoPlace.latitude && plantLocation.longitude === photoPlace.longitude;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!lightseed || isSubmitting) return;
    setIsSubmitting(true);
    
    const finalName = treeName.trim() || lightseed.displayName || "Anonymous Tree";
    const isNature = treeType === 'GUARDED';

    try {
        await onPlant({
            ownerId: lightseed.uid,
            name: finalName,
            shortTitle: treeShortTitle,
            body: treeBio,
            imageUrl: treeImageUrl,
            latitude: plantLocation?.latitude,
            longitude: plantLocation?.longitude,
            // Provenance (domain/lifetree planted*): the REAL moment and place the photo
            // witnessed — sealed only when the photo carried them, never guessed.
            ...(photoPlace ? (() => {
                const { plantedAtMs, ...place } = plantedProvenance(photoPlace);
                return { ...place, ...(plantedAtMs !== undefined ? { plantedAt: Timestamp.fromMillis(plantedAtMs) } : {}) };
            })() : {}),
            isNature: isNature,
            treeType: treeType,
            domain: treeDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
        });
        onClose();
    } catch (e: any) {
        showAlert(e.message);
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <Modal
      title={treeType === 'GUARDED' ? t('guard_tree') : t('plant_lifetree')}
      onClose={onClose}
      backgroundImage={(plantStep === 1 || treeType !== 'GUARDED') ? lifetreeImage : undefined}
      fullScreenOnMobile
      innerGlow
      wide
    >
      <div className="flex flex-col h-full min-h-[450px]">
        {plantStep === 1 && (
          <div className={`flex-1 flex flex-col gap-6 ${stepAnim}`}>
            <div className="text-center text-white">
              <h2 className="text-xl font-bold mb-2">{t('plant_step_type')}</h2>
              <p className="text-sm opacity-70">{t('plant_step_type_sub')}</p>
            </div>
            <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                { id: 'LIFETREE', label: t('type_lifetree'), icon: <Icons.Tree />, desc: t('type_lifetree_desc'), image: '/seed.webp' },
                { id: 'GUARDED', label: t('type_guarded'), icon: <Icons.Shield />, desc: t('type_guarded_desc'), image: '/phoenix.webp' }
              ].map((type: any) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => { setTreeType(type.id); setPlantStep(2); }}
                  className="group relative min-h-[220px] overflow-hidden rounded-2xl border border-white/15 text-left shadow-lg transition-transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-emerald-400"
                >
                  <img src={type.image} alt={type.label} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/10" />
                  <div className="relative flex h-full flex-col justify-end p-5 text-white">
                    <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-xl backdrop-blur">{type.icon}</span>
                    <div className="text-sm font-bold uppercase tracking-widest">{type.label}</div>
                    <div className="mt-1 text-xs opacity-80">{type.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {plantStep === 2 && (
          <div className={`flex-1 flex flex-col gap-6 ${stepAnim}`}>
            <div className={`text-center ${treeType !== 'GUARDED' ? 'text-white' : 'text-slate-800'}`}>
              <h2 className="text-xl font-bold mb-2">{t('plant_step_name')}</h2>
              <p className="text-sm opacity-70">{t('plant_step_name_sub')}</p>
            </div>
            <div className="flex flex-col gap-4">
              <input
                dir="auto"
                className={`block w-full border p-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all shadow-inner ${
                  treeType !== 'GUARDED' ? 'bg-white/10 border-white/20 text-white placeholder:text-white/50' : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
                }`}
                placeholder={treeType === 'GUARDED' ? t('tree_stand_for_ph') : t('tree_name_ph')}
                value={treeName}
                onChange={e=>setTreeName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="flex gap-2 mt-auto pb-4">
              <button onClick={() => setPlantStep(1)} className={modalButton(treeType !== 'GUARDED' ? 'secondary-dark' : 'secondary', { extra: 'flex-1 uppercase tracking-widest' })}>{t('back')}</button>
              <button onClick={() => setPlantStep(treeType === 'GUARDED' ? 4 : 3)} className={modalButton('primary', { extra: 'flex-[2] uppercase tracking-widest' })}><span>Next</span><span className="sm:hidden animate-bounce"><Icons.ChevronRight className="rotate-90" /></span><span className="hidden sm:inline"><Icons.ChevronRight /></span></button>
            </div>
          </div>
        )}

        {plantStep === 3 && (
          <div className={`flex-1 flex flex-col gap-6 ${stepAnim}`}>
            <div className={`text-center ${treeType !== 'GUARDED' ? 'text-white' : 'text-slate-800'}`}>
              <h2 className="text-xl font-bold mb-2">{t('plant_step_vision')}</h2>
              <p className="text-sm opacity-70">{t('plant_step_vision_sub')}</p>
            </div>
            <div className="flex flex-col gap-4">
              {treeType !== 'GUARDED' && (
                <div className="flex gap-2">
                  <input 
                    dir="auto" 
                    className="flex-1 border border-white/20 p-3 rounded-xl bg-white/10 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all" 
                    placeholder={t('seed_keywords_ph')} 
                    value={treeSeed} 
                    onChange={e=>setTreeSeed(e.target.value)} 
                  />
                  <button type="button" onClick={handleSeedBio} disabled={uploading || isSeedingBio} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 rounded-xl disabled:opacity-50 font-bold text-xs shadow-md transition-colors flex items-center justify-center min-w-[52px]">
                    {isSeedingBio ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'AI'}
                  </button>
                </div>
              )}
              <textarea 
                dir="auto"
                className={`block w-full border p-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all min-h-[150px] resize-none ${
                  treeType !== 'GUARDED' ? 'bg-white/10 border-white/20 text-white placeholder:text-white/50' : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
                }`} 
                placeholder={treeType === 'GUARDED' ? t('description') : t('vision')} 
                value={treeBio} 
                onChange={e=>setTreeBio(e.target.value)} 
                required 
              />
            </div>
            <div className="flex gap-2 mt-auto pb-4">
              <button onClick={() => setPlantStep(2)} className={modalButton(treeType !== 'GUARDED' ? 'secondary-dark' : 'secondary', { extra: 'flex-1 uppercase tracking-widest' })}>{t('back')}</button>
              <button onClick={() => setPlantStep(4)} className={modalButton('primary', { extra: 'flex-[2] uppercase tracking-widest' })}><span>Next</span><span className="sm:hidden animate-bounce"><Icons.ChevronRight className="rotate-90" /></span><span className="hidden sm:inline"><Icons.ChevronRight /></span></button>
            </div>
          </div>
        )}

        {plantStep === 4 && (
          <div className={`flex-1 flex flex-col gap-6 ${stepAnim}`}>
            <div className={`text-center ${treeType !== 'GUARDED' ? 'text-white' : 'text-slate-800'}`}>
              <h2 className="text-xl font-bold mb-2">{treeType === 'GUARDED' ? 'A Photo' : 'Imagine'}</h2>
              <p className="text-sm opacity-70">{treeType === 'GUARDED' ? 'Add a photo of the tree you guard, or skip and simply place it on the map.' : 'Upload a portrait of your tree, or let AI imagine one from your vision.'}</p>
            </div>
            <div className="flex-1 flex flex-col gap-3 min-h-[220px]">
              <ImagePicker
                onImageSelect={handlePhotoPicked}
                previewUrl={treeImageUrl}
                loading={uploading}
                isDark={treeType !== 'GUARDED'}
                className="h-full min-h-[180px]"
              />
              {treeType !== 'GUARDED' && <button
                type="button"
                onClick={handleImagine}
                disabled={isImagining || uploading}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all disabled:opacity-50 bg-white/10 text-white hover:bg-white/20 border border-white/20"
              >
                {isImagining ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div> : <Icons.Intelligence />}
                <span>{isImagining ? t('imagining') : t('imagine_ai')}</span>
              </button>}
              {imagineError && <p className={`rounded-lg px-3 py-2 text-xs ${treeType !== 'GUARDED' ? 'bg-red-500/20 text-red-100' : 'bg-red-50 text-red-600'}`}>{speak(imagineError)}</p>}
            </div>
            <div className="flex gap-2 mt-auto pb-4">
              <button onClick={() => setPlantStep(treeType === 'GUARDED' ? 2 : 3)} className={modalButton(treeType !== 'GUARDED' ? 'secondary-dark' : 'secondary', { extra: 'flex-1 uppercase tracking-widest' })}>{t('back')}</button>
              <button onClick={() => setPlantStep(5)} className={modalButton('primary', { extra: 'flex-[2] uppercase tracking-widest' })}><span>Next</span><span className="sm:hidden animate-bounce"><Icons.ChevronRight className="rotate-90" /></span><span className="hidden sm:inline"><Icons.ChevronRight /></span></button>
            </div>
          </div>
        )}

        {plantStep === 5 && (
          <form onSubmit={handleSubmit} className={`flex-1 flex flex-col gap-6 ${stepAnim}`}>
            <div className={`text-center ${treeType !== 'GUARDED' ? 'text-white' : 'text-slate-800'}`}>
              <h2 className="text-xl font-bold mb-2">{t('plant_step_ground')}</h2>
              <p className="text-sm opacity-70">{t('plant_step_ground_sub')}</p>
            </div>
            <div className="flex flex-col gap-4">
              <div className={`flex items-center justify-between p-4 rounded-xl border ${treeType === 'GUARDED' ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-black/30 border-white/10 text-white'}`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${plantLocation ? 'bg-emerald-500 text-white' : (treeType === 'GUARDED' ? 'bg-slate-200 text-slate-500' : 'bg-white/10 text-white/50')}`}>
                    <Icons.Loc />
                  </div>
                  <div className="text-xs">
                    {plantLocation ? (
                      <>
                        <span className="font-mono text-emerald-400 font-bold">{plantLocation.latitude.toFixed(6)}, {plantLocation.longitude.toFixed(6)}</span>
                        {placedFromPhoto && <span className="block opacity-70">{t('location_from_photo')}</span>}
                      </>
                    ) : (
                      <span className="opacity-70">{t('location_not_set')}</span>
                    )}
                  </div>
                </div>
                <button 
                  type="button" 
                  onClick={handleLocate} 
                  disabled={isLocating} 
                  className={`text-xs px-4 py-2 rounded-lg font-bold uppercase tracking-wider transition-colors ${
                    isLocating 
                      ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
                      : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                  }`}
                >
                  {isLocating ? t('locating') : t('locate')}
                </button>
              </div>

              <div className="space-y-1.5">
                <p className={`ml-1 text-[11px] ${treeType !== 'GUARDED' ? 'text-white/70' : 'text-slate-500'}`}>
                  Tap the map to place your tree, or use Locate above.
                </p>
                <LocationPicker value={plantLocation} onChange={setPlantLocation} />
              </div>

              <AutocompleteInput
                className={`block w-full border p-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all shadow-inner ${
                  treeType !== 'GUARDED' ? 'bg-white/10 border-white/20 text-white placeholder:text-white/50' : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
                }`}
                placeholder={t('tree_domain_ph')}
                hint={t('tree_domain_hint')}
                value={treeDomain}
                onChange={setTreeDomain}
              />
            </div>
            <div className="flex gap-2 mt-auto pb-4">
              <button type="button" onClick={() => setPlantStep(4)} className={modalButton(treeType !== 'GUARDED' ? 'secondary-dark' : 'secondary', { extra: 'flex-1 uppercase tracking-widest' })}>{t('back')}</button>
              <button type="submit" disabled={uploading || isSubmitting} className={modalButton('primary', { extra: 'flex-[2] uppercase tracking-widest' })}>
                {isSubmitting ? t('planting') : t('plant_lifetree')}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
