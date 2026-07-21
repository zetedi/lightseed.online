
import { useRef, useState, ChangeEvent, ReactNode } from 'react';
import { Icons } from './Icons';
import { ImageCropModal } from './ImageCropModal';
import { Loading } from './Loading';

interface ImagePickerProps {
    onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
    onImageSelect?: (file: File) => void;
    previewUrl?: string;
    loading?: boolean;
    isDark?: boolean;
    children?: ReactNode;
    className?: string;
    // Crop window aspect (width/height). 1 = square (default), 16/9 = wide banner, etc.
    aspect?: number;
    cropTitle?: string;
    // Opt out of cropping for a given picker (rare — most uploads should crop).
    noCrop?: boolean;
}

export const ImagePicker = ({ onChange, onImageSelect, previewUrl, loading = false, isDark = false, children, className, aspect = 1, cropTitle, noCrop = false }: ImagePickerProps) => {
    const fileInput = useRef<HTMLInputElement>(null);
    // The just-picked file awaiting a crop. While set, the crop modal is shown and we only
    // emit onImageSelect once the user confirms the crop — so cropping happens everywhere
    // an ImagePicker is used, with no change at the call sites.
    const [pendingFile, setPendingFile] = useState<File | null>(null);

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (onChange) onChange(e);
        const file = e.target.files?.[0];
        if (file && onImageSelect) {
            if (noCrop) onImageSelect(file);
            else setPendingFile(file);
        }
        // Reset so picking the same file again still fires onChange.
        e.target.value = '';
    };

    const cropper = pendingFile && !noCrop ? (
        <ImageCropModal
            file={pendingFile}
            aspect={aspect}
            title={cropTitle}
            onCancel={() => setPendingFile(null)}
            onConfirm={(f) => { onImageSelect?.(f); setPendingFile(null); }}
        />
    ) : null;

    if (children) {
        return (
            <div className={className} onClick={() => fileInput.current?.click()}>
                <input type="file" ref={fileInput} className="hidden" accept="image/*" onChange={handleFileChange} />
                {loading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></div> : children}
                {cropper}
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
                    /* The one sun, here too — the global card carries the percent. */
                    <Loading size={56} timeoutMs={30000} />
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
             {cropper}
        </div>
    );
};
