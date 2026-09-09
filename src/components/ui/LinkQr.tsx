import { useState } from 'react';
import QRCode from 'qrcode';
import { Modal } from './Modal';
import { Icons } from './Icons';
import { useLanguage } from '../../contexts/LanguageContext';

// A QR for any link the shell hands out — an invitation, a community's door. BeingQr is the
// being's own bridge (it MINTS the link onto the being); this one only shows a code for a URL.
export const LinkQr = ({ url, title, className = '' }: { url: string; title: string; className?: string }) => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const show = async () => {
    setOpen(true);
    setDataUrl(await QRCode.toDataURL(url, { width: 512, margin: 2, color: { dark: '#0f172a', light: '#ffffff' } }));
  };
  return (
    <>
      <button type="button" onClick={show} title={t('qr_show')} aria-label={t('qr_show')} className={`inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-500 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 ${className}`}>
        <Icons.QrCode size={14} />
      </button>
      {open && (
        <Modal title={title} onClose={() => setOpen(false)}>
          <div className="flex flex-col items-center gap-4 text-center">
            {dataUrl
              ? <img src={dataUrl} alt={title} className="h-56 w-56 rounded-xl border border-slate-200 shadow-sm" />
              : <div className="flex h-56 w-56 items-center justify-center text-slate-300">…</div>}
            <p className="break-all font-mono text-[11px] text-slate-400">{url}</p>
          </div>
        </Modal>
      )}
    </>
  );
};
