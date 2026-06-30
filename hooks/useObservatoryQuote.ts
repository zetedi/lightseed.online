import { useState, useEffect } from 'react';
import { generateOracleQuote } from '../services/gemini';

// The Observatory header's oracle quote — generated lazily once when the tab is first opened,
// plus a copy-to-clipboard handler with a 1.5s "copied" pulse. Extracted verbatim from App.
export function useObservatoryQuote(tab: string) {
  const [observatoryQuote, setObservatoryQuote] = useState('');
  const [quoteCopied, setQuoteCopied] = useState(false);

  useEffect(() => {
    if (tab === 'observatory' && !observatoryQuote) generateOracleQuote().then(setObservatoryQuote).catch(() => {});
  }, [tab, observatoryQuote]);

  const copyQuote = () => {
    navigator.clipboard?.writeText(observatoryQuote)
      .then(() => { setQuoteCopied(true); setTimeout(() => setQuoteCopied(false), 1500); })
      .catch(() => {});
  };

  return { observatoryQuote, quoteCopied, copyQuote };
}
