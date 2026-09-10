import { Modal } from './ui/Modal';
import { useLanguage } from '../contexts/LanguageContext';
import { getTerms } from '../utils/terms';

export const TermsModal = ({ onClose }: { onClose: () => void }) => {
  const { language } = useLanguage();
  const terms = getTerms(language);
  return (
    <Modal title={terms.title} onClose={onClose}>
      <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
        <p className="whitespace-pre-line">{terms.intro}</p>
        {terms.sections.map((s, i) => (
          <div key={i}>
            <h3 className="font-bold text-slate-900 dark:text-slate-50">{s.heading}</h3>
            <p className="mt-1 whitespace-pre-line">{s.body}</p>
          </div>
        ))}
        <p className="whitespace-pre-line font-bold text-emerald-700">{terms.agree}</p>
      </div>
    </Modal>
  );
};
