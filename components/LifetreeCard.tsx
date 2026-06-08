
import React, { useRef, useState, ChangeEvent } from 'react';
import { type Lifetree } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { Icons } from './ui/Icons';
import Logo from './Logo';
import { ValidationBadge } from './ValidationBadge';
import { colors } from '../utils/theme';
import { canToggleValidation, isExplicitlyValidatedTree } from '../utils/validation';

interface LifetreeCardProps {
    tree: Lifetree;
    myActiveTree: Lifetree | null;
    isAdmin?: boolean;
    isSuperAdmin?: boolean;
    currentUserId?: string;
    onValidate: (id: string, nextValidated: boolean) => Promise<void>;
    onPlayGrowth: (id: string) => void;
    onQuickSnap: (id: string, file: File) => Promise<void>;
    onView: (tree: Lifetree) => void;
    onReach?: (tree: Lifetree) => void;
}

export const LifetreeCard = ({ tree, myActiveTree, isAdmin, isSuperAdmin, currentUserId, onValidate, onPlayGrowth, onQuickSnap, onView, onReach }: LifetreeCardProps) => {
    const { t } = useLanguage();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    
    const isGuardian = currentUserId && tree.guardians && tree.guardians.includes(currentUserId);
    const hasValidationBadge = isExplicitlyValidatedTree(tree);
    const showValidateAction = canToggleValidation({ tree, myActiveTree, isAdmin, isSuperAdmin });

    const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setUploading(true);
            await onQuickSnap(tree.id, e.target.files[0]);
            setUploading(false);
            if(fileInputRef.current) fileInputRef.current.value = "";
        }
    }

    const triggerUpload = (e: React.MouseEvent) => {
        e.stopPropagation();
        fileInputRef.current?.click();
    }
    
    return (
        <div 
            onClick={() => onView(tree)}
            className={`bg-white rounded-xl overflow-hidden shadow-sm border border-slate-200 hover:shadow-lg transition-all duration-300 group relative cursor-pointer ${tree.isNature ? 'ring-1 ring-sky-100' : (hasValidationBadge ? 'ring-1 ring-emerald-100' : '')}`}
        >
             <div className="absolute top-2 right-2 z-20 flex flex-col items-end gap-1">
                {tree.isNature ? (
                    <span className="bg-sky-100 text-sky-800 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center shadow-sm">
                        <Icons.Shield />
                        <span className="ml-1 text-[9px]">NATURE</span>
                    </span>
                ) : null}
                {isGuardian && (
                    <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center shadow-sm w-fit">
                        <Icons.Shield />
                        <span className="ml-1 text-[9px]">Guardian</span>
                    </span>
                )}
            </div>

            {/* Quick Snap - For Owner OR Guardian */}
             {(myActiveTree && myActiveTree.id === tree.id) || isGuardian ? (
                 <div className="absolute top-2 left-2 z-20">
                     <button 
                        onClick={triggerUpload} 
                        disabled={uploading}
                        className="flex items-center gap-1.5 bg-white/95 text-slate-800 px-2.5 py-1 rounded-full shadow-md hover:bg-white hover:text-emerald-700 transition-all active:scale-95"
                    >
                        {uploading ? <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div> : <Icons.Camera />}
                        <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">{t('quick_snap')}</span>
                    </button>
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        capture="environment" 
                        onChange={handleFileChange} 
                        onClick={(e) => e.stopPropagation()}
                    />
                 </div>
            ) : null}

            <div className="relative h-36 bg-slate-200 overflow-hidden group">
                {tree.latestGrowthUrl || tree.imageUrl ? (
                    <img 
                        src={tree.latestGrowthUrl || tree.imageUrl} 
                        alt={tree.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-[3s] animate-[pulse_4s_ease-in-out_infinite]" 
                    />
                ) : (
                    <div className={`w-full h-full ${colors.sky} flex items-center justify-center`}>
                        <Logo width={50} height={50} className="opacity-20 text-white animate-pulse" />
                    </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent pointer-events-none"></div>
                {hasValidationBadge && (
                    <div className="absolute bottom-2 right-2 z-20">
                        <ValidationBadge compact />
                    </div>
                )}
                <div className="absolute bottom-2 left-3 right-3 text-white pointer-events-none">
                    <h3 dir="auto" className="text-lg font-light tracking-wide truncate">{tree.name}</h3>
                    {tree.shortTitle && <p dir="auto" className="text-xs font-bold text-emerald-200 uppercase tracking-widest truncate">{tree.shortTitle}</p>}
                    <div className="flex items-center text-xs text-slate-300 mt-0.5 gap-2 rtl:space-x-reverse">
                         {!tree.isNature && <span className="px-1.5 py-0 border border-slate-500 rounded-full text-[9px] bg-slate-800/50 backdrop-blur">
                            {t('block')}: {tree.blockHeight || 0}
                        </span>}
                        {tree.isNature && tree.status === 'DANGER' && (
                            <span className="bg-red-500 text-white px-2 py-0.5 rounded-full text-[9px] font-bold animate-pulse">DANGER</span>
                        )}
                    </div>
                </div>
            </div>
            <div className="p-3">
                <p dir="auto" className="text-slate-600 text-xs font-light italic leading-relaxed truncate">
                    "{tree.body}"
                </p>
                <div className="mt-3 pt-2 border-t border-slate-100 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <button onClick={(e) => { e.stopPropagation(); onPlayGrowth(tree.id); }} className="flex items-center gap-1 text-[10px] bg-primary/10 hover:bg-primary/20 text-primary px-2 py-1 rounded transition-colors uppercase tracking-wider font-semibold">
                        <Icons.Play />
                        <span>Growth</span>
                    </button>
                    {onReach && (
                        <button onClick={(e) => { e.stopPropagation(); onReach(tree); }} className="flex items-center gap-1 text-[10px] bg-amber-50 hover:bg-amber-100 text-amber-700 px-2 py-1 rounded transition-colors uppercase tracking-wider font-semibold">
                            <Icons.Lightning />
                            <span>Reach</span>
                        </button>
                    )}
                    
                    <div className="flex w-full flex-col items-start gap-2 sm:w-auto sm:flex-row">
                        {showValidateAction && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const nextValidated = !hasValidationBadge;
                                    const message = nextValidated ? 'Validate this tree?' : 'Remove validation from this tree?';
                                    if (window.confirm(message)) onValidate(tree.id, nextValidated);
                                }}
                                className="text-[10px] bg-primary text-white px-3 py-1.5 rounded-full shadow hover:opacity-90 transition-all uppercase font-bold tracking-wider"
                            >
                                {hasValidationBadge ? 'Remove Validation' : t('validate_action')}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
