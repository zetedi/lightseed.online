import React from 'react';

interface TextStripProps {
  title: string;
  children: React.ReactNode;
}

const TextStrip: React.FC<TextStripProps> = ({ title, children }) => {
  return (
    <div className="text-strip">
      <h2 className="text-2xl font-bold mb-4">{title}</h2>
      <p className="max-w-prose text-justify">
        {children}
      </p>
    </div>
  );
};

export default TextStrip;