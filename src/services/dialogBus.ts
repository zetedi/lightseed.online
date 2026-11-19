import { speak } from '../utils/translations';

// The dialog's BUS — the plain half of the app's alert and confirm, with no React in reach (the
// host in components/ui/Dialog.tsx is the face). It lives in services/ so a hook can ask a
// question without reaching up into the faces (ring 2026-11-19).

export type DialogReq = {
    id: number;
    message: string;
    title?: string;
    confirmText: string;
    cancelText: string | null; // null → alert (single OK button)
    danger?: boolean;
    resolve: (v: boolean) => void;
};

type DialogListener = (d: DialogReq | null) => void;
let listeners: DialogListener[] = [];
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

// The host arrives, and leaves.
export const attachDialogHost = (l: DialogListener): (() => void) => {
    listeners.push(l);
    return () => { listeners = listeners.filter(x => x !== l); };
};
