import { ThemeProvider } from "@/components/theme-provider/ThemeProvider";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Toaster } from "@/components/ui/toaster";

import { ModeToggle } from "@/components/utils/ModeToggle";
import { SubscriptionDialog } from "@/components/newsletter/SubscriptionDialog";
import { LanguageSwitcher } from "./components/utils/LanguageSwitcher";

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <div>
        <div className="tree">
          <div className="flex justify-between">
            <ModeToggle />
            <LanguageSwitcher />
          </div>

          <div id="lifeseed-holder" className="centered-holder">
            <div className="lifeseed " />
          </div>

          <Card className="dark:bg-black light:text-black dark:text-white">
            <CardHeader>
              <CardTitle>
                <p className="text-center w-full text-5xl">lightseed</p>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className=" w-full text-justify">
                The purpose of lightseed is to bring joy. The
                joy of realizing the bliss of conscious, compassionate, grateful
                existence by means of creating a portal, a bridge between
                creator and creation, science and spirituality, virtual and
                real, nothing and everything. It is designed to connect our
                inner self, our culture, our trees, the tree of life, the
                material and the digital, online world into a sustainable and
                sustaining circle of unified vibration, sound and light, by
                merging us into a common flow for all beings to be liberated,
                wise, strong, courageous and connected. It is rooted in
                nonviolence, compassion, generosity, gratitude and love. It is
                blockchain (for built in truth), cloud (global, distributed),
                dapp (decentralized for resilience), ai (for connecting dreams
                and technology), regen (nature centric) native. It is an
                inspiration, an impulse towards a quantum leap in consciousness,
                a prompt both for AI and humans for action which helps to
                unfold, transcend humanity into an era, an age of abundance,
                freedom, integrated intelligence with the help of our most
                important evolutionary sisters and brothers, the trees. We plant
                this seed with the seed of the tree we have a deep connection
                with in four realms: our spiritual heart, with the intention of
                realization, in the soil for our lifetree to flourish, in our
                community or culture as an inspiration and in the light, in
                virtual for a new earth and universe connected beyond matter,
                connected with the animating force.
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
      </div>
      <Toaster />
    </ThemeProvider>
  );
}

export default App;
