import React, { useState, useEffect } from 'react';
import { Icons } from '../ui/Icons';
import { Intelligence, Persona } from '../../types';
import { getSelectableIntelligences, listPersonas, type CredentialScope } from '../../services/intelligence';
import { SectionTitle } from '../ui/SectionTitle';
import { IntelligencePanel } from '../intelligence/IntelligencePanel';

// Entity-generic intelligence section — any being's intelligences (Indra's net). "Which
// intelligences stand here, and which speaks by default" is the same question for a community,
// a node or a person; only where the selection is rooted (and therefore how it's persisted)
// differs, so the owner binds that via `onSave`. CommunityIntelligence is a thin wrapper over
// this; node- and personal-profile intelligence tabs can bind their own scoping. (The personal
// profile currently keeps a bare IntelligencePanel — one preferred voice, no curated
// available-set — so it stays unbound until it grows the same selection shape.)
//
// The selectable pool itself (public + viewer-owned) is viewer-scoped, not entity-scoped,
// so the section fetches it directly.

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google · Gemini',
  openai: 'OpenAI',
  anthropic: 'Anthropic · Claude',
  deepseek: 'DeepSeek',
  local: 'Local model',
};

// The persisted intelligence selection of an entity: its default voice plus the set it offers.
export interface IntelligenceSelection {
  defaultIntelligenceId: string;
  availableIntelligenceIds: string[];
}

interface IntelligenceSectionProps {
  // Credential scope the embedded panel manages keys under.
  scope: CredentialScope;
  canEdit: boolean;
  // The signed-in viewer — drives the selectable pool (public + owned) and panel ownership checks.
  currentUserId?: string;
  // The owning entity: id keys the edit-state reset when the entity (or its saved data) changes.
  entityId: string;
  // Entity id the panel's provider credentials are stored under (usually === entityId).
  credentialOwnerId: string;
  // Uid that owns intelligence docs created from the panel (the entity's owner).
  intelligenceOwnerUid: string;
  // Staff/superadmin — may enable/disable shared intelligences in the panel too.
  canManageAll?: boolean;
  // Current persisted selection on the entity.
  defaultIntelligenceId?: string;
  availableIntelligenceIds?: string[];
  // Persist the selection on the entity (used by both quick-select and the Save button).
  // Community/node/personal scoping is the caller's concern.
  onSave: (selection: IntelligenceSelection) => Promise<unknown>;
  // Notify the owner after an explicit save (e.g. to mirror the updates into parent state).
  onSaved?: (selection: IntelligenceSelection) => void;
  // Section heading (the owner names its own anatomy).
  title: string;
  sub?: string;
  // Panel heading (IntelligencePanel falls back to its own defaults when omitted).
  panelTitle?: string;
  panelSubtitle?: string;
  // Theme accent for the default badge and save button (falls back to the shared emerald).
  accentColor?: string;
}

// Intelligence section — choose which intelligences serve this being and which is the default.
export const IntelligenceSection: React.FC<IntelligenceSectionProps> = ({
  scope,
  canEdit,
  currentUserId,
  entityId,
  credentialOwnerId,
  intelligenceOwnerUid,
  canManageAll,
  defaultIntelligenceId,
  availableIntelligenceIds,
  onSave,
  onSaved,
  title,
  sub,
  panelTitle,
  panelSubtitle,
  accentColor,
}) => {
  const [intelligences, setIntelligences] = useState<Intelligence[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [editDefaultIntelligenceId, setEditDefaultIntelligenceId] = useState(defaultIntelligenceId || '');
  const [editAvailableIntelligenceIds, setEditAvailableIntelligenceIds] = useState<string[]>(availableIntelligenceIds || []);
  const [isSavingIntel, setIsSavingIntel] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Accent is opt-in: when the owner passes none, the shared emerald classes stand untouched.
  const accentStyle = accentColor ? { backgroundColor: accentColor } : undefined;

  // Keep editable copies in sync whenever the entity's saved selection changes (e.g. after refresh).
  useEffect(() => {
    setEditDefaultIntelligenceId(defaultIntelligenceId || '');
    setEditAvailableIntelligenceIds(availableIntelligenceIds || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the joined ids (value, not array identity) so equal-array refreshes don't clobber unsaved toggles
  }, [entityId, defaultIntelligenceId, (availableIntelligenceIds || []).join(',')]);

  // Intelligences an editor can choose from (public + owned), plus persona names.
  useEffect(() => {
    if (!canEdit) return;
    getSelectableIntelligences(currentUserId).then(setIntelligences).catch(() => {});
    listPersonas().then(setPersonas).catch(() => {});
  }, [canEdit, currentUserId]);

  const personaName = (id?: string) => personas.find(p => p.id === id)?.name;

  // Toggle whether an intelligence is available to this entity; keep the default valid.
  const toggleAvailable = (id: string) => {
    setEditAvailableIntelligenceIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      if (!next.includes(editDefaultIntelligenceId)) setEditDefaultIntelligenceId(next[0] || '');
      return next;
    });
  };

  const setDefaultIntelligence = (id: string) => {
    setEditDefaultIntelligenceId(id);
    setEditAvailableIntelligenceIds(prev => prev.includes(id) ? prev : [...prev, id]);
  };

  const handleSaveIntelligence = async () => {
    setIsSavingIntel(true);
    setStatus(null);
    try {
      const updates: IntelligenceSelection = {
        defaultIntelligenceId: editDefaultIntelligenceId || '',
        availableIntelligenceIds: editAvailableIntelligenceIds,
      };
      await onSave(updates);
      if (onSaved) onSaved(updates);
      setStatus('Saved.');
      setTimeout(() => setStatus(null), 2500);
    } catch (e) {
      console.error(e);
      setStatus('Failed to save. Please try again.');
    }
    setIsSavingIntel(false);
  };

  return (
    <div>
      <SectionTitle title={title} sub={sub} />

      <div className="mb-8">
        <IntelligencePanel
          scope={scope}
          credentialOwnerId={credentialOwnerId}
          intelligenceOwnerUid={intelligenceOwnerUid}
          viewerUid={currentUserId}
          canManageAll={!!canManageAll}
          selectedIntelligenceId={editDefaultIntelligenceId}
          title={panelTitle}
          subtitle={panelSubtitle}
          onSelect={(id) => {
            setEditDefaultIntelligenceId(id);
            const nextAvailable = Array.from(new Set([...editAvailableIntelligenceIds, id]));
            setEditAvailableIntelligenceIds(nextAvailable);
            onSave({ defaultIntelligenceId: id, availableIntelligenceIds: nextAvailable }).catch(() => {});
          }}
        />
      </div>

      <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-400">All available intelligences</h4>
      {intelligences.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center text-slate-400">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-500"><Icons.Wizard /></div>
          <p className="text-sm">No intelligences are available yet. A super-admin seeds the commons on first load.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {intelligences.map(intel => {
            const available = editAvailableIntelligenceIds.includes(intel.id);
            const isDefault = editDefaultIntelligenceId === intel.id;
            return (
              <div key={intel.id} className={`rounded-2xl border p-4 transition-all ${available ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="break-words text-base font-bold text-slate-800">{intel.name}</h3>
                      {isDefault && <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white" style={accentStyle}>Default</span>}
                    </div>
                    {intel.description && <p className="mt-1 text-sm text-slate-500">{intel.description}</p>}
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-600">{PROVIDER_LABELS[intel.provider] || intel.provider}</span>
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 font-mono text-slate-500">{intel.model}</span>
                      {personaName(intel.personaId) && <span className="rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-purple-700">Persona · {personaName(intel.personaId)}</span>}
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-slate-500">{(intel.memoryIds || []).length} memory {(intel.memoryIds || []).length === 1 ? 'source' : 'sources'}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <button
                      type="button"
                      onClick={() => toggleAvailable(intel.id)}
                      className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${available ? 'bg-emerald-100 text-emerald-700 hover:bg-red-50 hover:text-red-600' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                    >
                      {available ? 'Enabled' : 'Enable'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDefaultIntelligence(intel.id)}
                      disabled={isDefault}
                      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${isDefault ? 'text-emerald-600' : 'text-slate-400 hover:text-slate-700'}`}
                    >
                      {isDefault ? '★ Default' : 'Set default'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button onClick={handleSaveIntelligence} disabled={isSavingIntel} className="rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-700 disabled:opacity-50" style={accentStyle}>
          {isSavingIntel ? 'Saving...' : 'Save Intelligence'}
        </button>
        {status && <span className="text-sm text-slate-500">{status}</span>}
      </div>
    </div>
  );
};
