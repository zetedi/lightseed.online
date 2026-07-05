import { useState } from 'react';

// The forest map's three filter toggles. Pure UI state, no effects/deps — extracted verbatim from
// App. (Consumers must keep these in the filteredData dependency array so the filter stays live.)
export function useForestFilters() {
  const [showNatureTrees, setShowNatureTrees] = useState(true);
  const [showUserTrees, setShowUserTrees] = useState(true);
  const [showValidatedTrees, setShowValidatedTrees] = useState(false);

  return {
    showNatureTrees, setShowNatureTrees,
    showUserTrees, setShowUserTrees,
    showValidatedTrees, setShowValidatedTrees,
  };
}
