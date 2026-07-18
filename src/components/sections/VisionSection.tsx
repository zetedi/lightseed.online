import React, { useState } from 'react';
import RichTextEditor from '../ui/RichTextEditor';
import { SectionTitle } from '../ui/SectionTitle';
import { Icons } from '../ui/Icons';
import { sanitizeRichText } from '../../utils/sanitize';

// Being-generic vision section — any being's "what am I growing towards" (Indra's net).
// A community, a node or a person states a vision the same way; only where the draft lives
// (and therefore how it's persisted) differs, so the owner keeps the draft + Save binding
// (a community shares its Save with the Appearance tab) and passes them in. Genuinely
// entity-specific commitments — the community/node chain seal and tokenisation toggle —
// are injected through the `extras` slot by the owner. CommunityVision is a thin wrapper
// over this; EventsSection / IntelligenceSection follow the same pattern.

interface VisionSectionProps {
  canEdit: boolean;
  // The saved vision (rich text HTML), shown sanitized to non-editors.
  vision?: string;
  // The vision draft lives in the owner (persisted by its shared Save); this section only edits it.
  editValue: string;
  onChange: (value: string) => void;
  onSave: () => void;
  isSaving: boolean;
  saveDisabled: boolean;
  status: string | null;
  // Section heading (the owner names its own anatomy).
  title?: string;
  sub?: string;
  placeholder?: string;
  // Shown (as a paragraph) when no vision has been shared yet.
  emptyMessage?: string;
  // Being-specific blocks rendered after the vision (e.g. the community chain seal).
  extras?: React.ReactNode;
}

// Vision section — present the vision by default; the rich editor and its controls appear only
// when an editor actively chooses to edit (not merely because they *may*). The being-specific
// commitments in `extras` stay visible to owners regardless — they are node settings, not prose.
export const VisionSection: React.FC<VisionSectionProps> = ({
  canEdit,
  vision,
  editValue,
  onChange,
  onSave,
  isSaving,
  saveDisabled,
  status,
  title = 'Vision',
  sub,
  placeholder = 'Share your vision...',
  emptyMessage = 'No vision shared yet.',
  extras,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  return (
    <div>
      <SectionTitle title={title} sub={sub} />
      {canEdit && isEditing ? (
        <>
          <RichTextEditor value={editValue} onChange={onChange} placeholder={placeholder} />
          <div className="mt-6 flex items-center gap-3">
            <button onClick={() => { onSave(); setIsEditing(false); }} disabled={saveDisabled} className="rounded-2xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition-all hover:bg-emerald-700 disabled:opacity-50">
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
            <button onClick={() => setIsEditing(false)} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-50">
              Cancel
            </button>
            {status && <span className="text-sm text-slate-500">{status}</span>}
          </div>
        </>
      ) : (
        <div>
          <div className="prose prose-slate max-w-none text-slate-700 leading-relaxed break-words [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg" dangerouslySetInnerHTML={{ __html: vision ? sanitizeRichText(vision) : `<p>${emptyMessage}</p>` }} />
          {canEdit && (
            <button onClick={() => setIsEditing(true)} className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-500 transition-colors hover:border-emerald-200 hover:text-emerald-700">
              <Icons.Pencil /> Edit
            </button>
          )}
        </div>
      )}
      {extras}
    </div>
  );
};
