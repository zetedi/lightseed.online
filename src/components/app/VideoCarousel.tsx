import { useState } from 'react';
import type { FeaturedVideo } from '../../domain/featuredVideo';
import { useLanguage } from '../../contexts/LanguageContext';
import { CarouselFrame } from './CarouselFrame';

// THE FEATURED VIDEOS beside the home quotes (rings 2026-11-20, -24): the same card, arrows and
// dots as the reflections (CarouselFrame), holding films. Each frame loads the address the law
// built (domain/featuredVideo) — a known house and an id, never the stored text.
//
// ONE player stands at a time: only the shown video has a frame, so a list of twelve asks its
// providers for one player, and stepping on ends the film left behind. The carousel never moves
// by itself — the page cannot know a film is playing, and would cut it. Nothing plays until the
// visitor asks. The frame is fetched from the provider as it nears the screen (loading="lazy"),
// and the provider needs the page's origin as referrer to agree to play — so the policy names
// the origin and nothing more. The film keeps 16:9 at every width.
export const VideoCarousel = ({ videos, className = '' }: { videos: FeaturedVideo[]; className?: string }) => {
  const { t } = useLanguage();
  const [i, setI] = useState(0);
  if (!videos.length) return null;
  // The list can shorten under a visitor's eyes while its keeper edits it.
  const at = Math.min(i, videos.length - 1);
  const video = videos[at];
  const nth = (n: number) => t('video_n').replace('{n}', String(n));

  return (
    <CarouselFrame
      count={videos.length}
      index={at}
      onGo={n => setI(((n % videos.length) + videos.length) % videos.length)}
      label={t('featured_videos')}
      prevLabel={t('video_prev')}
      nextLabel={t('video_next')}
      dotLabel={nth}
      className={`p-3 sm:p-4 ${className}`}
    >
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
        <iframe
          key={video.embedUrl}
          src={video.embedUrl}
          title={nth(at + 1)}
          className="absolute inset-0 h-full w-full"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share"
          allowFullScreen
        />
      </div>
    </CarouselFrame>
  );
};
