import React, { Suspense, lazy } from 'react';
import type { RichTextEditorProps } from './RichTextEditorQuill';
import { useLanguage } from '../../contexts/LanguageContext';

// THE EDITOR ARRIVES WHEN SOMEONE EDITS (ring 2026-09-13). Quill and its stylesheet weigh
// 142 kB, and they used to ride with every community and vision page — for readers, who never
// open an editor. This seam is the only door to the Quill module: the same props, a quiet box
// of the editor's height while the chunk lands (instant on a warm cache, precached by the
// worker), then the editor itself. Callers import THIS file; tests/lazyEditor holds the door.
const Quill = lazy(() => import('./RichTextEditorQuill'));

const RichTextEditor: React.FC<RichTextEditorProps> = (props) => {
  const { t } = useLanguage();
  return (
    <Suspense fallback={
      <div className="min-h-[14rem] rounded-lg border border-slate-200 bg-white p-4 text-sm italic text-slate-400 dark:bg-slate-900 dark:border-slate-700">
        {t('loading')}
      </div>
    }>
      <Quill {...props} />
    </Suspense>
  );
};

export default RichTextEditor;
