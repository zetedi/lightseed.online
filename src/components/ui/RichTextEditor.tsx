import React, { useMemo, useRef } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { showAlert } from './Dialog';

interface RichTextEditorProps {
  value: string;
  onChange: (content: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  // When provided, the toolbar gains an image button. The file is uploaded through this
  // callback (→ Storage) and embedded by URL — never base64, which would balloon the
  // document past Firestore's 1MB doc limit after a photo or two.
  onImageUpload?: (file: File) => Promise<string>;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, placeholder, readOnly = false, onImageUpload }) => {
  const quillRef = useRef<ReactQuill>(null);

  // Quill re-initialises when `modules` changes identity — memoize, or every parent render
  // rebuilds the editor (and eats the focus).
  const modules = useMemo(() => ({
    toolbar: {
      container: [
        [{ 'header': [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike', 'blockquote'],
        [{ 'list': 'ordered' }, { 'list': 'bullet' }],
        onImageUpload ? ['link', 'image', 'clean'] : ['link', 'clean'],
      ],
      handlers: onImageUpload ? {
        image: () => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return;
            try {
              const url = await onImageUpload(file);
              const quill = quillRef.current?.getEditor();
              if (!quill) return;
              const range = quill.getSelection(true);
              quill.insertEmbed(range?.index ?? quill.getLength(), 'image', url, 'user');
              quill.setSelection((range?.index ?? 0) + 1, 0);
            } catch (e: any) {
              console.error('Image upload failed', e);
              showAlert(e?.message || 'The image could not be uploaded.');
            }
          };
          input.click();
        },
      } : {},
    },
  }), [onImageUpload]);

  // Quill 2 (react-quill-new) registers only 'list' — 'bullet' is a toolbar value, not a
  // separate format, so listing it here throws "Cannot register 'bullet'".
  const formats = useMemo(() => [
    'header',
    'bold', 'italic', 'underline', 'strike', 'blockquote',
    'list',
    'link',
    ...(onImageUpload ? ['image'] : []),
  ], [onImageUpload]);

  return (
    <div className="bg-white rounded-lg overflow-hidden border border-slate-200">
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        readOnly={readOnly}
        className={readOnly ? 'ql-read-only' : ''}
      />
    </div>
  );
};

export default RichTextEditor;
