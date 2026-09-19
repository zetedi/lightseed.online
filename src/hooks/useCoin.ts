import { useSyncExternalStore } from 'react';
import { coinOf, type Coin } from '../domain/coin';

// THE ACTIVE COIN (ring 2026-09-19): the face the light wears where the viewer stands — the
// host community's coin, or the viewed community's while one is open. Set by the conductor
// from the active community; read by every seat that speaks a unit. The same shape as the
// active language: one store, no prop-drilling, every reader re-renders when it changes.
let active: Coin = coinOf(null);
const listeners = new Set<() => void>();
export const setActiveCoin = (coin: Coin): void => {
  if (coin.name === active.name && coin.code === active.code && coin.place === active.place && coin.logoUrl === active.logoUrl) return;
  active = coin;
  listeners.forEach((l) => l());
};
export const getActiveCoin = (): Coin => active;
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
export const useCoin = (): Coin => useSyncExternalStore(subscribe, getActiveCoin, getActiveCoin);
