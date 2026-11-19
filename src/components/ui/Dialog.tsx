import { useEffect, useState } from 'react';
import { attachDialogHost, showAlert, showConfirm, type DialogReq } from '../../services/dialogBus';
import { MODAL_BACKDROP, MODAL_PANEL, MODAL_TITLE, modalButton } from './Modal';

// A tiny global, imperative dialog so any code can replace native alert()/confirm()
// with a styled modal:
//   await showAlert('Saved.')
//   if (await showConfirm('Delete this?', { danger: true })) { ... }
// Mount <DialogHost /> once near the app root.

// The asking itself is the bus's (services/dialogBus), re-exported here for the faces that
// have always imported it from this file.
export { showAlert, showConfirm };

export const DialogHost = () => {
    const [dialog, setDialog] = useState<DialogReq | null>(null);

    useEffect(() => {
        return attachDialogHost(d => setDialog(d));
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
                <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600 dark:text-slate-300">{dialog.message}</p>
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
