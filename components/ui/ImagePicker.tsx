
import React, { useRef, ChangeEvent, ReactNode } from 'react';
import { Icons } from './Icons';

interface ImagePickerProps {
    onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
    onImageSelect?: (file: File) => void;
    previewUrl?: string;
    loading?: boolean;
    isDark?: boolean;
    children?: ReactNode;
    className?: string;
}

export const ImagePicker = ({ onChange, onImageSelect, previewUrl, loading = false, isDark = false, children, className }: ImagePickerProps) => {
    const fileInput = useRef<HTMLInputElement>(null);
    
    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (onChange) onChange(e);
        if (onImageSelect && e.target.files?.[0]) {
            onImageSelect(e.target.files[0]);
        }
    };

    if (children) {
        return (
            <div className={className} onClick={() => fileInput.current?.click()}>
                <input type="file" ref={fileInput} className="hidden" accept="image/*" onChange={handleFileChange} />
                {loading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div> : children}
            </div>
        );
    }

    const borderColor = isDark ? 'border-white/50' : 'border-slate-300';
    const bgColor = isDark ? 'bg-black/20 hover:bg-black/30' : 'hover:bg-slate-50';
    const textColor = isDark ? 'text-white' : 'text-slate-400';
    const hoverBorder = isDark ? 'hover:border-white' : 'hover:border-emerald-500';

    return (
        <div className={`space-y-2 ${className ? 'h-full w-full' : ''}`}>
             <div
                onClick={() => fileInput.current?.click()}
                className={`border-2 border-dashed rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors ${className || 'h-40'} relative overflow-hidden group ${previewUrl ? 'border-none p-0' : `${borderColor} ${bgColor} ${hoverBorder}`}`}
             >
                <input type="file" ref={fileInput} className="hidden" accept="image/*" onChange={handleFileChange} />
                
                {loading ? (
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
                ) : previewUrl ? (
                    <img src={previewUrl} className="w-full h-full object-cover rounded-xl" />
                ) : (
                    <div className={`text-center ${textColor} flex flex-col items-center gap-2`}>
                        <div className={`p-3 rounded-full ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
                            <Icons.Camera />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wide">Upload Photo</span>
                    </div>
                )}
             </div>
        </div>
    );
};
