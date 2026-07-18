const GlowBorder = () => {
  return (
    <div
      aria-hidden
      role="presentation"
      className="fixed inset-0 z-50 pointer-events-none rounded-lg border-[3px] border-yellow-300/50 shadow-[0_0_15px_5px_rgba(255,225,0,0.4)]"
    />
  );
};

export default GlowBorder;