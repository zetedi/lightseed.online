import { useEffect, useState } from 'react';
import { onRefresh, type RefreshTopic } from '../services/refreshBus';

// A view's ear on the refresh bus: returns a counter that bumps whenever one of the given
// topics is announced. Put it in a fetch effect's dependency list and the view re-fetches
// exactly when its data changed somewhere else — and never otherwise.
export const useRefreshSignal = (topics: RefreshTopic[]): number => {
  const [signal, setSignal] = useState(0);
  const key = topics.join(',');
  useEffect(() => {
    const wanted = new Set(key.split(','));
    return onRefresh(e => { if (wanted.has(e.topic)) setSignal(n => n + 1); });
  }, [key]);
  return signal;
};
