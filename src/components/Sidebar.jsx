import { Link, useLocation, useNavigate } from "react-router-dom";
import React from "react";
import {
  LayoutDashboard,
  CheckSquare,
  Building2,
  Users,
  UserCircle,
  Calendar,
  MapPin,
  Settings,
  LogOut,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/AuthContext";
import NotificationBell from "@/components/NotificationBell";
import { useAppData } from "@/lib/DataProvider";
import ThemeLogo from "@/components/ThemeLogo";
import { version as appVersion } from "../../package.json";

// =========================
// NAV ITEMS WITH ROLES
// =========================
const navItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },

  { path: "/tasks", label: "Tasks", icon: CheckSquare },

  {
    path: "/workspace",
    label: "Workspace",
    icon: Building2,
    roles: ["owner", "admin"],
  },

  {
    path: "/teams",
    label: "Teams",
    icon: Users,
    hideWhenEmpty: "teams",
  },

  {
    path: "/members",
    label: "Members",
    icon: UserCircle,
    hideWhenEmpty: "members",
  },

  { path: "/calendar", label: "Calendar", icon: Calendar },

  { path: "/map", label: "Location", icon: MapPin },

  { path: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar({ onClose }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, memberships } = useAuth();
  


  // =========================
  // ROLE CHECK (SCALABLE)
  // =========================
  const { hasMembers, hasTeams } = useAppData();

  const dataMap = {
    teams: hasTeams,
    members: hasMembers,
  };

  const filteredNav = navItems.filter((item) => {
    if (!item.hideWhenEmpty) return true;

    return dataMap[item.hideWhenEmpty];
  });
  
  const handleLogout = async () => {
    await logout();
    navigate("/auth", { replace: true });
  };

  return (
    <div className="w-72 h-full bg-card border-r border-border flex flex-col">
      {/* Logo */}
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          
            <div
              className={cn(
                "flex items-center p-1 rounded transition-colors"
              )}
            >
              <ThemeLogo className="h-12 w-auto object-contain" />
            </div>
        </div>

        <div className="flex items-center gap-1">
          <div
            className="hidden sm:block">
            <NotificationBell position="left" />

          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-1 hover:bg-muted rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-1">
        {filteredNav.map((item) => {
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <item.icon className="h-[18px] w-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/50 transition-colors">
          <button
            onClick={handleLogout}
            className="flex min-w-0 flex-1 items-center gap-3 text-sm font-medium text-muted-foreground hover:text-destructive transition-colors"
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            <span>Sign Out</span>
          </button>
          <span className="shrink-0 text-[11px] font-medium tracking-wide text-muted-foreground/80">
            v{appVersion}
          </span>
        </div>
      </div>
    </div>
  );
}
