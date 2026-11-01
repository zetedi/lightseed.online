// THE TWO SOILS, HELD IN STEP (ring 2026-11-01). The app imports its service layer as @backend;
// the build points that name at ./firebase or at ./independent. This file is the compile-time
// law that the independent backend offers every name the Firebase backend offers, with a type
// the Firebase signature accepts — so a build for the independent node can never fail at runtime
// on a name the app knows. A hand the independent node has not grown stands as unported() and
// refuses honestly when asked; it may never be absent. `tsc` runs this in `npm run check`.
//
// The Firebase core also exports its own SDK handles and collection references; those are the
// Firebase backend's private tools (used only inside src/services/firebase) and are not part of
// the surface the app may import, so the core comparison leaves them out by name.
type FirebaseOnly =
  | 'auth' | 'db' | 'storage' | 'functions' | 'googleProvider' | 'mapDoc' | 'mapPulse'
  | 'mailCollection' | 'subsCollection' | 'usersCollection' | 'lifetreesCollection' | 'visionsCollection'
  | 'pulsesCollection' | 'alignmentsCollection' | 'covenantsCollection' | 'communitiesCollection'
  | 'lightHousesCollection' | 'networkInvitesCollection' | 'communityInvitesCollection' | 'newsletterConfigRef';

type Surface<T> = Omit<T, FirebaseOnly>;
const same = <T>(_independent: Surface<T>): void => { /* the assignment above is the check */ };

same<typeof import('./firebase/core')>({} as typeof import('./independent/core'));
same<typeof import('./firebase/store')>({} as typeof import('./independent/store'));
same<typeof import('./firebase/authority')>({} as typeof import('./independent/authority'));
same<typeof import('./firebase/accounts')>({} as typeof import('./independent/accounts'));
same<typeof import('./firebase/media')>({} as typeof import('./independent/media'));
same<typeof import('./firebase/trees')>({} as typeof import('./independent/trees'));
same<typeof import('./firebase/exportBeing')>({} as typeof import('./independent/exportBeing'));
same<typeof import('./firebase/spaces')>({} as typeof import('./independent/spaces'));
same<typeof import('./firebase/governance')>({} as typeof import('./independent/governance'));
same<typeof import('./firebase/pulses')>({} as typeof import('./independent/pulses'));
same<typeof import('./firebase/watering')>({} as typeof import('./independent/watering'));
same<typeof import('./firebase/engagement')>({} as typeof import('./independent/engagement'));
same<typeof import('./firebase/covenants')>({} as typeof import('./independent/covenants'));
same<typeof import('./firebase/stays')>({} as typeof import('./independent/stays'));
same<typeof import('./firebase/holds')>({} as typeof import('./independent/holds'));
same<typeof import('./firebase/beings')>({} as typeof import('./independent/beings'));
same<typeof import('./firebase/subgraph')>({} as typeof import('./independent/subgraph'));
same<typeof import('./firebase/light')>({} as typeof import('./independent/light'));
same<typeof import('./firebase/staffHands')>({} as typeof import('./independent/staffHands'));
same<typeof import('./firebase/intelligence')>({} as typeof import('./independent/intelligence'));
same<typeof import('./firebase/keys')>({} as typeof import('./independent/keys'));
same<typeof import('./firebase/push')>({} as typeof import('./independent/push'));
same<typeof import('./firebase/gemini')>({} as typeof import('./independent/gemini'));
// The barrels: the whole surface, one name.
same<typeof import('./firebase')>({} as typeof import('./independent'));
