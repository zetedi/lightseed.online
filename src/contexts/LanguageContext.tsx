
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { type Language, type TranslationKey, translations, dictionaryOf, isLanguage, isLanguageLoaded, loadLanguage, setActiveLanguage } from '../utils/translations';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Fix: Marking children as optional to avoid TypeScript errors in some environments 
// where children nested in JSX are not immediately recognized as the 'children' prop.
export const LanguageProvider = ({ children }: { children?: ReactNode }) => {
  // Lazy initializer: the stored language is readable synchronously, no effect needed.
  const [language, setLanguageState] = useState<Language>(() => {
      const stored = localStorage.getItem('lifeseed_lang');
      const lang = isLanguage(stored) ? stored : 'en';
      setActiveLanguage(lang); // the speaking layer (imperative dialogs, spoken errors) follows
      return lang;
  });

  // A tongue's words are their own chunk (ring 2026-09-13). Until they land, t() reads English
  // key by key through dictionaryOf; `arrived` only asks React to look again once they have.
  const [, setArrived] = useState(0);
  useEffect(() => {
      if (isLanguageLoaded(language)) return;
      let live = true;
      loadLanguage(language).then(() => { if (live) setArrived(n => n + 1); }).catch(() => {});
      return () => { live = false; };
  }, [language]);

  const setLanguage = (lang: Language) => {
      setLanguageState(lang);
      setActiveLanguage(lang);
      localStorage.setItem('lifeseed_lang', lang);
  }

  const t = (key: TranslationKey) => {
    return dictionaryOf(language)[key] || translations.en[key];
  };

  // Mattokki reads right-to-left while its strings are still the Arabic ones underneath; when the
  // Latin Mattokki words arrive (docs/mattokki-review.md), this becomes 'ar' alone again.
  const isRTL = language === 'ar' || language === 'xnz';

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRTL }}>
      <div dir={isRTL ? 'rtl' : 'ltr'} className={isRTL ? 'font-arabic' : ''}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within a LanguageProvider");
  return context;
};
