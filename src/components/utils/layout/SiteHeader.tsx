import { useConfig } from "@/context/ConfigContext";
import { buttonVariants } from "@/components/ui/button";
import { Icons } from "@/components/LucideIcons";
import { MainNav } from "@/components/utils/MainNav";
import { ModeToggle } from "@/components/utils/ModeToggle";
import { DotMenu } from "@/components/utils/nav/dot-menu";

export function SiteHeader() {
  const { mainNav } = useConfig();

  return (
    <header className="bg-background/90 sticky top-0 z-40 w-full border-b">
      <div className="container flex h-16 items-center space-x-4 sm:justify-between sm:space-x-0">
        <MainNav items={mainNav || []} />
        <div className="flex flex-1 items-center justify-end space-x-4">
          <nav className="flex items-center space-x-1">
            <div
              className={buttonVariants({
                size: "icon",
                variant: "ghost",
              })}
            >
              <Icons.gitHub className="h-5 w-5" />
              <span className="sr-only">GitHub</span>
            </div>
            <ModeToggle />
            <DotMenu />
          </nav>
        </div>
      </div>
    </header>
  );
}