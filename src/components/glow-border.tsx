const GlowBorder = () => {
  return (
    <div 
      className="
        fixed       // Fix it to the viewport
        inset-0     // Make it cover the entire screen (top-0, right-0, bottom-0, left-0)
        border-3    // The visible border
        border-yellow-300/50 // A semi-transparent yellow for the border line
        shadow-[0_0_15px_5px_rgba(255,225,0,0.4)] // The outer glow effect
        rounded-lg  // Optional: if you want slightly rounded corners
        pointer-events-none // VERY IMPORTANT: Makes the div un-clickable so it doesn't block content
        z-50        // Ensure it's on top of most other content
      "
    />
  );
};

export default GlowBorder;