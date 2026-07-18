import { type MouseEvent } from 'react';
import { CTA_GLOW } from '../../utils/tabTheme';
import { useLanguage } from '../../contexts/LanguageContext';

// The one Plant CTA — a glowing two-line pill ("PLANT OR STAND FOR A TREE" / "Create a New World"),
// shared by the dashboard's signed-in Home card and signed-out Plant card so the call to grow a
// tree is always the same lit, unmistakable button. `color` is the node's primary. `onClick` is
// optional — some hosts make the whole card clickable and let the press ride the bubble up.
export const PlantCTA = ({ color, onClick, className = '' }: {
    color: string;
    onClick?: (e: MouseEvent) => void;
    className?: string;
}) => {
    const { t } = useLanguage();
    return (
        <button type="button" onClick={onClick} title={t('plant_or_stand')} style={{ backgroundColor: color }}
                className={`inline-flex flex-col items-center justify-center rounded-full px-5 py-2 text-white transition-all hover:opacity-95 active:scale-95 ${CTA_GLOW} ${className}`}>
            <span className="text-center text-[11px] font-bold uppercase leading-tight tracking-wide sm:text-sm sm:tracking-widest">{t('plant_or_stand')}</span>
            <span className="text-center text-[9px] font-medium leading-tight tracking-normal text-white/85 sm:text-[10px]">{t('create_new_world')}</span>
        </button>
    );
};
