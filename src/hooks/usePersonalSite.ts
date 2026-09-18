import { useState, useEffect } from 'react';
import { listenToUserProfile } from '../services/firebase';
import { setActiveIntelligenceId, setActiveIntelligenceDuties } from '../services/intelligence';
import type { CommunityThemePreset } from '../utils/theme';
import { desiresOf } from '../domain/desires';
import type { Language } from '../domain/tongues';

// THE PERSONAL SITE (ring 2026-09-16, lifted out of App.tsx unchanged). A signed-in
// being's own palette, logo and inherit choice, and the intelligence they prefer —
// followed live from their profile, and let go on sign-out. The preferred intelligence
// is mirrored into the stateless AI helpers so every call routes through it.
export function usePersonalSite(uid: string | undefined) {
  const [personalSiteTheme, setPersonalSiteTheme] = useState<Partial<CommunityThemePreset> | null>(null);
  const [preferredIntelligenceId, setPreferredIntelligenceId] = useState<string | undefined>(undefined);
  const [personalSiteLogoUrl, setPersonalSiteLogoUrl] = useState('');
  const [personalSiteInherit, setPersonalSiteInherit] = useState(false);
  // The tongue the being desires (domain/desires) — followed from the profile like the palette.
  const [desiredTongue, setDesiredTongue] = useState<Language | undefined>(undefined);

  useEffect(() => {
    if (!uid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset-on-signout before (not instead of) subscribing to the profile listener
      setPersonalSiteTheme(null);
      setPersonalSiteLogoUrl('');
      setPersonalSiteInherit(false);
      setDesiredTongue(undefined);
      setActiveIntelligenceId(undefined);
      setActiveIntelligenceDuties(undefined);
      return;
    }

    return listenToUserProfile(uid, (profile) => {
      // The profile arrives untyped from the store; each field is read as what it is.
      const str = (v: unknown): string => (typeof v === 'string' ? v : '');
      setPersonalSiteTheme((profile?.siteTheme as Partial<CommunityThemePreset> | undefined) || null);
      setPersonalSiteLogoUrl(str(profile?.siteLogoUrl));
      setPersonalSiteInherit(!!profile?.siteInherit);
      setPreferredIntelligenceId(str(profile?.preferredIntelligenceId) || undefined);
      setDesiredTongue(desiresOf(profile?.desires).tongue);
      // Mirror the choice so stateless AI helpers route through it everywhere.
      setActiveIntelligenceId(str(profile?.preferredIntelligenceId) || undefined);
      setActiveIntelligenceDuties((profile?.intelligenceByDuty as Parameters<typeof setActiveIntelligenceDuties>[0]) || undefined);
    });
  // keyed on uid on purpose: the lightseed object changes identity without the uid changing,
  // and re-subscribing per object would churn the listener
  }, [uid]);

  return { personalSiteTheme, preferredIntelligenceId, personalSiteLogoUrl, personalSiteInherit, desiredTongue };
}
