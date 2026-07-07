import { useEffect, useState } from 'react';

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

export const showConfirm = (
    message: string,
    opts: { title?: string; confirmText?: string; cancelText?: string; danger?: boolean } = {},
): Promise<boolean> =>
    new Promise(resolve => emit({
        id: ++counter,
        message,
        title: opts.title,
        confirmText: opts.confirmText || 'Confirm',
        cancelText: opts.cancelText || 'Cancel',
        danger: opts.danger,
        resolve,
    }));

export const showAlert = (message: string, title?: string): Promise<void> =>
    new Promise(resolve => emit({
        id: ++counter,
        message,
        title,
        confirmText: 'OK',
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

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={() => { if (dialog.cancelText !== null) close(false); }}
        >
            <div onClick={e => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150">
                {dialog.title && <h3 className="mb-2 text-lg font-bold text-slate-900">{dialog.title}</h3>}
                <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{dialog.message}</p>
                <div className="mt-6 flex justify-end gap-3">
                    {dialog.cancelText !== null && (
                        <button onClick={() => close(false)} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-200">{dialog.cancelText}</button>
                    )}
                    <button onClick={() => close(true)} className={`rounded-xl px-4 py-2 text-sm font-bold text-white shadow transition-colors ${dialog.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>{dialog.confirmText}</button>
                </div>
            </div>
        </div>
    );
};
