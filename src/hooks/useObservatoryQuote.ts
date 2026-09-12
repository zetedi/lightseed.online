import { useState, useEffect } from 'react';

// The oracle quote for the Cocreate (Collabs) header — generated lazily once when the tab is
// first opened, plus a copy-to-clipboard handler with a 1.5s "copied" pulse. (Moved from the
// retired Observatory to the Cocreate tab.)
export function useObservatoryQuote(tab: string) {
  const [observatoryQuote, setObservatoryQuote] = useState('');
  const [quoteCopied, setQuoteCopied] = useState(false);

  useEffect(() => {
    // The oracle's service arrives with the first ask, not with the shell (App mounts this hook).
    if (tab === 'collab' && !observatoryQuote) {
      import('../services/gemini').then(({ generateOracleQuote }) => generateOracleQuote()).then(setObservatoryQuote).catch(() => {});
    }
  }, [tab, observatoryQuote]);

  const copyQuote = () => {
    navigator.clipboard?.writeText(observatoryQuote)
      .then(() => { setQuoteCopied(true); setTimeout(() => setQuoteCopied(false), 1500); })
      .catch(() => {});
  };

  return { observatoryQuote, quoteCopied, copyQuote };
}
