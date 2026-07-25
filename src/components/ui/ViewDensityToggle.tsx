import type { ListDensity } from '../../hooks/useListDensity';

// The three-way list density switch — rows / cards / mini. Designed for the coloured header band:
// translucent white pill, the active choice lifts to solid white.
const Glyph = ({ kind }: { kind: ListDensity }) => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    {kind === 'rows' && (<>
      <rect x="1" y="2" width="4" height="4" rx="1" /><rect x="7" y="3" width="8" height="2" rx="1" />
      <rect x="1" y="10" width="4" height="4" rx="1" /><rect x="7" y="11" width="8" height="2" rx="1" />
    </>)}
    {kind === 'cards' && (<>
      <rect x="1" y="1" width="6" height="6" rx="1.2" /><rect x="9" y="1" width="6" height="6" rx="1.2" />
      <rect x="1" y="9" width="6" height="6" rx="1.2" /><rect x="9" y="9" width="6" height="6" rx="1.2" />
    </>)}
    {kind === 'mini' && (<>
      <rect x="1" y="1" width="4" height="4" rx="1" /><rect x="6" y="1" width="4" height="4" rx="1" /><rect x="11" y="1" width="4" height="4" rx="1" />
      <rect x="1" y="6" width="4" height="4" rx="1" /><rect x="6" y="6" width="4" height="4" rx="1" /><rect x="11" y="6" width="4" height="4" rx="1" />
      <rect x="1" y="11" width="4" height="4" rx="1" /><rect x="6" y="11" width="4" height="4" rx="1" /><rect x="11" y="11" width="4" height="4" rx="1" />
    </>)}
  </svg>
);

const LABEL: Record<ListDensity, string> = { rows: 'List', cards: 'Cards', mini: 'Small cards' };

// `dark` flips the idle glyphs to dark ink for the one BRIGHT band (the solar gold), where
// translucent white icons would wash out. The active chip is solid white in both voices.
export const ViewDensityToggle = ({ value, onChange, dark = false }: { value: ListDensity; onChange: (d: ListDensity) => void; dark?: boolean }) => (
  <div className={`flex shrink-0 items-center rounded-full p-0.5 backdrop-blur-sm ${dark ? 'bg-black/10' : 'bg-white/15'}`}>
    {(['rows', 'cards', 'mini'] as ListDensity[]).map(d => (
      <button
        key={d}
        onClick={() => onChange(d)}
        title={LABEL[d]}
        aria-label={LABEL[d]}
        aria-pressed={value === d}
        className={`rounded-full p-2 transition-all ${value === d
          ? 'bg-white text-slate-800 shadow-sm'
          : dark ? 'text-amber-950/70 hover:text-amber-950' : 'text-white/75 hover:text-white'}`}
      >
        <Glyph kind={d} />
      </button>
    ))}
  </div>
);
