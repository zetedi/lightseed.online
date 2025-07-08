import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { SubscriptionDialog } from "@/components/newsletter/subscription-dialog";

function Home() {
  return (
    <div>
      <div className="tree">
        <div id="lifeseed-holder" className="centered-holder">
          <div id="lifeseed-holder" className="centered-holder">
            <div className="lifeseed " />
            <div className="flex flex-col items-center space-y-2 mt-1 m-1">
              <Link
                to="/phoenix"
                className="bg-white text-black p-2 rounded-lg text-center w-full max-w-xs hover:bg-green-50 border-2 border-green-900 shadow-md shadow-white"
              >
                Phoenix
              </Link>
              <Link
                to="/thesecretsun"
                className="bg-white text-black p-2 rounded-lg text-center w-full max-w-xs hover:bg-green-50 border-2 border-green-900 shadow-md shadow-white"
              >
                The Secret Sun
              </Link>
              <Link
                to="/white"
                className="bg-white text-black p-2 rounded-lg text-center w-full max-w-xs hover:bg-green-50 border-2 border-green-900 shadow-md shadow-white"
              >
                The White Paper
              </Link>
            </div>
          </div>
        </div>

        <div id="lifeseed-holder" className="centered-holder">
          <div id="lifeseed-holder" className="centered-holder"></div>
        </div>

        <Card className="dark:bg-black light:text-black dark:text-white mx-auto p-6 border border-gray-300 shadow-lg rounded-lg">
          <CardHeader>
            <CardTitle>
              <p className="text-center w-full text-4xl">live light</p>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className=" w-full text-justify mb-2">
              &nbsp;&nbsp;The purpose of <b>lightseed</b> is to bring joy. The
              joy of realizing the bliss of conscious, compassionate, grateful
              existence by opening a portal to the center of life. By creating a
              bridge between creator and creation, science and spirituality,
              virtual and real, nothing and everything. It is designed to
              intimately connect our inner Self, our culture, our trees and the
              tree of life, the material and the digital, online world into a
              sustainable and sustaining circle of unified vibration, sound and
              light. It aims to merge us into a common flow for all beings to be
              liberated, wise, strong, courageous and connected. It is rooted in
              nonviolence, compassion, generosity, gratitude and love. It is
              blockchain (truthfulness), cloud (global, distributed, resilient),
              ai (for connecting dreams and technology), regen (nature centric)
              native. It is an inspiration, an impulse towards a quantum leap in
              consciousness, a prompt both for human and artificial intelligence
              for action towards transcending humanity into a new era, a New
              Earth, Universe and Field with the help of our most important
              evolutionary sisters and brothers, the trees.
            </p>
            <p className=" w-full text-justify mb-2">
              <b>The first steps:</b> We plant lightseed (our vision) with the
              seed of a tree we have a deep connection with in four realms:
            </p>
            <p className=" w-full text-justify mb-2">
              <ul className="list-disc pl-4 pt-2 mx-8">
                <li>
                  in our spiritual heart, with the intention of realization (or
                  our highest goal)
                </li>
                <li>
                  in the soil of an important place for us (or in a pot if we
                  haven't found that place yet) for the tree to flourish (this
                  will be our first lifetree)
                </li>
                <li>
                  in our community or culture as an inspiration (e.g.{" "}
                  <b>
                    <a href="http://lightseed.online/thesecretsun">
                      The Secret Sun
                    </a>
                  </b>
                  )
                </li>{" "}
                <li>
                  in the light, in virtual (by creating our servers and online
                  projects to be guided by nature)
                </li>
              </ul>
            </p>
            <p className=" w-full text-justify">
              All four quadrants are ultimately (and intimately) connected with
              the animating force or lifeforce - the beginning of creation.
            </p>
            <br />
            <p className="text-center w-full text-xl">
              <b>We stand for trees.</b>
            </p>
          </CardContent>
          <CardFooter>
            <div className="centered-holder">
              <SubscriptionDialog />
            </div>
          </CardFooter>
        </Card>
      </div>
      <Toaster />
    </div>
  );
}

export default Home;
