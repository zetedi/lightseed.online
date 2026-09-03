import { useEffect, useState } from 'react';
import { speak } from '../../utils/translations';
import { MODAL_BACKDROP, MODAL_PANEL, MODAL_TITLE, modalButton } from './Modal';

// A tiny global, imperative dialog so any code can replace native alert()/confirm()
// with a styled modal:
//   await showAlert('Saved.')
//   if (await showConfirm('Delete this?', { danger: true })) { ... }
// Mount <DialogHost /> once near the app root.

type DialogReq = {
    id: number;
    message: string;
    title?: string;
    confirmText: string;
    cancelText: string | null; // null → alert (single OK button)
    danger?: boolean;
    resolve: (v: boolean) => void;
};

let listeners: ((d: DialogReq | null) => void)[] = [];
let counter = 0;
const emit = (d: DialogReq) => listeners.forEach(l => l(d));

// Every string entering a dialog goes through speak(): a translation KEY says itself in the
// reader's language (this is how thrown key-errors surface translated), any other string passes
// through untouched. The default buttons are keys, so OK/Confirm/Cancel speak too.
export const showConfirm = (
    message: string,
    opts: { title?: string; confirmText?: string; cancelText?: string; danger?: boolean } = {},
): Promise<boolean> =>
    new Promise(resolve => emit({
        id: ++counter,
        message: speak(message),
        title: opts.title ? speak(opts.title) : undefined,
        confirmText: speak(opts.confirmText || 'confirm'),
        cancelText: speak(opts.cancelText || 'cancel'),
        danger: opts.danger,
        resolve,
    }));

export const showAlert = (message: string, title?: string): Promise<void> =>
    new Promise(resolve => emit({
        id: ++counter,
        message: speak(message),
        title: title ? speak(title) : undefined,
        confirmText: speak('ok'),
        cancelText: null,
        resolve: () => resolve(),
    }));

export const DialogHost = () => {
    const [dialog, setDialog] = useState<DialogReq | null>(null);

    useEffect(() => {
        const l = (d: DialogReq | null) => setDialog(d);
        listeners.push(l);
        return () => { listeners = listeners.filter(x => x !== l); };
    }, []);

    if (!dialog) return null;
    const close = (v: boolean) => { dialog.resolve(v); setDialog(null); };

    // z-[100]: above an open Modal (98), so a confirm asked from inside one still layers up.
    // The skin is the one modal shell's (ui/Modal); only the stacking is its own.
    return (
        <div
            className={`${MODAL_BACKDROP} z-[100] p-4`}
            onClick={() => { if (dialog.cancelText !== null) close(false); }}
        >
            <div role="alertdialog" aria-modal="true" onClick={e => e.stopPropagation()} className={`${MODAL_PANEL} max-w-sm p-6`}>
                {dialog.title && <h3 className={`mb-2 text-base ${MODAL_TITLE}`}>{dialog.title}</h3>}
                <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{dialog.message}</p>
                <div className="mt-6 flex justify-end gap-3">
                    {dialog.cancelText !== null && (
                        <button type="button" onClick={() => close(false)} className={modalButton('secondary', { full: false })}>{dialog.cancelText}</button>
                    )}
                    <button type="button" onClick={() => close(true)} className={modalButton(dialog.danger ? 'danger' : 'primary', { full: false })}>{dialog.confirmText}</button>
                </div>
            </div>
        </div>
    );
};
