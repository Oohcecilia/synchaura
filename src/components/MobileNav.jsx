import { Menu } from "lucide-react";
import NotificationBell from "./NotificationBell";
import { cn } from "@/lib/utils";
import ThemeLogo from "@/components/ThemeLogo";


export default function MobileNav({ onMenuClick }) {
  return (
    <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-card">
      <button
        onClick={onMenuClick}
        className="p-2 hover:bg-muted rounded-xl transition-colors"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex items-center gap-1">
        <div
          className={cn(
            "flex items-center p-1 rounded transition-colors"
          )}
        >
          <ThemeLogo className="h-10 w-auto object-contain" />
        </div>

      </div>
      <NotificationBell />
    </div>
  );
}
