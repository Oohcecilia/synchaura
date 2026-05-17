import { Menu } from "lucide-react";
import NotificationBell from "./NotificationBell";
import tf_logo from "@/assets/tf-logo.png";
import { cn } from "@/lib/utils";


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
        {/* Icon logo */}
        {/* <div className="h-9 w-9 rounded-xl overflow-hidden bg-background flex items-center justify-center flex-shrink-0">
          <img
            src={ts_logo}
            alt="Teamstar Logo"
            className="h-full w-full object-cover"
          />
        </div> */}

        {/* Text logo (not stretched) */}
        <div
          className={cn(
            "flex items-center p-1 rounded transition-colors",
            "dark:bg-primary d dark:shadow-md dark:shadow-primary/25"
          )}
        >
          <img
            src={tf_logo}
            alt="Teamstar Text Logo"
            className="h-4 w-auto object-contain"
          />
        </div>

      </div>
      <NotificationBell />
    </div>
  );
}
