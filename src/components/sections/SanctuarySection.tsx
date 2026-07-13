import React, { useState } from 'react';
import { Icons } from '../ui/Icons';
import { Sanctuary } from '../../types';
import { SectionTitle } from '../ui/SectionTitle';
import { ImagePicker } from '../ui/ImagePicker';
import { LocationPicker } from '../ui/LocationPicker';
import { showAlert } from '../ui/Dialog';
import { sanctuaryVisibility } from '../../domain/sanctuary';

// Being-generic sanctuaries section — the sacred places that hold any being's lifetrees
// (Indra's net), shown as a card garden. Each card opens the sanctuary's own profile page;
// keepers consecrate new ones here. The owner shell loads (and visibility-gates) the list
// and passes it in — this section stays pure-presentational plus the consecration form.
// CommunitySanctuary is a thin wrapper over this.

// What a keeper consecrates: the fields createSanctuary persists (minus scope, which the
// owner shell supplies — domain / communityIds / ownerId).
export interface SanctuaryDraft {
  name: string;
  body: string;
  imageUrl?: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  splatUrl?: string;
  // Private by default: 'community'. Opening a sanctuary wider is a deliberate act.
  visibility: 'community' | 'node' | 'public';
}

interface SanctuarySectionProps {
  // Section heading (the owner names its own anatomy).
  title: string;
  sub?: string;
  // The sanctuaries this viewer may see (loaded and gated by the owner shell).
  sanctuaries: Sanctuary[];
  emptyMessage?: string;
  // Background for a card when the sanctuary has no image (the owner's theme accent).
  placeholderColor?: string;
  // Keepers may consecrate a sanctuary: show the form and receive the draft.
  canCreate?: boolean;
  onCreate?: (draft: SanctuaryDraft) => Promise<void>;
  onUploadImage?: (file: File) => Promise<string>;
  // Click a card to open the sanctuary's own profile page.
  onOpen?: (sanctuary: Sanctuary) => void;
}

export const SanctuarySection: React.FC<SanctuarySectionProps> = ({
  title,
  sub,
  sanctuaries,
  emptyMessage = 'No sanctuary has been consecrated yet.',
  placeholderColor,
  canCreate = false,
  onCreate,
  onUploadImage,
  onOpen,
}) => {
  const [showForm, setShowForm] = useState(false);
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
      showAlert(e?.message || 'Could not consecrate the sanctuary.');
    }
    setIsSaving(false);
  };

  const form = (
    <div className="mt-4 space-y-3 rounded-2xl border border-amber-100 bg-amber-50/40 p-4 text-left animate-in fade-in slide-in-from-bottom-2">
      <input dir="auto" value={name} onChange={e => setName(e.target.value)} placeholder="Name of the sanctuary"
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
        <p className="ml-1 text-[11px] text-slate-500">Tap the map to place the sanctuary — it will glow there in the forest.</p>
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

  return (
    <div>
      <SectionTitle title={title} sub={sub} />
      {sanctuaries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-slate-400">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-500"><Icons.Sun /></div>
          <p className="text-sm">{emptyMessage}</p>
          {canCreate && onCreate && !showForm && (
            <button onClick={() => setShowForm(true)} className="mt-4 rounded-full bg-amber-500 px-5 py-2 text-xs font-bold uppercase tracking-widest text-white shadow transition-colors hover:bg-amber-600">
              Consecrate a sanctuary
            </button>
          )}
          {canCreate && onCreate && showForm && form}
        </div>
      ) : (
        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sanctuaries.map(s => (
              <div
                key={s.id}
                className={`group relative h-56 overflow-hidden rounded-2xl shadow-lg ring-1 ring-amber-200/60 ${onOpen ? 'cursor-pointer' : ''}`}
                onClick={onOpen ? () => onOpen(s) : undefined}
                role={onOpen ? 'button' : undefined}
                aria-label={onOpen ? `Open ${s.name}` : undefined}
              >
                {s.imageUrl ? (
                  <img src={s.imageUrl} className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" alt={s.name} />
                ) : (
                  <div className="absolute inset-0" style={{ backgroundColor: placeholderColor || '#04070f' }}>
                    <img src="/mahameru.svg" className="h-full w-full object-cover opacity-80" alt="" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-black/10" />
                {/* The glow every sanctuary wears — the same warmth as its map marker. */}
                <div className="pointer-events-none absolute -inset-8 rounded-full opacity-40" style={{ background: 'radial-gradient(circle, rgba(253,224,71,0.35) 0%, transparent 70%)' }} />
                <div className="absolute right-3 top-3 flex items-center gap-1.5">
                  {s.splatUrl && <span className="rounded-full bg-amber-500/90 px-2 py-0.5 text-[9px] font-bold text-white">3D ✦</span>}
                  <span className="rounded-full bg-black/40 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-100 backdrop-blur">{sanctuaryVisibility(s)}</span>
                </div>
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <h3 className="break-words text-lg font-light tracking-wide">{s.name}</h3>
                  {s.locationName && <p className="mt-0.5 flex items-center gap-1 text-[11px] text-amber-100/90"><Icons.Loc /> {s.locationName}</p>}
                </div>
              </div>
            ))}
          </div>

          {canCreate && onCreate && (
            showForm ? form : (
              <button onClick={() => setShowForm(true)} className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-bold uppercase tracking-widest text-amber-700 transition-colors hover:bg-amber-100">
                Consecrate another
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
};
