import { useEffect, useState } from 'react';
import { listenToUserProfile, updateUserProfile } from '../services/firebase';

// First-run onboarding state, persisted on the user profile so it follows them across devices.
// Steps that can be DERIVED from real data (planted a tree, set a rhythm…) are computed in the
// checklist; steps that can't are recorded here as completedSteps.
export type OnboardingPath = 'care' | 'vision';

export interface OnboardingState {
  path?: OnboardingPath;
  completedSteps: number[];
  dismissed: boolean;
  loaded: boolean;
}

export const useOnboardingState = (uid?: string) => {
  const [s, setS] = useState<OnboardingState>({ completedSteps: [], dismissed: false, loaded: false });

  useEffect(() => {
    if (!uid) { setS({ completedSteps: [], dismissed: false, loaded: false }); return; }
    return listenToUserProfile(uid, (d: any) => setS({
      path: d?.onboardingPath,
      completedSteps: Array.isArray(d?.onboardingCompletedSteps) ? d.onboardingCompletedSteps : [],
      dismissed: !!d?.onboardingDismissed,
      loaded: true,
    }));
  }, [uid]);

  const choosePath = (path: OnboardingPath) => { if (uid) updateUserProfile(uid, { onboardingPath: path }).catch(() => {}); };
  const markStep = (n: number) => {
    if (uid && !s.completedSteps.includes(n)) updateUserProfile(uid, { onboardingCompletedSteps: Array.from(new Set([...s.completedSteps, n])) }).catch(() => {});
  };
  const dismiss = () => { if (uid) updateUserProfile(uid, { onboardingDismissed: true }).catch(() => {}); };
  const reopen = () => { if (uid) updateUserProfile(uid, { onboardingDismissed: false }).catch(() => {}); };

  return { ...s, choosePath, markStep, dismiss, reopen };
};
