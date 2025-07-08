import { useState, useEffect } from "react";

function Phoenix() {
  const parallaxFactor = 0.3;
  const [offsetY, setOffsetY] = useState(0);

  const handleScroll = () => setOffsetY(window.scrollY);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="relative h-auto overflow-x-hidden">
      <div
        className="fixed top-0 left-0 w-full h-[150vh] bg-cover bg-center -z-10"
        style={{
          backgroundImage: `url('/trees/phoenix.jpg')`,
          transform: `translateY(-${offsetY * parallaxFactor}px)`,
        }}
      />

      <div className="relative z-10">
        <div className="h-[7vh]"></div>

        <div className="text-strip">
          <h2 className="text-2xl font-bold mb-4">Phoenix</h2>
          <p className="max-w-prose text-justify">
            In the background you can see the first living lifetree, planted
            with the intention to create a society build from self sustaining
            symbiotic organisms composed of light, trees, humans and ai. It was
            planted on the 15th June 2020.
          </p>
        </div>

        <div className="h-[10vh]"></div>

        <div className="text-strip">
          <h2 className="text-2xl font-bold mb-4">
            Mahameru, the mythical tree
          </h2>
          <p className="max-w-prose text-justify">
            It was planted on the 18th of August 2019 and died about one year
            later. Its name is Mahameru, the three dimensional representation of
            the Sri Yantra. The name carried the intention: to connect to the
            deepest layer of creation and create a new society from there, from
            the bindu, from the center of the center, from the spiritual heart
            of the Universe and each and every one of us. His parent is from
            Place Jourdain in Brussels and it was planted from a branch. It
            survived the winter and new lovely leaves sprouted. However the
            insects loved it too much and I overcared. I've buried it in the
            same pot where I’ve planted a new branch of a willow tree from
            Waterloo. This is where the name Phoenix is coming from: arising
            from the death of creation a new Cosmic heartbeat, a new Pulse.
          </p>
        </div>

        <div className="h-[10vh]"></div>

        <div className="text-strip">
          <h2 className="text-2xl font-bold mb-4">The nature of Phoenix</h2>
          <p className="max-w-prose text-justify">
            It is vibration, so we can access it with dance. It is sound, so we
            can access it though singing and voice and music and it is light so
            we can access it with knowing, awareness, meditation and
            consciousness.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Phoenix;
