import React, { createContext, useContext } from 'react';
import { useLifeseed } from '../hooks/useLifeseed';

// The signed-in session (the "lightseed"): the user, their trees, guardianships, admin flags and
// the tree-refresh handle. Previously this lived as ~11 values threaded by hand through AppContent
// and prop-drilled into every screen. Hoisting it into a context lets any component read the
// session directly via useSession(), which is the seam that lets the mega-components decompose.
type SessionValue = ReturnType<typeof useLifeseed>;

const SessionContext = createContext<SessionValue | null>(null);

export const SessionProvider = ({ children }: { children: React.ReactNode }) => {
  const session = useLifeseed();
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
};

export const useSession = (): SessionValue => {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within a SessionProvider');
  return ctx;
};
