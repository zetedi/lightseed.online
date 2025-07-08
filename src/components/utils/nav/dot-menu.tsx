import { MoreVertical } from "lucide-react";
import { Link } from "react-router-dom";
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
        <DropdownMenuItem>
          <Link to="/">The Vision</Link>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Link to="/phoenix">Phoenix</Link>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Link to="/thesecretsun">The Secret Sun</Link>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Link to="/photos">Images</Link>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Link to="/yantra">The Yantra</Link>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Link to="/white">The White Paper</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
