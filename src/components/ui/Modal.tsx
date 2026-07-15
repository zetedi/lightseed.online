
import { ReactNode } from 'react';

interface ModalProps {
    children?: ReactNode;
    onClose: () => void;
    title: string;
    backgroundImage?: string;
    fullScreenOnMobile?: boolean;
    innerGlow?: boolean;
    wide?: boolean;
}

export const Modal = ({ children, onClose, title, backgroundImage, fullScreenOnMobile, innerGlow, wide }: ModalProps) => {
    const desktopWidth = wide ? 'sm:max-w-2xl' : 'sm:max-w-md';
    // z-[98]: above the mobile menu (95) so a modal opened from it isn't shown through, below
    // dialogs (100) so a confirm/alert still layers on top.
    return (
    <div className={`fixed inset-0 z-[98] flex items-center justify-center bg-slate-900/90 backdrop-blur-md ${fullScreenOnMobile ? 'p-0 sm:p-4' : 'p-4'}`}>
        <div
            className={`shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 ${backgroundImage ? 'text-white' : 'bg-white'} ${
                fullScreenOnMobile
                    ? `w-full h-full max-h-full rounded-none sm:h-auto sm:max-h-[90vh] sm:w-full ${desktopWidth} sm:rounded-2xl`
                    : `w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[90vh] rounded-2xl`
            }`}
            style={backgroundImage ? { backgroundImage: `url("${backgroundImage}")`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
        >
            <div className={`shrink-0 px-4 py-3 border-b flex justify-between items-center ${backgroundImage ? 'bg-slate-900/90 border-white/10 backdrop-blur-md' : 'bg-slate-50 border-slate-100'}`}>
                <h3 className={`font-semibold ${backgroundImage ? 'text-emerald-100 drop-shadow-md' : 'text-slate-800'}`}>{title}</h3>
                <button onClick={onClose} className={`p-1 rounded-full transition-colors ${backgroundImage ? 'text-white/80 hover:bg-white/20 hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'}`}>&times;</button>
            </div>
            <div className={`flex-1 overflow-y-auto p-4 ${backgroundImage ? 'bg-slate-900/90 backdrop-blur-md' : ''} ${innerGlow ? 'shadow-[inset_0_0_70px_rgba(16,185,129,0.35)]' : ''}`}>
                {children}
            </div>
        </div>
    </div>
    );
};
