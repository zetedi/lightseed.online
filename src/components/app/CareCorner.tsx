import React from 'react';
import type { Lifetree } from '../../types';
import { CareModal } from '../CareModal';
import { useLanguage } from '../../contexts/LanguageContext';

// THE CARE CORNER (Zoltán, 2026-07-22; lifted out of App.tsx unchanged, ring 2026-09-16) —
// care, one thumb-tap from anywhere. Bottom LEFT (the community switcher owns bottom
// right), mirroring its size. Context-sensitive: an open tree is the target; otherwise the
// default tree. One tap lands on the target's Care section; the drop pulses sky when the
// target is thirsty. The daily gesture of the whole economy, given one home. The droplet's
// modal — a small care sheet for the target tree — opens from the bead.
export const CareCorner: React.FC<{
  careTarget: Lifetree | null;
  thirsty: boolean;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onOpenCare: () => void;
  onOpenVision?: () => Promise<void>;
  onOffer: () => void;
  sender: { uid: string; displayName: string | null; photoURL: string | null };
  hasVision: boolean;
}> = ({ careTarget, thirsty, open, onOpen, onClose, onOpenCare, onOpenVision, onOffer, sender, hasVision }) => {
  const { t } = useLanguage();
  if (!careTarget) return null;
  return (
    <>
      {/* A full-width strip that MIRRORS the nav's container (same max-w-7xl mx-auto
          and px steps), so the bead sits at the same x as the logo on EVERY screen,
          narrow or ultra-wide. pointer-events pass through except on the bead. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* translateX(calc(20px - 50%)) centres the bead (any size) under the
              40px logo's centre, 20px from this container's left edge — so the two
              stay aligned even as the bead grows. */}
          <div className="relative inline-block" style={{ transform: 'translateX(calc(20px - 50%))' }}>
            <button
              onClick={onOpen}
              title={t('care_for_tree').replace('{name}', careTarget.name)}
              aria-label={t('care_for_tree').replace('{name}', careTarget.name)}
              className={`pointer-events-auto relative block transition-transform hover:scale-110 active:scale-95 ${
                thirsty ? 'animate-pulse' : ''
              }`}
            >
              {/* A THIN white cloud: a bead-sized white disc BLURRED, so its edge is a
                  gaussian falloff, pure white right at the rim, fading soft to nothing
                  over ~half the bead's radius. Bead-sized (not larger) so the solid
                  core hides behind the bead and only the wisp shows; the blur, not a
                  gradient stop, does the fading, so there is no band and no hard circle. */}
              <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[58px] w-[58px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white blur-[6px] dark:bg-slate-900" />
              {/* The droplet itself, drawn by Lumo — the bead IS the button, 58px. */}
              <img src="/droplet.svg" alt="" draggable={false} className="relative h-[58px] w-[58px] object-contain" />
            </button>
          </div>
        </div>
      </div>

      {open && (
        <CareModal
          tree={careTarget}
          sender={sender}
          hasVision={hasVision}
          onOpenCare={onOpenCare}
          onOpenVision={onOpenVision}
          onOffer={onOffer}
          onClose={onClose}
        />
      )}
    </>
  );
};
