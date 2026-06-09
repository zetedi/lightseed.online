
import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Icons } from './ui/Icons';
import { Community, Lifetree, Lightseed } from '../types';
import { updateCommunity, uploadImage, getTreesByDomain, deleteCommunity, createCommunityEvent } from '../services/firebase';
import RichTextEditor from './ui/RichTextEditor';
import { ImagePicker } from './ui/ImagePicker';
import { communityThemePresets, normalizeTheme } from '../utils/theme';

interface CommunityProfileProps {
  community: Community;
  onUpdate?: (updates: Partial<Community>) => void;
  onClose: () => void;
  currentUser?: Lightseed | null;
  currentUserId?: string;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
}

export const CommunityProfile: React.FC<CommunityProfileProps> = ({ 
  community, 
  onUpdate, 
  onClose, 
  currentUser,
  currentUserId, 
  isAdmin,
  isSuperAdmin
}) => {
  const { t } = useLanguage();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(community.name);
  const [editVision, setEditVision] = useState(community.vision);
  const [editTheme, setEditTheme] = useState(normalizeTheme(community.theme));
  const [logoUrl, setLogoUrl] = useState(community.logoUrl || '');
  const [imageUrls, setImageUrls] = useState<string[]>(community.imageUrls || []);
  const [linkedTrees, setLinkedTrees] = useState<Lifetree[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventBody, setEventBody] = useState('');
  const [eventImageUrls, setEventImageUrls] = useState<string[]>([]);
  const [isEventSaving, setIsEventSaving] = useState(false);
  const [isUploadingEventImage, setIsUploadingEventImage] = useState(false);

  const canEdit = currentUserId === community.ownerId || isSuperAdmin || isAdmin;
  const canDelete = currentUserId === community.ownerId || isSuperAdmin;

  useEffect(() => {
    getTreesByDomain(community.domain, currentUserId).then(setLinkedTrees);
  }, [community.domain, currentUserId]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates = {
        name: editName,
        vision: editVision,
        imageUrls: imageUrls,
        theme: normalizeTheme(editTheme),
        logoUrl: logoUrl
      };
      await updateCommunity(community.id, updates);
      if (onUpdate) onUpdate(updates);
      setIsEditing(false);
    } catch (e) {
      console.error(e);
      alert("Failed to save community profile.");
    }
    setIsSaving(false);
  };

  const handleDelete = async () => {
      if (!window.confirm("Are you sure you want to delete this community? This cannot be undone.")) return;
      setIsDeleting(true);
      try {
          await deleteCommunity(community.id);
          alert("Community deleted.");
          onClose();
          window.location.reload(); // Refresh to update lists
      } catch (e) {
          console.error(e);
          alert("Failed to delete community.");
      }
      setIsDeleting(false);
  }

  const handleLogoUpload = async (file: File) => {
    try {
      const url = await uploadImage(file, `communities/${community.id}/logo_${Date.now()}`);
      setLogoUrl(url);
    } catch (e) {
      console.error(e);
      alert("Failed to upload logo.");
    }
  };

  const handleAddImage = async (file: File) => {
    try {
      const url = await uploadImage(file, `communities/${community.id}/${Date.now()}`);
      setImageUrls(prev => [...prev, url]);
    } catch (e) {
      console.error(e);
      alert("Failed to upload image.");
    }
  };

  const handleAddEventImage = async (file: File) => {
    setIsUploadingEventImage(true);
    try {
      const url = await uploadImage(file, `communities/${community.id}/events/${Date.now()}`);
      setEventImageUrls(prev => [...prev, url]);
    } catch (e) {
      console.error(e);
      alert("Failed to upload event image.");
    }
    setIsUploadingEventImage(false);
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId || !eventTitle.trim() || isEventSaving) return;
    setIsEventSaving(true);
    try {
      await createCommunityEvent(community, {
        title: eventTitle.trim(),
        body: eventBody.trim(),
        content: eventBody.trim(),
        imageUrl: eventImageUrls[0] || '',
        imageUrls: eventImageUrls,
        eventDate: eventDate || '',
        eventLocation: eventLocation.trim(),
        authorId: currentUserId,
        authorName: currentUser?.displayName || 'Community Admin',
        authorPhoto: currentUser?.photoURL || undefined,
      });
      setEventTitle('');
      setEventDate('');
      setEventLocation('');
      setEventBody('');
      setEventImageUrls([]);
      alert("Event created.");
    } catch (error: any) {
      console.error(error);
      alert("Failed to create event: " + (error.message || 'Unknown error'));
    }
    setIsEventSaving(false);
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
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {logoUrl ? (
              <img src={logoUrl} className="h-full w-full object-cover" alt={`${community.name} logo`} />
            ) : (
              <span className="text-slate-400"><Icons.Globe /></span>
            )}
          </div>
          <h2 className="truncate text-xl font-light tracking-wide text-slate-950">
            {isEditing ? "Editing Community" : community.name}
          </h2>
        </div>
        <div className="min-w-[80px] flex justify-end gap-2">
          {canEdit && !isEditing && (
            <button 
              onClick={() => setIsEditing(true)} 
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full font-bold text-sm shadow-sm transition-colors flex items-center gap-1 border border-emerald-200"
            >
              <Icons.Pencil />
              <span>Edit</span>
            </button>
          )}
          {canDelete && !isEditing && (
              <button 
                onClick={handleDelete} 
                disabled={isDeleting}
                className="bg-red-50 hover:bg-red-100 text-red-700 px-4 py-2 rounded-full font-bold text-sm shadow-sm transition-colors flex items-center gap-1 border border-red-200"
              >
                <Icons.Trash />
                <span>Delete</span>
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
                alt={community.name}
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
                  placeholder="Share your community's vision..."
                />
              ) : (
                <div 
                  className="prose prose-slate max-w-none text-slate-700 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: community.vision || "<p>No vision shared yet.</p>" }}
                />
              )}
            </section>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {isEditing && (
              <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-5">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Branding & Theme</h3>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Community Name</label>
                  <input
                    dir="auto"
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="w-full h-11 bg-slate-50 border border-slate-200 rounded-xl px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Community name"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Logo</label>
                  <ImagePicker 
                    onImageSelect={handleLogoUpload} 
                    previewUrl={logoUrl} 
                    className="w-full aspect-square max-w-[120px] mx-auto rounded-2xl border-2 border-dashed border-slate-200"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase text-slate-400">Theme mood</label>
                  <div className="space-y-2">
                    {communityThemePresets.map((preset) => {
                      const active = editTheme.primary === preset.primary && editTheme.surface === preset.surface && editTheme.background === preset.background && editTheme.mode === preset.mode;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setEditTheme(normalizeTheme(preset))}
                          className={`w-full rounded-2xl border p-3 text-left transition-all ${active ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-100' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-bold text-slate-800">{preset.name}</div>
                              <div className="text-[11px] text-slate-500">{preset.description}</div>
                            </div>
                            <div className="flex shrink-0 overflow-hidden rounded-full border border-white shadow-sm">
                              {[preset.surface, preset.primary, preset.accent, preset.background].map((color, index) => (
                                <span key={`${preset.id}-${index}`} className="h-6 w-6" style={{ backgroundColor: color }} />
                              ))}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ['surface', 'Header'],
                    ['primary', 'Primary'],
                    ['accent', 'Accent'],
                    ['background', 'Background']
                  ].map(([key, label]) => (
                    <label key={key} className="space-y-1">
                      <span className="text-[10px] font-bold uppercase text-slate-400">{label}</span>
                      <input
                        type="color"
                        value={(editTheme as any)[key]}
                        onChange={e => setEditTheme(normalizeTheme({ ...editTheme, [key]: e.target.value }))}
                        className="block h-10 w-full cursor-pointer rounded-lg border border-slate-200 bg-white p-1"
                      />
                    </label>
                  ))}
                </div>
              </section>
            )}

            {!isEditing && (
              <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Brand</h3>
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                    {community.logoUrl ? <img src={community.logoUrl} className="h-full w-full object-cover" alt={`${community.name} logo`} /> : <Icons.Globe />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-800">{community.name}</p>
                    <div className="mt-2 flex overflow-hidden rounded-full border border-white shadow-sm">
                      {[editTheme.surface, editTheme.primary, editTheme.accent, editTheme.background].map((color, index) => (
                        <span key={`community-theme-${index}`} className="h-5 w-8" style={{ backgroundColor: color }} />
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {canEdit && (
              <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-400">
                  <Icons.Sparkles />
                  <span>Create Event</span>
                </h3>
                <form onSubmit={handleCreateEvent} className="space-y-3">
                  <input
                    dir="auto"
                    value={eventTitle}
                    onChange={e => setEventTitle(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Event title"
                    required
                  />
                  <input
                    type="datetime-local"
                    value={eventDate}
                    onChange={e => setEventDate(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <input
                    dir="auto"
                    value={eventLocation}
                    onChange={e => setEventLocation(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Location"
                  />
                  <textarea
                    dir="auto"
                    value={eventBody}
                    onChange={e => setEventBody(e.target.value)}
                    className="min-h-24 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Event details"
                  />
                  <div className="grid grid-cols-3 gap-2">
                    {eventImageUrls.map((url, index) => (
                      <div key={url} className="relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                        <img src={url} className="h-full w-full object-cover" alt={`Event image ${index + 1}`} />
                        <button
                          type="button"
                          onClick={() => setEventImageUrls(prev => prev.filter((_, i) => i !== index))}
                          className="absolute right-1 top-1 rounded-full bg-white/90 p-1 text-red-500 shadow-sm"
                          title="Remove image"
                        >
                          <Icons.Close />
                        </button>
                      </div>
                    ))}
                    <ImagePicker
                      onImageSelect={handleAddEventImage}
                      loading={isUploadingEventImage}
                      className="flex aspect-square cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 text-slate-400 hover:border-emerald-400 hover:text-emerald-600"
                    >
                      <Icons.Plus />
                    </ImagePicker>
                  </div>
                  <button
                    type="submit"
                    disabled={isEventSaving || isUploadingEventImage || !eventTitle.trim()}
                    className="w-full rounded-2xl bg-sky-600 py-3 text-sm font-bold text-white shadow-lg shadow-sky-600/20 transition-all hover:bg-sky-700 disabled:opacity-50"
                  >
                    {isEventSaving ? "Creating..." : "Create Event"}
                  </button>
                </form>
              </section>
            )}

            <section className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Details</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Domain</label>
                  <p className="text-emerald-600 font-mono text-sm">{community.domain}</p>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Member since</label>
                  <p className="text-slate-600 text-sm">
                    {community.createdAt?.toDate ? community.createdAt.toDate().toLocaleDateString() : '—'}
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
                    setEditName(community.name);
                    setEditVision(community.vision);
                    setImageUrls(community.imageUrls || []);
                    setLogoUrl(community.logoUrl || '');
                    setEditTheme(normalizeTheme(community.theme));
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
