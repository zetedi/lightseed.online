
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Icons } from './ui/Icons';
import { Organisation, Lifetree } from '../types';
import { updateOrganisation, uploadImage, getTreesByDomain } from '../services/firebase';
import RichTextEditor from './ui/RichTextEditor';
import { ImagePicker } from './ui/ImagePicker';

interface OrganisationProfileProps {
  organisation: Organisation;
  onUpdate?: (updates: Partial<Organisation>) => void;
  onClose: () => void;
  currentUserId?: string;
  isAdmin?: boolean;
}

export const OrganisationProfile: React.FC<OrganisationProfileProps> = ({ 
  organisation, 
  onUpdate, 
  onClose, 
  currentUserId, 
  isAdmin 
}) => {
  const { t } = useLanguage();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(organisation.name);
  const [editVision, setEditVision] = useState(organisation.vision);
  const [editTheme, setEditTheme] = useState(organisation.theme || {});
  const [logoUrl, setLogoUrl] = useState(organisation.logoUrl || '');
  const [imageUrls, setImageUrls] = useState<string[]>(organisation.imageUrls || []);
  const [linkedTrees, setLinkedTrees] = useState<Lifetree[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const canEdit = currentUserId === organisation.ownerId || isAdmin;

  useEffect(() => {
    getTreesByDomain(organisation.domain).then(setLinkedTrees);
  }, [organisation.domain]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates = {
        name: editName,
        vision: editVision,
        imageUrls: imageUrls,
        theme: editTheme,
        logoUrl: logoUrl
      };
      await updateOrganisation(organisation.id, updates);
      if (onUpdate) onUpdate(updates);
      setIsEditing(false);
    } catch (e) {
      console.error(e);
      alert("Failed to save organization profile.");
    }
    setIsSaving(false);
  };

  const handleLogoUpload = async (file: File) => {
    try {
      const url = await uploadImage(file, `organisations/${organisation.id}/logo_${Date.now()}`);
      setLogoUrl(url);
    } catch (e) {
      console.error(e);
      alert("Failed to upload logo.");
    }
  };

  const handleAddImage = async (file: File) => {
    try {
      const url = await uploadImage(file, `organisations/${organisation.id}/${Date.now()}`);
      setImageUrls(prev => [...prev, url]);
    } catch (e) {
      console.error(e);
      alert("Failed to upload image.");
    }
  };

  const handleRemoveImage = (index: number) => {
    setImageUrls(prev => prev.filter((_, i) => i !== index));
    if (activeImageIndex >= imageUrls.length - 1) {
      setActiveImageIndex(Math.max(0, imageUrls.length - 2));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 animate-in fade-in duration-300">
      {/* Header */}
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 px-4 py-4 backdrop-blur-md flex items-center justify-between">
        <button onClick={onClose} className="flex items-center space-x-2 text-slate-600 hover:text-slate-900 font-medium">
          <Icons.ArrowLeft />
          <span>Back</span>
        </button>
        <h2 className="text-xl font-light tracking-wide text-slate-950">
          {isEditing ? "Editing Organisation" : organisation.name}
        </h2>
        <div className="min-w-[80px] flex justify-end">
          {canEdit && !isEditing && (
            <button 
              onClick={() => setIsEditing(true)} 
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full font-bold text-sm shadow-sm transition-colors flex items-center gap-1 border border-emerald-200"
            >
              <Icons.Pencil />
              <span>Edit</span>
            </button>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6 space-y-8">
        {/* Image Carousel */}
        <div className="relative aspect-[21/9] w-full rounded-2xl overflow-hidden shadow-xl bg-slate-200 group">
          {imageUrls.length > 0 ? (
            <>
              <img 
                src={imageUrls[activeImageIndex]} 
                className="w-full h-full object-cover transition-all duration-500"
                alt={organisation.name}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
              
              {imageUrls.length > 1 && (
                <>
                  <button 
                    onClick={() => setActiveImageIndex(prev => (prev - 1 + imageUrls.length) % imageUrls.length)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white p-2 rounded-full backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Icons.ArrowLeft />
                  </button>
                  <button 
                    onClick={() => setActiveImageIndex(prev => (prev + 1) % imageUrls.length)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white p-2 rounded-full backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Icons.ArrowRight />
                  </button>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2">
                    {imageUrls.map((_, i) => (
                      <div 
                        key={i} 
                        className={`w-2 h-2 rounded-full transition-all ${i === activeImageIndex ? 'bg-white w-4' : 'bg-white/50'}`}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <Icons.Image size={48} />
              <p className="mt-2">No images yet</p>
            </div>
          )}

          {isEditing && (
            <div className="absolute top-4 right-4 flex space-x-2">
              <ImagePicker onImageSelect={handleAddImage} className="bg-white/80 hover:bg-white p-2 rounded-full shadow-lg text-emerald-600 backdrop-blur-md">
                <Icons.Plus />
              </ImagePicker>
              {imageUrls.length > 0 && (
                <button 
                  onClick={() => handleRemoveImage(activeImageIndex)}
                  className="bg-white/80 hover:bg-red-50 p-2 rounded-full shadow-lg text-red-500 backdrop-blur-md"
                >
                  <Icons.Trash />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="md:col-span-2 space-y-8">
            <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center">
                <Icons.FingerPrint />
                <span className="ml-2">Our Vision</span>
              </h3>
              {isEditing ? (
                <RichTextEditor 
                  value={editVision} 
                  onChange={setEditVision} 
                  placeholder="Share your organization's vision..."
                />
              ) : (
                <div 
                  className="prose prose-slate max-w-none text-slate-700 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: organisation.vision || "<p>No vision shared yet.</p>" }}
                />
              )}
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {isEditing && (
              <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Branding & Theme</h3>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Logo</label>
                  <ImagePicker 
                    onImageSelect={handleLogoUpload} 
                    previewUrl={logoUrl} 
                    className="w-full aspect-square max-w-[120px] mx-auto rounded-2xl border-2 border-dashed border-slate-200"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Primary</label>
                    <input 
                      type="color" 
                      value={editTheme.primary || '#059669'} 
                      onChange={e => setEditTheme({...editTheme, primary: e.target.value})}
                      className="block w-full h-10 rounded-lg cursor-pointer border-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Secondary</label>
                    <input 
                      type="color" 
                      value={editTheme.secondary || '#0284c7'} 
                      onChange={e => setEditTheme({...editTheme, secondary: e.target.value})}
                      className="block w-full h-10 rounded-lg cursor-pointer border-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Accent</label>
                    <input 
                      type="color" 
                      value={editTheme.accent || '#f59e0b'} 
                      onChange={e => setEditTheme({...editTheme, accent: e.target.value})}
                      className="block w-full h-10 rounded-lg cursor-pointer border-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Background</label>
                    <input 
                      type="color" 
                      value={editTheme.background || '#B2713A'} 
                      onChange={e => setEditTheme({...editTheme, background: e.target.value})}
                      className="block w-full h-10 rounded-lg cursor-pointer border-none"
                    />
                  </div>
                </div>
              </section>
            )}

            <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Details</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Domain</label>
                  <p className="text-emerald-600 font-mono text-sm">{organisation.domain}</p>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Member since</label>
                  <p className="text-slate-600 text-sm">
                    {organisation.createdAt?.toDate ? organisation.createdAt.toDate().toLocaleDateString() : '—'}
                  </p>
                </div>
              </div>
            </section>

            <section className="bg-emerald-900 text-white p-6 rounded-3xl shadow-xl">
              <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-widest mb-4 flex items-center">
                <Icons.Tree />
                <span className="ml-2 text-white">Connected Trees</span>
              </h3>
              <div className="space-y-3">
                {linkedTrees.length > 0 ? linkedTrees.map(tree => (
                  <div key={tree.id} className="flex items-center space-x-3 bg-white/10 p-2 rounded-xl border border-white/5">
                    <img src={tree.imageUrl} className="w-10 h-10 rounded-lg object-cover" alt="" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate">{tree.name}</p>
                      <p className="text-[10px] text-emerald-300 uppercase tracking-tighter truncate">{tree.locationName}</p>
                    </div>
                  </div>
                )) : (
                  <p className="text-xs text-emerald-400 italic">No lifetrees linked to this domain yet.</p>
                )}
              </div>
            </section>

            {isEditing && (
              <div className="flex flex-col space-y-2 pt-4">
                <button 
                  onClick={handleSave} 
                  disabled={isSaving} 
                  className="w-full bg-emerald-600 text-white py-3 rounded-2xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save Profile"}
                </button>
                <button 
                  onClick={() => {
                    setIsEditing(false);
                    setEditName(organisation.name);
                    setEditVision(organisation.vision);
                    setImageUrls(organisation.imageUrls || []);
                  }} 
                  disabled={isSaving} 
                  className="w-full bg-slate-200 text-slate-700 py-3 rounded-2xl font-bold hover:bg-slate-300 transition-all"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
