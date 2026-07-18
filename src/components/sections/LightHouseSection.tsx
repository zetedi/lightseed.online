import React, { useState } from 'react';
import { Icons } from '../ui/Icons';
import { LightHouse } from '../../types';
import { SectionTitle } from '../ui/SectionTitle';
import { ImagePicker } from '../ui/ImagePicker';
import { LocationPicker } from '../ui/LocationPicker';
import { showAlert } from '../ui/Dialog';
import { LightHouseCard } from '../LightHouseCard';

// Being-generic lightHouses section — the sacred places that hold any being's lifetrees
// (Indra's net), shown as a card garden. Each card opens the Light House's own profile page;
// keepers consecrate new ones here. The owner shell loads (and visibility-gates) the list
// and passes it in — this section stays pure-presentational plus the consecration form.
// CommunityLightHouse is a thin wrapper over this.

// What a keeper consecrates: the fields createLightHouse persists (minus scope, which the
// owner shell supplies — domain / communityIds / ownerId).
export interface LightHouseDraft {
  name: string;
  body: string;
  imageUrl?: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  splatUrl?: string;
  // Private by default: 'community'. Opening a Light House wider is a deliberate act.
  visibility: 'community' | 'node' | 'public';
}

interface LightHouseSectionProps {
  // Section heading (the owner names its own anatomy).
  title: string;
  sub?: string;
  // The lightHouses this viewer may see (loaded and gated by the owner shell).
  lightHouses: LightHouse[];
  emptyMessage?: string;
  // Background for a card when the Light House has no image (the owner's theme accent).
  placeholderColor?: string;
  // Keepers may consecrate a Light House: show the form and receive the draft.
  canCreate?: boolean;
  onCreate?: (draft: LightHouseDraft) => Promise<void>;
  onUploadImage?: (file: File) => Promise<string>;
  // Click a card to open the Light House's own profile page.
  onOpen?: (lightHouse: LightHouse) => void;
  // Existing lightHouses (elsewhere in the network) this community could step into.
  adoptable?: LightHouse[];
  onAdopt?: (lightHouse: LightHouse) => Promise<void>;
}

export const LightHouseSection: React.FC<LightHouseSectionProps> = ({
  title,
  sub,
  lightHouses,
  emptyMessage = 'No Light House has been consecrated yet.',
  placeholderColor,
  canCreate = false,
  onCreate,
  onUploadImage,
  onOpen,
  adoptable = [],
  onAdopt,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [showAdopt, setShowAdopt] = useState(false);
  const [adoptingId, setAdoptingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [locationName, setLocationName] = useState('');
  const [splatUrl, setSplatUrl] = useState('');
  const [visibility, setVisibility] = useState<'community' | 'node' | 'public'>('community');
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const consecrate = async () => {
    if (!onCreate || !name.trim() || isSaving) return;
    setIsSaving(true);
    try {
      await onCreate({
        name: name.trim(),
        body: body.trim(),
        imageUrl: imageUrl || undefined,
        locationName: locationName.trim() || undefined,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        splatUrl: splatUrl.trim() || undefined,
        visibility,
      });
      setShowForm(false);
      setName(''); setBody(''); setImageUrl(''); setLocationName(''); setSplatUrl(''); setCoords(null); setVisibility('community');
    } catch (e: any) {
      showAlert(e?.message || 'Could not consecrate the Light House.');
    }
    setIsSaving(false);
  };

  const form = (
    <div className="mt-4 space-y-3 rounded-2xl border border-amber-100 bg-amber-50/40 p-4 text-left animate-in fade-in slide-in-from-bottom-2">
      <input dir="auto" value={name} onChange={e => setName(e.target.value)} placeholder="Name of the Light House"
        className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
      <textarea dir="auto" value={body} onChange={e => setBody(e.target.value)} placeholder="What this place holds…"
        className="min-h-[90px] w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
      {onUploadImage && (
        <ImagePicker
          onImageSelect={async (file) => {
            setIsUploading(true);
            try { setImageUrl(await onUploadImage(file)); } catch { showAlert('Could not upload the image.'); }
            setIsUploading(false);
          }}
          previewUrl={imageUrl}
          loading={isUploading}
          className="h-40"
        />
      )}
      <input value={locationName} onChange={e => setLocationName(e.target.value)} placeholder="Place name (e.g. The Olive Grove, Crete)"
        className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
      <div className="space-y-1">
        <p className="ml-1 text-[11px] text-slate-500">Tap the map to place the Light House; it will glow there in the forest.</p>
        <LocationPicker value={coords} onChange={setCoords} />
      </div>
      <input value={splatUrl} onChange={e => setSplatUrl(e.target.value)} placeholder="3D scene URL (Gaussian splat viewer, optional)"
        className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
      <div>
        <p className="ml-1 mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">Who may see it</p>
        <div className="grid grid-cols-3 gap-2">
          {([
            { v: 'community', label: 'Community', hint: 'members only (default)' },
            { v: 'node', label: 'Node', hint: 'anyone signed in' },
            { v: 'public', label: 'Public', hint: 'the whole world' },
          ] as const).map(o => (
            <button key={o.v} type="button" onClick={() => setVisibility(o.v)}
              className={`rounded-xl border px-2 py-2 text-center transition-all ${visibility === o.v ? 'border-amber-400 bg-amber-100 text-amber-800 ring-1 ring-amber-300' : 'border-slate-200 bg-white text-slate-500 hover:border-amber-200'}`}>
              <span className="block text-xs font-bold">{o.label}</span>
              <span className="block text-[9px] opacity-70">{o.hint}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={() => setShowForm(false)} className="flex-1 rounded-xl bg-slate-100 py-2.5 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-200">Cancel</button>
        <button onClick={consecrate} disabled={!name.trim() || isSaving}
          className="flex-[2] rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-white shadow transition-colors hover:bg-amber-600 disabled:opacity-50">
          {isSaving ? 'Consecrating…' : 'Consecrate'}
        </button>
      </div>
    </div>
  );

  const stepIn = async (s: LightHouse) => {
    if (!onAdopt || adoptingId) return;
    setAdoptingId(s.id);
    try {
      await onAdopt(s);
      setShowAdopt(false);
    } catch (e: any) {
      showAlert(e?.message || 'Could not step into the Light House.');
    }
    setAdoptingId(null);
  };

  const adoptPanel = (
    <div className="mt-4 space-y-2 rounded-2xl border border-amber-100 bg-amber-50/40 p-4 text-left animate-in fade-in slide-in-from-bottom-2">
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Light Houses open to step into</p>
      {adoptable.map(s => (
        <div key={s.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-2.5">
          <img src={s.imageUrl || '/lighthouse.webp'} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover bg-[#04070f]" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-slate-800">{s.name}</p>
            <p className="truncate text-[11px] text-slate-400">{s.locationName || s.domain || ''}</p>
          </div>
          <button onClick={() => stepIn(s)} disabled={adoptingId === s.id}
            className="shrink-0 rounded-full bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-amber-600 disabled:opacity-50">
            {adoptingId === s.id ? 'Stepping…' : 'Step in'}
          </button>
        </div>
      ))}
      <button onClick={() => setShowAdopt(false)} className="w-full rounded-xl bg-slate-100 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-200">Close</button>
    </div>
  );

  const keeperActions = canCreate && (
    <div className="flex flex-wrap justify-center gap-2">
      {onCreate && !showForm && (
        <button onClick={() => { setShowForm(true); setShowAdopt(false); }} className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-bold uppercase tracking-widest text-amber-700 transition-colors hover:bg-amber-100">
          {lightHouses.length === 0 ? 'Consecrate a Light House' : 'Consecrate another'}
        </button>
      )}
      {onAdopt && adoptable.length > 0 && !showAdopt && (
        <button onClick={() => { setShowAdopt(true); setShowForm(false); }} className="rounded-full border border-amber-200 bg-white px-4 py-2 text-xs font-bold uppercase tracking-widest text-amber-700 transition-colors hover:bg-amber-50">
          Step into a Light House
        </button>
      )}
    </div>
  );

  return (
    <div>
      <SectionTitle title={title} sub={sub} />
      {lightHouses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-slate-400">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-500"><Icons.Sun /></div>
          <p className="text-sm">{emptyMessage}</p>
          <div className="mt-4">{keeperActions}</div>
          {canCreate && onCreate && showForm && form}
          {canCreate && onAdopt && showAdopt && adoptPanel}
        </div>
      ) : (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {lightHouses.map(s => (
              <LightHouseCard key={s.id} lightHouse={s} onOpen={onOpen} placeholderColor={placeholderColor} />
            ))}
          </div>

          {keeperActions}
          {canCreate && onCreate && showForm && form}
          {canCreate && onAdopt && showAdopt && adoptPanel}
        </div>
      )}
    </div>
  );
};
