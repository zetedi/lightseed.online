import React from 'react';
import { Link, LinkProps } from 'react-router-dom'; // Import LinkProps for type safety

// Define the props that our new component will accept
interface ImageLinkProps extends LinkProps { // Extends all standard Link props like 'to'
  imageUrl: string;
  children: React.ReactNode;
}

const ImageLink: React.FC<ImageLinkProps> = ({ to, imageUrl, children, ...props }) => {
  // We pass 'to' and 'children' explicitly and spread the rest of the props
  // so you can still pass other standard Link props if needed.
  
  return (
    <Link
      to={to}
      className="
        relative 
    group
    flex items-start justify-start // Alignment for text inside
    p-2 sm:p-3
    text-white font-bold text-lg 
    w-[150px] h-[100px]   
    md:w-auto md:h-32 
    rounded-lg border-2 border-white-700 
    shadow-lg shadow-green-900/50 dark:shadow-white/30
    overflow-hidden
    transition-all duration-300
      "
      style={{
        backgroundImage: `url(${imageUrl})`, // Use the imageUrl prop here
        backgroundSize: 'cover',
        backgroundPosition: 'center top',
      }}
      {...props} // Spread any other props onto the Link component
    >
      {/* Overlay Div for the text and a semi-transparent dark layer */}
      <div 
        className="
          absolute inset-0
          bg-black bg-opacity-40
          flex items-start justify-start
          p-2 sm:p-3
          transition-all duration-300
          group-hover:bg-opacity-20
        "
      >
        <span>{children}</span> {/* Render the children prop here */}
      </div>
    </Link>
  );
};

export default ImageLink;