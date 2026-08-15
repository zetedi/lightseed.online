import React from 'react';
import type { Community } from '../../types';
import { useLanguage } from '../../contexts/LanguageContext';

// THE WATERLINE (ring 2026-08-16) — every Light House is built around its water. The works
// are STAGES in the data (trenches, channels, cisterns — whatever the place digs), each
// with how far the water has come; this component draws the flow: a channel per stage,
// water filling it left-to-right (right-to-left in RTL follows the flex direction), the
// living blue of the care economy's droplet. Keepers tend the numbers as the earth moves;
// no deploy ever needed.
interface WaterLineProps {
  community: Community;
  props: Record<string, unknown>;
}

interface Stage { label: string; progress: number }

export const WaterLine: React.FC<WaterLineProps> = ({ props }) => {
  const { t } = useLanguage();
  const headline = (props.headline as string) || t('waterline_title');
  const note = props.note as string | undefined;
  const stages = (props.stages as Stage[]) || [];

  return (
    <section className="mx-auto w-full max-w-3xl px-6 pb-10 text-center">
      <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.2em] text-sky-500">{headline}</p>
      {note && <p dir="auto" className="mb-5 text-sm italic text-slate-500">{note}</p>}
      <div className="space-y-4">
        {stages.map((stage, i) => (
          <div key={`${stage.label}:${i}`}>
            <div className="mb-1 flex items-baseline justify-between gap-2">
              <span dir="auto" className="text-sm font-semibold text-slate-700">{stage.label}</span>
              <span className="font-mono text-xs text-sky-600">{stage.progress}%</span>
            </div>
            {/* The channel — earth-walled, water filling it as the work advances. */}
            <div className="h-3 w-full overflow-hidden rounded-full border border-amber-200/70 bg-amber-50">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${stage.progress}%`,
                  background: 'linear-gradient(90deg, #7dd3fc 0%, #0ea5e9 60%, #0369a1 100%)',
                  boxShadow: stage.progress > 0 ? '0 0 8px rgba(14,165,233,0.5)' : undefined,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xl" aria-hidden>💧</p>
    </section>
  );
};
