import { useMemo, useState } from 'react';
import { marked } from 'marked';
import { SectionTitle } from '../ui/SectionTitle';

// The White Paper — the root/ documents, readable in the app. The same five files every
// intelligence roots in before acting (see CLAUDE.md / AGENTS.md): the promise, the seed,
// the organism, the rings, the growing tips. Bundled at build time (?raw imports), so the
// page always shows the root the running code actually grew from — trusted content, our
// own repository, rendered as-is.
import genesisMd from '../../../root/GENESIS.md?raw';
import linMd from '../../../root/LIN.md?raw';
import architectureMd from '../../../root/ARCHITECTURE.md?raw';
import decisionsMd from '../../../root/DECISIONS.md?raw';
import roadmapMd from '../../../root/ROADMAP.md?raw';

const PAPERS = [
    { id: 'genesis', label: 'Genesis', hint: 'why we exist', md: genesisMd },
    { id: 'lin', label: 'LIN', hint: 'what world we are creating', md: linMd },
    { id: 'architecture', label: 'Architecture', hint: 'how it currently lives', md: architectureMd },
    { id: 'decisions', label: 'Decisions', hint: 'how it became this way', md: decisionsMd },
    { id: 'roadmap', label: 'Roadmap', hint: 'where growth is invited next', md: roadmapMd },
] as const;

// Markdown prose styling via arbitrary variants — no typography plugin needed.
const PROSE =
    'font-serif leading-relaxed text-slate-700 ' +
    '[&_h1]:mb-4 [&_h1]:font-sans [&_h1]:text-2xl [&_h1]:font-light [&_h1]:tracking-wide [&_h1]:text-slate-900 ' +
    '[&_h2]:mb-2 [&_h2]:mt-8 [&_h2]:font-sans [&_h2]:text-xs [&_h2]:font-bold [&_h2]:uppercase [&_h2]:tracking-[0.18em] [&_h2]:text-emerald-700 ' +
    '[&_p]:mb-4 [&_p]:text-[15px] ' +
    '[&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1.5 [&_li]:text-[15px] ' +
    '[&_blockquote]:mb-4 [&_blockquote]:border-l-2 [&_blockquote]:border-amber-300 [&_blockquote]:bg-amber-50/50 [&_blockquote]:px-4 [&_blockquote]:py-2 [&_blockquote]:italic [&_blockquote]:text-slate-600 ' +
    '[&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12.5px] [&_code]:text-emerald-800 ' +
    '[&_pre]:mb-4 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-slate-900 [&_pre]:p-4 [&_pre_code]:bg-transparent [&_pre_code]:text-emerald-100 ' +
    '[&_table]:mb-4 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm ' +
    '[&_th]:border-b [&_th]:border-slate-200 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-sans [&_th]:text-xs [&_th]:font-bold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-slate-500 ' +
    '[&_td]:border-b [&_td]:border-slate-100 [&_td]:px-2 [&_td]:py-1.5 [&_td]:align-top ' +
    '[&_hr]:my-6 [&_hr]:border-slate-100 ' +
    '[&_a]:text-emerald-700 [&_a]:underline [&_a]:decoration-emerald-300 ' +
    '[&_strong]:font-bold [&_strong]:text-slate-900';

export const WhitePaperSection = () => {
    const [paper, setPaper] = useState<(typeof PAPERS)[number]['id']>('genesis');
    const active = PAPERS.find(p => p.id === paper) || PAPERS[0];
    const html = useMemo(() => marked.parse(active.md, { async: false }) as string, [active.md]);

    return (
        <div>
            <SectionTitle
                title="The White Paper"
                sub="The root the seed grows from — the same five documents every intelligence roots in before acting. Look into the root; no need for else."
            />
            <div className="mb-4 flex flex-wrap gap-2">
                {PAPERS.map(p => (
                    <button
                        key={p.id}
                        onClick={() => setPaper(p.id)}
                        className={`rounded-full border px-3.5 py-1.5 text-left transition-all ${paper === p.id ? 'border-emerald-300 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200' : 'border-slate-200 bg-white text-slate-500 hover:border-emerald-200'}`}
                    >
                        <span className="block text-xs font-bold">{p.label}</span>
                        <span className="block text-[9px] uppercase tracking-wide opacity-70">{p.hint}</span>
                    </button>
                ))}
            </div>
            <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:p-8">
                {/* Trusted content: our own repo's root/ markdown, bundled at build time. */}
                <div className={PROSE} dangerouslySetInnerHTML={{ __html: html }} />
            </div>
        </div>
    );
};
