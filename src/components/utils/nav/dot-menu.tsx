import { MoreVertical } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function DotMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreVertical className="h-4 w-4" />
          <span className="sr-only">More</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem>The Beginning</DropdownMenuItem>
        <DropdownMenuItem>Phoenix</DropdownMenuItem>
        <DropdownMenuItem>The Secret Sun</DropdownMenuItem>
        <DropdownMenuItem>The Sigil</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
