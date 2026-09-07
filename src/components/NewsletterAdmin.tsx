// The newsletter TEMPLATE below is email CONTENT, not UI: the staff author edits it before
// sending, and a recipient's language is unknown at authoring time — it stays English as data,
// like the stored invite messages (english-guard exempts nothing here; templates are literals
// inside strings, not speaking seats).
import { useEffect, useMemo, useRef, useState } from 'react';
import { getNewsletterDraftData, sendNewsletter } from '../services/firebase';
import { Loading } from './ui/Loading';
import { Icons } from './ui/Icons';
import { Modal, modalButton } from './ui/Modal';
import { useLanguage } from '../contexts/LanguageContext';
import type { Community } from '../types';
import { speak } from '../utils/translations';

const formatDate = (value: any) => {
    if (!value) return 'the beginning';
    const date = value.toDate ? value.toDate() : new Date(value);
    return date.toLocaleDateString();
};

const renderList = (items: string[]) =>
    items.length > 0
        ? `<ul>${items.map(item => `<li>${item}</li>`).join('')}</ul>`
        : `<p>No new entries in this section.</p>`;

// THE LETTER OF A PLACE (ring 2026-09-08): bound to ONE community — its keepers write and send
// it to those who subscribed at that place; the node's staff send the node's own the same way.
export const NewsletterAdmin = ({ community, onBack, embedded = false }: { community: Community; onBack: () => void; embedded?: boolean }) => {
    const { t } = useLanguage();
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [subject, setSubject] = useState('');
    const [html, setHtml] = useState('');
    const [lastSentLabel, setLastSentLabel] = useState('never');
    const [showConfirm, setShowConfirm] = useState(false);
    const [dialogMessage, setDialogMessage] = useState<string | null>(null);
    const editorRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const loadDraft = async () => {
            setLoading(true);
            try {
                const draft = await getNewsletterDraftData({ id: community.id, domain: community.domain, newsletterLastSentAt: (community as any).newsletterLastSentAt });
                const today = new Date().toLocaleDateString();
                const placeName = community.name || 'lightseed';
                const treeItems = draft.trees.map(tree => `${tree.name}${tree.locationName ? `, ${tree.locationName}` : ''}`);
                const visionItems = draft.visions.map(vision => `${vision.title} by ${vision.authorId.slice(0, 6)}...`);
                const pulseItems = draft.pulses.map(pulse => `${pulse.title} by ${pulse.authorName}`);

                setLastSentLabel(formatDate(draft.lastSentAt));
                setSubject(`${placeName} — ${today}`);
                setHtml(`
<div style="font-family: Georgia, serif; color: #1f2937; line-height: 1.7; max-width: 760px; margin: 0 auto; padding: 32px;">
  <h1 style="font-weight: 400; color: #065f46; margin-bottom: 8px;">${placeName}</h1>
  <p style="margin-top: 0; color: #64748b;">Updates since ${formatDate(draft.lastSentAt)}</p>
  <p>Hello from ${placeName},</p>
  <p>Here is the latest letter. You can edit any section before sending.</p>
  <h2 style="margin-top: 32px; color: #7c2d12;">New Trees</h2>
  ${renderList(treeItems)}
  <h2 style="margin-top: 32px; color: #7c2d12;">New Visions</h2>
  ${renderList(visionItems)}
  <h2 style="margin-top: 32px; color: #7c2d12;">New Pulses</h2>
  ${renderList(pulseItems)}
  <h2 style="margin-top: 32px; color: #7c2d12;">Letter</h2>
  <p>Add your reflection here.</p>
  <p style="margin-top: 40px;">With gratitude,<br/>${placeName}</p>
</div>`.trim());
            } finally {
                setLoading(false);
            }
        };

        loadDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the place's primitives: the community object's identity churns with every autosave, and reloading the draft would clobber the letter being written
    }, [community.id, community.domain, community.name]);

    useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== html) {
            editorRef.current.innerHTML = html;
        }
    }, [html]);

    const preview = useMemo(() => ({ __html: html }), [html]);

    const runEditorCommand = (command: string, value?: string) => {
        editorRef.current?.focus();
        document.execCommand(command, false, value);
        setHtml(editorRef.current?.innerHTML || '');
    };

    const handleSend = async () => {
        if (!subject.trim() || !html.trim()) return;
        setSending(true);
        try {
            const count = await sendNewsletter({ subject: subject.trim(), html, communityId: community.id });
            setDialogMessage(speak('newsletter_sent_count', { count }));
        } catch (e: any) {
            // The server refuses with a domain key (newsletter_not_keeper, newsletter_no_subscribers) — spoken in the reader's tongue.
            const key = String(e?.message || '').replace(/^.*?(newsletter_[a-z_]+).*$/, '$1');
            setDialogMessage(key.startsWith('newsletter_') ? speak(key) : (e?.message || speak('err_save_retry')));
        }
        setSending(false);
        setShowConfirm(false);
    };

    if (loading) {
        return <div className="max-w-6xl mx-auto px-4 py-10"><Loading /></div>;
    }

    return (
        <>
            <div className={embedded ? 'space-y-6' : 'max-w-6xl mx-auto px-4 py-8 space-y-6'}>
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        {!embedded && (
                            <button onClick={onBack} className="mb-3 flex items-center gap-2 text-emerald-100 hover:text-white text-sm">
                                <Icons.ArrowLeft />
                                <span>{t('back_to_profile')}</span>
                            </button>
                        )}
                        <h1 className={`text-3xl font-light ${embedded ? 'text-slate-800' : 'text-white'}`}>{t('newsletter_of_place').replace('{place}', community.name || 'lightseed')}</h1>
                        <p className={`text-sm ${embedded ? 'text-slate-500' : 'text-emerald-100/80'}`}>Last letter sent: {lastSentLabel}</p>
                    </div>
                    <button
                        onClick={() => setShowConfirm(true)}
                        disabled={sending}
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2"
                    >
                        <Icons.Send />
                        <span>{sending ? 'Sending...' : 'Send Newsletter'}</span>
                    </button>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Subject</label>
                            <input
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">HTML Letter</label>
                            <div className="mb-3 flex flex-wrap gap-2">
                                <button type="button" onClick={() => runEditorCommand('bold')} className="rounded border border-slate-300 px-2 py-1 text-xs font-bold">B</button>
                                <button type="button" onClick={() => runEditorCommand('italic')} className="rounded border border-slate-300 px-2 py-1 text-xs italic">I</button>
                                <button type="button" onClick={() => runEditorCommand('underline')} className="rounded border border-slate-300 px-2 py-1 text-xs underline">U</button>
                                <button type="button" onClick={() => runEditorCommand('formatBlock', '<h2>')} className="rounded border border-slate-300 px-2 py-1 text-xs">H2</button>
                                <button type="button" onClick={() => runEditorCommand('insertUnorderedList')} className="rounded border border-slate-300 px-2 py-1 text-xs">UL</button>
                                <button type="button" onClick={() => runEditorCommand('insertOrderedList')} className="rounded border border-slate-300 px-2 py-1 text-xs">OL</button>
                                <button type="button" onClick={() => runEditorCommand('formatBlock', '<blockquote>')} className="rounded border border-slate-300 px-2 py-1 text-xs">Quote</button>
                                <button type="button" onClick={() => runEditorCommand('removeFormat')} className="rounded border border-slate-300 px-2 py-1 text-xs">Clear</button>
                            </div>
                            <div
                                ref={editorRef}
                                contentEditable
                                suppressContentEditableWarning
                                onInput={() => setHtml(editorRef.current?.innerHTML || '')}
                                className="min-h-[520px] w-full rounded-lg border border-slate-300 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">Preview</h2>
                        <div className="rounded-xl border border-slate-200 bg-[#fffdf8] p-4 min-h-[520px]" dangerouslySetInnerHTML={preview} />
                    </div>
                </div>
            </div>
            {showConfirm && (
                <Modal title="Confirm Newsletter" onClose={() => setShowConfirm(false)}>
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600">{t('newsletter_send_confirm')}</p>
                        <div className="flex gap-3">
                            <button type="button" onClick={() => setShowConfirm(false)} className={modalButton('secondary', { extra: 'flex-1' })}>{t('cancel')}</button>
                            <button type="button" onClick={handleSend} className={modalButton('primary', { extra: 'flex-1' })}>{t('send')}</button>
                        </div>
                    </div>
                </Modal>
            )}
            {dialogMessage && (
                <Modal title="Newsletter" onClose={() => setDialogMessage(null)}>
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600">{dialogMessage}</p>
                        <button type="button" onClick={() => setDialogMessage(null)} className={modalButton('primary')}>{t('close')}</button>
                    </div>
                </Modal>
            )}
        </>
    );
};
