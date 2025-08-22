
import { useConfig } from "@/context/ConfigContext";
import { MainNavProps } from "@/types/Types"
import { cn } from "@/lib/utils"
import { Icons } from "@/components/LucideIcons"

export function MainNav({ items }: MainNavProps) {

  const { appConfig } = useConfig();

  return (
    <div className="flex gap-6 md:gap-10">
      <a href="/" className="flex items-center space-x-2">
        <Icons.logo />
        <span className="inline-block font-bold">{appConfig.title}</span>
      </a>
      {items?.length ? (
        <nav className="flex gap-6">
          {items?.map(
            (item, index) =>
              item.href && (
                <a
                  key={index}
                  href={item.href}
                  className={cn(
                    "flex items-center text-sm font-medium text-muted-foreground",
                    item.disabled && "cursor-not-allowed opacity-80"
                  )}
                >
                  {item.title}
                </a>
              )
          )}
        </nav>
      ) : null}
    </div>
  )
}
