import { useConfig } from "../context/ConfigContext";
import { motion } from "framer-motion";

// Replace with your real images or pull from cfg later
const images = [
  "/assets/photography/1.jpg",
  "/assets/photography/2.jpg",
  "/assets/photography/3.jpg",
  "/assets/photography/4.jpg",
  "/assets/photography/5.jpg",
  "/assets/photography/6.jpg",
  "/assets/photography/7.jpg",
];

// Predefined scattered positions across three visual layers
// layer: 0 (bottom), 1 (middle), 2 (top)
const positions = [
  { x: -220, y: -140, r: -8, layer: 2 },
  { x: 40, y: -190, r: 6, layer: 1 },
  { x: -10, y: 20, r: -2, layer: 0 },
  { x: 220, y: -60, r: 10, layer: 2 },
  { x: -260, y: 100, r: 12, layer: 1 },
  { x: 120, y: 160, r: -6, layer: 0 },
  { x: -30, y: 220, r: 4, layer: 2 },
];

const floatKeyframes = (i: number) => ({
  y: [0, -8 - (i % 3), 0, 6 + (i % 2), 0],
  x: [0, 2 + (i % 2), 0, -2 - (i % 3), 0],
  rotate: [0, i % 2 ? 0.8 : -0.8, 0, i % 3 ? -0.6 : 0.6, 0],
});

export default function ArtApp() {
  const cfg = useConfig();

  // Accent glow pulled from config if available
  const accent = (cfg as any)?.theme?.accent || "#8fd694"; // close to Lifetree mock vibe

  return (
    <main
      className="min-h-screen text-white flex flex-col items-center justify-start p-6 md:p-10 overflow-hidden"
      style={{
        background:
          "radial-gradient(1200px 600px at 10% 10%, rgba(64, 255, 199, 0.08), transparent 60%), radial-gradient(1200px 800px at 90% 20%, rgba(170, 120, 255, 0.08), transparent 60%), linear-gradient(180deg, #0a0b0a, #0b0f0c 40%, #070707)",
      }}
    >
      <header className="w-full max-w-6xl mx-auto text-center mt-4 mb-8">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight">
          {cfg.app.title}
        </h1>
        <p className="mt-2 text-sm md:text-base opacity-80">
          Seven frames, floating mid‑air across three layers.
        </p>
      </header>

      <div className="relative w-full max-w-6xl mx-auto h-[60vh] sm:h-[65vh] md:h-[70vh]">
        {images.map((src, i) => {
          const pos = positions[i % positions.length];
          const sizeClasses = "w-36 sm:w-44 md:w-56 lg:w-64"; // responsive sizing

          return (
            <motion.div
              key={i}
              className={`absolute ${sizeClasses} aspect-[4/5] rounded-2xl overflow-hidden select-none`}
              style={{
                left: `calc(50% + ${pos.x}px)`,
                top: `calc(45% + ${pos.y}px)`,
                zIndex: 10 + pos.layer,
                boxShadow:
                  "0 12px 28px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.35)",
                transform: `rotate(${pos.r}deg)`,
                // subtle accented ring
                outline: `1px solid rgba(255,255,255,0.06)`,
                filter: "drop-shadow(0 0 14px rgba(0,0,0,0.25))",
              }}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1, ...floatKeyframes(i) }}
              transition={{
                duration: 7 + (i % 4),
                repeat: Infinity,
                ease: "easeInOut",
              }}
              whileHover={{
                scale: 1.03,
                rotate: pos.r + (i % 2 ? 2 : -2),
                boxShadow: `0 16px 38px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.08), 0 0 30px ${accent}40`,
              }}
            >
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(0,0,0,0.18))",
                  zIndex: 1,
                }}
              />
              <img
                src={src}
                alt={`floating-art-${i + 1}`}
                className="w-full h-full object-cover"
                draggable={false}
              />
            </motion.div>
          );
        })}

        {/* soft ambient accent glows to suggest layers */}
        <div
          className="pointer-events-none absolute -inset-10 opacity-50"
          style={{
            background: `radial-gradient(500px 200px at 30% 70%, ${accent}15, transparent 60%), radial-gradient(420px 180px at 70% 30%, ${accent}10, transparent 60%)`,
          }}
        />
      </div>

      <footer className="mt-10 text-center opacity-80 text-sm">
        Solarpunk drift • gently animated with Framer Motion • responsive
        layout.
      </footer>
    </main>
  );
}
