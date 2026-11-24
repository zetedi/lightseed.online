import type { FeaturedVideo } from '../../domain/featuredVideo';
import { useLanguage } from '../../contexts/LanguageContext';

// THE FEATURED VIDEO beside the home carousel (ring 2026-11-20). The frame loads the address
// the law built (domain/featuredVideo) — a known house and an id, never the stored text. It
// fills the height the carousel sets on a wide screen and keeps 16:9 when the two stack; the
// player letterboxes itself inside. Nothing plays until the visitor asks. The frame is fetched
// from the provider as it nears the screen (loading="lazy"), and the provider needs the page's
// origin as referrer to agree to play — so the policy names the origin and nothing more.
export const FeaturedVideoFrame = ({ video }: { video: FeaturedVideo }) => {
  const { t } = useLanguage();
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-3xl border border-emerald-100 bg-black shadow-sm md:aspect-auto md:h-full md:min-h-[14rem] dark:border-emerald-900/40 dark:shadow-none">
      <iframe
        src={video.embedUrl}
        title={t('featured_video')}
        className="absolute inset-0 h-full w-full"
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen; web-share"
        allowFullScreen
      />
    </div>
  );
};
