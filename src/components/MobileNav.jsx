import { useState } from "react";
import { Menu } from "lucide-react";
import NotificationBell from "./NotificationBell";
import { cn } from "@/lib/utils";
import logo_dark from "@/assets/logo_dark.png";
import logo_light from "@/assets/logo_light.png";


export default function MobileNav({ onMenuClick }) {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("theme");
    return saved ? saved === "dark" : false;
  });
    

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
          <img
            src={darkMode ? logo_dark : logo_light}
            alt="Synchaura"
            className="h-10 w-auto object-contain"
          />
        </div>

      </div>
      <NotificationBell />
    </div>
  );
}
