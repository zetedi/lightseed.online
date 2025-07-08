import { useState, useEffect } from 'react';

export const useParallaxScroll = () => {
  const [offsetY, setOffsetY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setOffsetY(window.scrollY);

    window.addEventListener('scroll', handleScroll);
    
    // Cleanup the event listener when the hook is unmounted
    return () => window.removeEventListener('scroll', handleScroll);
  }, []); // Empty dependency array ensures this effect runs only once

  return offsetY;
};