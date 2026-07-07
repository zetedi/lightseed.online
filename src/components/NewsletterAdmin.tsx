import { useEffect, useMemo, useRef, useState } from 'react';
import { getNewsletterDraftData, sendNewsletter } from '../services/firebase';
import { Loading } from './ui/Loading';
import { Icons } from './ui/Icons';
import { Modal } from './ui/Modal';

const formatDate = (value: any) => {
    if (!value) return 'the beginning';
    const date = value.toDate ? value.toDate() : new Date(value);
    return date.toLocaleDateString();
};

const renderList = (items: string[]) =>
    items.length > 0
        ? `<ul>${items.map(item => `<li>${item}</li>`).join('')}</ul>`
        : `<p>No new entries in this section.</p>`;

export const NewsletterAdmin = ({ senderUid, onBack }: { senderUid: string; onBack: () => void }) => {
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
                const draft = await getNewsletterDraftData();
                const today = new Date().toLocaleDateString();
                const treeItems = draft.trees.map(tree => `${tree.name}${tree.locationName ? ` — ${tree.locationName}` : ''}`);
                const visionItems = draft.visions.map(vision => `${vision.title} by ${vision.authorId.slice(0, 6)}...`);
                const pulseItems = draft.pulses.map(pulse => `${pulse.title} by ${pulse.authorName}`);

                setLastSentLabel(formatDate(draft.lastSentAt));
                setSubject(`lightseed newsletter — ${today}`);
                setHtml(`
<div style="font-family: Georgia, serif; color: #1f2937; line-height: 1.7; max-width: 760px; margin: 0 auto; padding: 32px;">
  <h1 style="font-weight: 400; color: #065f46; margin-bottom: 8px;">lightseed newsletter</h1>
  <p style="margin-top: 0; color: #64748b;">Updates since ${formatDate(draft.lastSentAt)}</p>
  <p>Hello from the network,</p>
  <p>Here is the latest letter from lightseed. You can edit any section before sending.</p>
  <h2 style="margin-top: 32px; color: #7c2d12;">New Trees</h2>
  ${renderList(treeItems)}
  <h2 style="margin-top: 32px; color: #7c2d12;">New Visions</h2>
  ${renderList(visionItems)}
  <h2 style="margin-top: 32px; color: #7c2d12;">New Pulses</h2>
  ${renderList(pulseItems)}
  <h2 style="margin-top: 32px; color: #7c2d12;">Letter</h2>
  <p>Add your reflection here.</p>
  <p style="margin-top: 40px;">With gratitude,<br/>lightseed</p>
</div>`.trim());
            } finally {
                setLoading(false);
            }
        };

        loadDraft();
    }, []);

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
            const count = await sendNewsletter({ subject: subject.trim(), html, senderUid });
            setDialogMessage(`Newsletter sent to ${count} subscribers.`);
        } catch (e: any) {
            setDialogMessage(e.message || 'Failed to send newsletter.');
        }
        setSending(false);
        setShowConfirm(false);
    };

    if (loading) {
        return <div className="max-w-6xl mx-auto px-4 py-10"><Loading /></div>;
    }

    return (
        <>
            <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <button onClick={onBack} className="mb-3 flex items-center gap-2 text-emerald-100 hover:text-white text-sm">
                            <Icons.ArrowLeft />
                            <span>Back to Profile</span>
                        </button>
                        <h1 className="text-3xl font-light text-white">Send Newsletter</h1>
                        <p className="text-sm text-emerald-100/80">Last newsletter sent: {lastSentLabel}</p>
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
                        <p className="text-sm text-slate-600">Send this newsletter to all subscribed users?</p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowConfirm(false)} className="flex-1 rounded-lg bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700">Cancel</button>
                            <button onClick={handleSend} className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white">Send</button>
                        </div>
                    </div>
                </Modal>
            )}
            {dialogMessage && (
                <Modal title="Newsletter" onClose={() => setDialogMessage(null)}>
                    <div className="space-y-4">
                        <p className="text-sm text-slate-600">{dialogMessage}</p>
                        <button onClick={() => setDialogMessage(null)} className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white">Close</button>
                    </div>
                </Modal>
            )}
        </>
    );
};
