// THE GROUND ON THIS SOIL (ring 2026-11-17): not grown yet (seed/PARITY.md). The three acts
// refuse by name; the four readings answer "none", so every face shows a vision as it truly is
// on this node — standing in no ground — instead of failing.
import type * as F from '../firebase/grounding';
import { unported } from './unported';

export type { GroundOf } from '../firebase/grounding';

export const askGround: typeof F.askGround = unported('askGround');
export const acceptGround: typeof F.acceptGround = unported('acceptGround');
export const releaseGround: typeof F.releaseGround = unported('releaseGround');
export const dropGroundAsk: typeof F.dropGroundAsk = unported('dropGroundAsk');

export const getGroundsOfVision: typeof F.getGroundsOfVision = async () => [];
export const getGroundAsksOfVision: typeof F.getGroundAsksOfVision = async () => [];
export const getVisionsGroundedIn: typeof F.getVisionsGroundedIn = async () => [];
export const getGroundAsksAt: typeof F.getGroundAsksAt = async () => [];
