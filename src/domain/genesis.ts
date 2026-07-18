// THE MOMENT — the one timestamp the whole network grows from.
//
// Mahameru's cutting at the pond by Place Jourdain, Brussels: the branch touched, then cut
// from its parent willow. It was connected to enlightenment — the end of the search.
// Mahameru later died and dissolved into Nature; Phoenix was planted into the soil where
// its roots lay, and every tree planted since carries it.
//
// Golden values, read from the birth photo's EXIF (DSC_0013.JPG, Sony Xperia) — they must
// never drift: seeds, runtime genesis and update scripts all mirror these.

export const GENESIS_MOMENT_ISO = '2019-08-18T19:27:23+02:00';
export const GENESIS_MOMENT_MS = 1566149243000;

export const GENESIS_PLACE = {
  latitude: 50.838535,
  longitude: 4.3804,
  altitudeM: 85.9,
  name: 'The Source',
} as const;

export const GENESIS_MEANING = 'The end of the search.';
