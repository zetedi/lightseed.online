import React from "react"; // Required for JSX
import { Button } from "@/components/ui/button";
import DynamicGallery from "../components/gallery/dynamic-gallery";

const PHOTOFOLDER = "../../../assets/tss/*.{png,jpg,jpeg,svg,gif}";

// We'll use a `title` and a `text` property, where `text` can be a string or JSX.
export const tssContent = [
  {
    title: "The Secret Sun",
    text: `The Secret Sun is the third part of the path of lightseed. After planting our intention in our heart, we plant a tree. Then the third part is to plant a seed in the community to foster a deeper connection with trees. For that a natural choice for example is to build a platform, a fountain, a bench, a guild, a bird feeder, a beehive or a piece of art close to the tree together with the members of the community.`,
  },
  {
    title: "Images",
    text: (
      <div className="centered-holder">
        <DynamicGallery imageGlobPattern={PHOTOFOLDER} />
      </div>
    ),
  },
  {
    title: "Auspicious Signs",
    text: (
      <>
        For the tree named Phoenix, the platform was the best choice. Since it
        is very close to the mediation path around the chateau of Hridaya France
        we cut a new path through the brumble towards the direction which seemed
        a better place for a platform. And it happened that the area and the
        platform itself is interwoven with magic. The first auspicious sign for
        building was the finding of the Bodhisattva stone, a big stone on the
        path. The hill does not have many stones and the Kogi people believe
        that finding a stone while cutting a path is a very good sign. After a
        couple of days of listening and cutting the way we ended up on the exact
        place where the permaculture design marked a place for a platform years
        before.
      </>
    ),
  },
  {
    title: "Sacred Alignments",
    text: (
      <>
        The second auspicious sign was the holly tree, which in folklore is a
        sacred tree protecting the area from evil spirits and should not be cut,
        thus marking one side of the platform. The other side there was a group
        of small oak trees. These two trees are in constant battle according to
        folklore, emphasizing the polarity aspect. The other ones were the two
        stumps of the douglas firs which were cut about three years before. They
        were exactly across the middle so we could use them as a base and as a
        symbolic rebirth of the trees in a different form. The third one is the
        wild rose island which became apparent after the second cutting of the
        path and before starting of the building of the platform. When we marked
        the corners of the platform we hit another stone, the Heart Stone.
      </>
    ),
  },
  {
    title: "Cosmic Timing and Symbolism",
    text: (
      <>
        The building took place through the summer solstice, the international
        yoga day and the full moon the next day, St John’s day (with a fire
        ceremony), St Peter’s day, Madeira Day (madeira means wood in
        Portuguese) and Keti Koti, the celebration of freedom from slavery in
        Netherlands. The number 37 is present in every aspect of the platform,
        sometimes deeply hidden. The marking in the concrete in the North-East
        corner is the number 37. There are 3x7 planks on the top. The platform
        wes consecrated on the second day of the seventh month, however the last
        layer of oil on top was soaking in the night of 3/7 and was sealed on
        that day with Shambo, a powerful shamanic drum. The reason why 37 was
        central to the symbolism is to emphasize the principles conducive to
        bodhi:
        <br />
        <br />
        <i>
          “Bodhipakṣa-caryā, the practice of the 37 bodhipakṣadharmas (the
          principles conducive to bodhi) which are: the four applications of
          mindfulness, the four right efforts, the four bases of spiritual
          power, the five spiritual faculties, the five strengths, the seven
          factors of awakening and the noble eightfold path.” -
        </i>{" "}
        <Button
          variant="link"
          asChild
          className="p-0 h-auto -ml-1 inline-block align-baseline"
        >
          <a
            href="https://en.wikipedia.org/wiki/Bodhipakkhiy%C4%81dhamm%C4%81"
            target="_blank"
            rel="noopener noreferrer"
          >
            Bodhipakkhiyādhammā
          </a>
        </Button>
      </>
    ),
  },
  {
    title: "Numbers of the Universe",
    text: (
      <>
        The other symbolic number present was the number 108. The reinforcing
        beams are 108 cm long each, pointing at the cosmic number prevalent in
        yoga, and the reason being that on average the Sun is 108 Suns away, the
        Moon is 108 Moons away and the Sun is 108 Earths wide. -
      </>
    ),
  },
  {
    title: "Polarity and Unity",
    text: (
      <>
        The Yin-Yang symbol and the polarities are represented by how the middle
        beam is on different sides of the middle supporting beams. The handmade
        marks in the opposing corners also represents polarity - the one opposed
        to one marked with the heart does not have a mark, it’s emptiness,
        nothing - it’s either love or nothing. The other two opposing corners
        are the 37 representing the bodhisattvas and selflessness and the R, the
        mark of the individual, anonymous people who build the pyramids, the R
        put down by a desire to leave a trace and to mark. The two tree stumps
        below the platform are also symbolizing polarities with their roots
        hugging each other underground. -{" "}
        <Button
          variant="link"
          asChild
          className="p-0 h-auto -ml-1 inline-block align-baseline"
        >
          <a
            href="https://www2.kenyon.edu/Depts/Religion/Fac/Adler/Reln260/Heartmantra.htm"
            target="_blank"
            rel="noopener noreferrer"
          >
            Heartmantra
          </a>
        </Button>
      </>
    ),
  },
  {
    title: "Sacred Foundations",
    text: `The bigger path towards the building one one hand took through Assisi, and from there are four stones embedded in the concrete on each corner of the platform. The water contains water from the temple where St. Francis’s final resting place is. The tap was just above his chamber. And from an even more overarching perspective the unmarked corner has a flower of life pendant embedded from the temple of Osiris in Abydos, Egypt, where the flower of life symbol appeared the first time according to some archeologists.`,
  },
];
