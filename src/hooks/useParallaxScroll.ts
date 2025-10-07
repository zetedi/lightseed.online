import { useState, useEffect } from 'react';

export const useParallaxScroll = () => {
  const [offsetY, setOffsetY] = useState(0);
  let frameId: number;

  useEffect(() => {
    const handleScroll = () => {
      if (!frameId) {
        frameId = requestAnimationFrame(() => {
          setOffsetY(window.scrollY);
          frameId = 0;
        });
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (frameId) cancelAnimationFrame(frameId);
    };
  }, []);

  return offsetY;
};