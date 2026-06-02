
import React, { useState, useEffect, FormEvent } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Icons } from '../ui/Icons';
import { Modal } from '../ui/Modal';
import { ImagePicker } from '../ui/ImagePicker';
import { AutocompleteInput } from '../ui/AutocompleteInput';
import { Lightseed } from '../../types';
import { generateLifetreeBio } from '../../services/gemini';

interface PlantTreeModalProps {
  lightseed: Lightseed | null;
  onClose: () => void;
  onPlant: (data: any) => Promise<void>;
  uploading: boolean;
  handleImageUpload: (file: File, path: string) => Promise<string>;
  extractGpsFromImage: (file: File) => Promise<{latitude: number, longitude: number} | null>;
}

const lifetreeImage = '/mother.webp';

export const PlantTreeModal: React.FC<PlantTreeModalProps> = ({
  lightseed,
  onClose,
  onPlant,
  uploading,
  handleImageUpload,
  extractGpsFromImage
}) => {
  const { t } = useLanguage();
  const [treeType, setTreeType] = useState<'LIFETREE' | 'GUARDED' | 'FAMILY'>('LIFETREE');
  const [plantStep, setPlantStep] = useState(1);
  const [treeName, setTreeName] = useState('');
  const [treeShortTitle, setTreeShortTitle] = useState('');
  const [treeSeed, setTreeSeed] = useState('');
  const [treeBio, setTreeBio] = useState('');
  const [treeImageUrl, setTreeImageUrl] = useState('');
  const [treeDomain, setTreeDomain] = useState('');
  const [plantLocation, setPlantLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [treeFile, setTreeFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (treeType === 'GUARDED') {
      setTreeName("Humanity's Tree!");
      setTreeBio(""); 
    } else if (treeName === "Humanity's Tree!") {
      setTreeName("");
    }
    setPlantLocation(null);
  }, [treeType]);

  const handleLocate = () => {
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPlantLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setIsLocating(false);
      },
      async (err) => {
        console.error(err);
        if (treeFile) {
          const coords = await extractGpsFromImage(treeFile);
          if (coords) {
            setPlantLocation(coords);
            alert("Location extracted from image!");
          } else {
            alert("Could not get location from browser or image. Please set it manually if needed.");
          }
        } else {
          alert("Could not get location. Try uploading a photo with GPS first, or allow browser location.");
        }
        setIsLocating(false);
      }
    );
  };

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
            isNature: isNature,
            treeType: treeType,
            domain: treeDomain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
        });
        onClose();
    } catch (e: any) {
        alert(e.message);
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <Modal 
      title={treeType === 'GUARDED' ? t('guard_tree') : t('plant_lifetree')} 
      onClose={onClose}
      backgroundImage={treeType !== 'GUARDED' ? lifetreeImage : undefined}
    >
      <div className="flex flex-col h-full min-h-[450px]">
        {plantStep === 1 && (
          <div className="flex-1 flex flex-col gap-6 animate-in fade-in slide-in-from-right-4">
            <div className="text-center text-white">
              <h2 className="text-xl font-bold mb-2">Choose Tree Type</h2>
              <p className="text-sm opacity-70">What kind of life are you planting today?</p>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {[
                { id: 'LIFETREE', label: t('type_lifetree'), icon: <Icons.Tree />, desc: 'Your personal digital-physical avatar' },
                { id: 'GUARDED', label: t('type_guarded'), icon: <Icons.Shield />, desc: 'Protect a physical tree in nature' },
                { id: 'FAMILY', label: t('type_family'), icon: <Icons.Heart filled={true} />, desc: 'Shared roots with your loved ones' }
              ].map((type: any) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => { setTreeType(type.id); setPlantStep(2); }}
                  className={`flex items-center gap-4 p-4 rounded-xl text-left transition-all border ${
                    treeType === type.id 
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg scale-[1.02]' 
                      : treeType !== 'GUARDED' 
                        ? 'bg-white/10 text-white border-white/10 hover:bg-white/20' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className="text-2xl">{type.icon}</span>
                  <div>
                    <div className="font-bold uppercase tracking-wider text-xs">{type.label}</div>
                    <div className="text-xs opacity-70">{type.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {plantStep === 2 && (
          <div className="flex-1 flex flex-col gap-6 animate-in fade-in slide-in-from-right-4">
            <div className={`text-center ${treeType !== 'GUARDED' ? 'text-white' : 'text-slate-800'}`}>
              <h2 className="text-xl font-bold mb-2">Identify Your Tree</h2>
              <p className="text-sm opacity-70">Give your tree a name and a short title.</p>
            </div>
            <div className="flex flex-col gap-4">
              <input 
                dir="auto" 
                className={`block w-full border p-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all shadow-inner ${
                  treeType !== 'GUARDED' ? 'bg-white/10 border-white/20 text-white placeholder:text-white/50' : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
                }`} 
                placeholder={`Tree Name (Default: ${lightseed?.displayName || 'Anonymous'})`} 
                value={treeName} 
                onChange={e=>setTreeName(e.target.value)} 
                autoFocus
              />
              <input 
                dir="auto" 
                className={`block w-full border p-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all shadow-inner ${
                  treeType !== 'GUARDED' ? 'bg-white/10 border-white/20 text-white placeholder:text-white/50' : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
                }`} 
                placeholder={t('short_title')} 
                value={treeShortTitle} 
                onChange={e=>setTreeShortTitle(e.target.value)} 
              />
            </div>
            <div className="flex gap-2 mt-auto pb-4">
              <button onClick={() => setPlantStep(1)} className={`flex-1 py-3 rounded-xl font-bold uppercase tracking-widest transition-all ${treeType !== 'GUARDED' ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Back</button>
              <button onClick={() => setPlantStep(3)} className="flex-[2] py-3 rounded-xl font-bold uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg transition-all">Next</button>
            </div>
          </div>
        )}

        {plantStep === 3 && (
          <div className="flex-1 flex flex-col gap-6 animate-in fade-in slide-in-from-right-4">
            <div className={`text-center ${treeType !== 'GUARDED' ? 'text-white' : 'text-slate-800'}`}>
              <h2 className="text-xl font-bold mb-2">Plant the Vision</h2>
              <p className="text-sm opacity-70">Describe the intention behind this tree.</p>
            </div>
            <div className="flex flex-col gap-4">
              {treeType !== 'GUARDED' && (
                <div className="flex gap-2">
                  <input 
                    dir="auto" 
                    className="flex-1 border border-white/20 p-3 rounded-xl bg-white/10 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all" 
                    placeholder="Seed keywords" 
                    value={treeSeed} 
                    onChange={e=>setTreeSeed(e.target.value)} 
                  />
                  <button type="button" onClick={() => generateLifetreeBio(treeSeed).then(setTreeBio)} disabled={uploading} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 rounded-xl disabled:opacity-50 font-bold text-xs shadow-md transition-colors">AI</button>
                </div>
              )}
              <textarea 
                dir="auto"
                className={`block w-full border p-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all min-h-[150px] resize-none ${
                  treeType !== 'GUARDED' ? 'bg-white/10 border-white/20 text-white placeholder:text-white/50' : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
                }`} 
                placeholder={treeType === 'GUARDED' ? "Description" : "Vision"} 
                value={treeBio} 
                onChange={e=>setTreeBio(e.target.value)} 
                required 
              />
            </div>
            <div className="flex gap-2 mt-auto pb-4">
              <button onClick={() => setPlantStep(2)} className={`flex-1 py-3 rounded-xl font-bold uppercase tracking-widest transition-all ${treeType !== 'GUARDED' ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Back</button>
              <button onClick={() => setPlantStep(4)} className="flex-[2] py-3 rounded-xl font-bold uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg transition-all">Next</button>
            </div>
          </div>
        )}

        {plantStep === 4 && (
          <div className="flex-1 flex flex-col gap-6 animate-in fade-in slide-in-from-right-4">
            <div className={`text-center ${treeType !== 'GUARDED' ? 'text-white' : 'text-slate-800'}`}>
              <h2 className="text-xl font-bold mb-2">Give it a Face</h2>
              <p className="text-sm opacity-70">Upload an image of your tree or its intention.</p>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <ImagePicker 
                onImageSelect={(file) => {
                  setTreeFile(file);
                  handleImageUpload(file, `users/${lightseed?.uid}/trees/${Date.now()}`).then(setTreeImageUrl);
                }} 
                previewUrl={treeImageUrl} 
                loading={uploading} 
                isDark={treeType !== 'GUARDED'}
              />
            </div>
            <div className="flex gap-2 mt-auto pb-4">
              <button onClick={() => setPlantStep(3)} className={`flex-1 py-3 rounded-xl font-bold uppercase tracking-widest transition-all ${treeType !== 'GUARDED' ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Back</button>
              <button onClick={() => setPlantStep(5)} className="flex-[2] py-3 rounded-xl font-bold uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg transition-all">Next</button>
            </div>
          </div>
        )}

        {plantStep === 5 && (
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col gap-6 animate-in fade-in slide-in-from-right-4">
            <div className={`text-center ${treeType !== 'GUARDED' ? 'text-white' : 'text-slate-800'}`}>
              <h2 className="text-xl font-bold mb-2">Ground Your Tree</h2>
              <p className="text-sm opacity-70">Final details to connect your tree to the world.</p>
            </div>
            <div className="flex flex-col gap-4">
              <div className={`flex items-center justify-between p-4 rounded-xl border ${treeType === 'GUARDED' ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-black/30 border-white/10 text-white'}`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${plantLocation ? 'bg-emerald-500 text-white' : (treeType === 'GUARDED' ? 'bg-slate-200 text-slate-500' : 'bg-white/10 text-white/50')}`}>
                    <Icons.Loc />
                  </div>
                  <div className="text-xs">
                    {plantLocation ? (
                      <span className="font-mono text-emerald-400 font-bold">{plantLocation.latitude.toFixed(6)}, {plantLocation.longitude.toFixed(6)}</span>
                    ) : (
                      <span className="opacity-70">Location not set</span>
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
                  {isLocating ? 'Locating...' : 'Locate'}
                </button>
              </div>

              <AutocompleteInput
                className={`block w-full border p-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all shadow-inner ${
                  treeType !== 'GUARDED' ? 'bg-white/10 border-white/20 text-white placeholder:text-white/50' : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
                }`}
                placeholder="Website domain (e.g. myproject.com)"
                value={treeDomain}
                onChange={setTreeDomain}
              />
            </div>
            <div className="flex gap-2 mt-auto pb-4">
              <button type="button" onClick={() => setPlantStep(4)} className={`flex-1 py-3 rounded-xl font-bold uppercase tracking-widest transition-all ${treeType !== 'GUARDED' ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Back</button>
              <button type="submit" disabled={uploading || isSubmitting} className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold uppercase tracking-widest shadow-lg active:scale-95 transition-all">
                {isSubmitting ? t('planting') : t('plant_lifetree')}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
