import type { DomainKey } from './words';

// THE COIN (ring 2026-09-19). Light is what care kindles; a community may name the face of
// that light as its own coin — "Light" by default, "Blue Lotus Universal Exchange (BLUE)" at
// Per Auset — and the coin wears the community's logo and its place. WHAT A COMMUNITY MAY
// NAME is the face: a name and a code. WHAT IT MAY NOT CHANGE is the physics: the units,
// one ray per witnessed care (RAY_UNITS), the fading, the 15/3/3 split. Otherwise a rename
// becomes a second economy, and the regen-token ring names how those die. A coin always
// carries its place (the community's domain), so a ray that travels is named by where it
// was kindled: BLUE of seed.perauset.org.
//
// Plain contract — guaranteed: coinOf never throws and always answers (the shell's Light
// when a community names none); a name is trimmed and at most COIN_NAME_MAX; a code is
// 2–COIN_CODE_MAX letters or digits, kept as written (BLUE); coinProblem names the first
// refusal by key. Not guaranteed: uniqueness of names across communities (a coin is known by
// its place, not by its word), or that another community accepts it (that is an Interbeing
// attestation, `accepts_coin_of`, each side speaking for itself).

export interface CoinWords { name?: string | null; code?: string | null; color?: string | null }
export interface Coin {
  name: string;
  code: string;
  color: string;          // the hue the coin shines in (#rrggbb); the shell's Light is amber
  place: string | null;   // the community's domain, when the coin is a community's own
  logoUrl: string | null; // the community's logo, when the coin is a community's own
  own: boolean;           // named by a community (true) or the shell's Light (false)
}

export const COIN_NAME_MAX = 48;
export const COIN_CODE_MAX = 8;
export const LIGHT_COLOR = '#f59e0b'; // amber-500, the light's own hue
export const SHELL_COIN: CoinWords = { name: 'Light', code: 'light', color: LIGHT_COLOR };
const HEX_RE = /^#[0-9a-f]{6}$/i;
export const coinColorOf = (raw: unknown): string | null => (typeof raw === 'string' && HEX_RE.test(raw.trim()) ? raw.trim().toLowerCase() : null);
const CODE_RE = /^[A-Za-z0-9]{2,8}$/;

const clean = (v: unknown): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');

// The first thing wrong with a coin a keeper is writing, or null when it may stand.
export const coinProblem = (raw: CoinWords | null | undefined): DomainKey | null => {
  const name = clean(raw?.name);
  const code = clean(raw?.code);
  if (name.length > COIN_NAME_MAX) return 'coin_name_long';
  if (code && !CODE_RE.test(code)) return 'coin_code_bad';
  return null;
};

// The words as stored: both present, or none at all (a half-named coin is no coin).
export const normalizeCoin = (raw: CoinWords | null | undefined): { name: string; code: string; color?: string } | null => {
  if (coinProblem(raw)) return null;
  const name = clean(raw?.name);
  const code = clean(raw?.code);
  if (!name && !code) return null;
  const color = coinColorOf(raw?.color);
  return { name: name || code, code: code || name.replace(/[^A-Za-z0-9]/g, '').slice(0, COIN_CODE_MAX) || 'coin', ...(color ? { color } : {}) };
};

export const coinOf = (
  community: { domain?: string | null; logoUrl?: string | null; coin?: CoinWords | null } | null | undefined,
): Coin => {
  const own = normalizeCoin(community?.coin);
  if (!own) return { name: SHELL_COIN.name!, code: SHELL_COIN.code!, color: LIGHT_COLOR, place: null, logoUrl: null, own: false };
  return {
    name: own.name,
    code: own.code,
    color: own.color || LIGHT_COLOR,
    place: (community?.domain || '').trim().toLowerCase() || null,
    logoUrl: community?.logoUrl || null,
    own: true,
  };
};

// "BLUE of seed.perauset.org" — how a coin is named away from home; the shell's Light is just Light.
export const coinTitle = (coin: Coin): string => (coin.own && coin.place ? `${coin.code} · ${coin.place}` : coin.name);
