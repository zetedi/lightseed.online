import React from 'react';

interface ArticleImageProps {
  src: string;
  alt: string;
  caption?: string;
  className?: string; // Allow passing extra classes
}

const ArticleImage: React.FC<ArticleImageProps> = ({ src, alt, caption, className }) => {
  return (
    <figure 
      className={`
        m-4 float-right // Core classes: margin and float right
        clear-right   // Ensures content below doesn't wrap oddly
        w-1/2 md:w-1/3  // Responsive width: 50% on mobile, 33% on desktop
        ${className}    // Allow for additional custom classes
      `}
    >
      <img src={src} alt={alt} className="rounded-lg shadow-md" />
      {caption && (
        <figcaption className="mt-2 text-sm text-center text-gray-500 dark:text-gray-400">
          {caption}
        </figcaption>
      )}
    </figure>
  );
};

export default ArticleImage;