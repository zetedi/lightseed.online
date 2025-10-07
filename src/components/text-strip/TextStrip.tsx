import React from 'react';

interface TextStripProps {
  title: string;
  children: React.ReactNode;
}

const TextStrip: React.FC<TextStripProps> = ({ title, children }) => {
  return (
    <div className="text-strip clearfix max-w-4xl mx-auto p-6 bg-text-background/90 rounded-lg">
      <h2 className="text-2xl font-bold mb-4 text-center">{title}</h2>
      <div className="max-w-prose text-justify">
        {children}
      </div>
    </div>
  );
};

export default TextStrip;