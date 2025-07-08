import React from "react";

import { useParallaxScroll } from "../hooks/useParallaxScroll";
import TextStrip from "../components/text-strip/text-strip";
import { tssContent } from "../content/tss-content";

// A simple spacer component for clarity in the map function
const Spacer = ({ height }: { height: string }) => <div style={{ height }} />;

const TheSecretSun = () => {
  const offsetY = useParallaxScroll();
  const parallaxFactor = 0.3;

  return (
    <div className="relative h-auto overflow-x-hidden">
      {/* BACKGROUND LAYER */}
      <div
        className="fixed top-0 left-0 w-full h-[150vh] bg-cover bg-center -z-10"
        style={{
          backgroundImage: `url('/trees/phoenix.jpg')`, 
          transform: `translateY(-${offsetY * parallaxFactor}px)`,
        }}
      />

      {/* FOREGROUND CONTENT LAYER */}
      <div className="relative z-10">

        <Spacer height="3vh" />

        {/* Map over the new tssContent data array */}
        {tssContent.map((section, index) => (
          <React.Fragment key={section.title}>
            <TextStrip title={section.title}>
              {section.text}
            </TextStrip>
            
            {/* Don't add a spacer after the very last text strip */}
            {index < tssContent.length - 1 && <Spacer height="7vh" />}
          </React.Fragment>
        ))}
        <Spacer height="7vh" /> {/* Add a final spacer at the bottom */}
      </div>
    </div>
  );
};

export default TheSecretSun;