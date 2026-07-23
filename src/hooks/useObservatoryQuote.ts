import { useState, useEffect } from 'react';
import { generateOracleQuote } from '../services/gemini';

// The oracle quote for the Cocreate (Collabs) header — generated lazily once when the tab is
// first opened, plus a copy-to-clipboard handler with a 1.5s "copied" pulse. (Moved from the
// retired Observatory to the Cocreate tab.)
export function useObservatoryQuote(tab: string) {
  const [observatoryQuote, setObservatoryQuote] = useState('');
  const [quoteCopied, setQuoteCopied] = useState(false);

  useEffect(() => {
    if (tab === 'collab' && !observatoryQuote) generateOracleQuote().then(setObservatoryQuote).catch(() => {});
  }, [tab, observatoryQuote]);

  const copyQuote = () => {
    navigator.clipboard?.writeText(observatoryQuote)
      .then(() => { setQuoteCopied(true); setTimeout(() => setQuoteCopied(false), 1500); })
      .catch(() => {});
  };

  return { observatoryQuote, quoteCopied, copyQuote };
}
