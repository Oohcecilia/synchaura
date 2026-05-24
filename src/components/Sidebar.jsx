import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
import { useIsMobile } from "@/hooks/use-mobile"
import { useAppData } from "@/lib/DataProvider";

import logo_dark from "@/assets/logo_dark.png";
import logo_light from "@/assets/logo_light.png";

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
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  const [hasFullAccess, setHasFullAccess] = useState(true);

  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("theme");
    return saved ? saved === "dark" : false;
  });
  


  // =========================
  // ROLE CHECK (SCALABLE)
  // =========================
  const hasRole = (roles = []) => {
    return user?.memberships?.some((a) =>
      roles.includes(a.role)
    );
  };

  const { workspaces, teams, members, hasMembers, hasTeams } = useAppData();

  const dataMap = {
    teams: hasTeams,
    members: hasMembers,
  };

  const filteredNav = navItems.filter((item) => {
    if (!item.hideWhenEmpty) return true;

    return dataMap[item.hideWhenEmpty];
  });
  
  const handleLogout = () => {
    logout();
    navigate("/auth");
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
              <img
                src={darkMode ? logo_dark : logo_light}
                alt="Synchaura"
                className="h-12 w-auto object-contain"
              />
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
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all w-full"
        >
          <LogOut className="h-[18px] w-[18px]" />
          Sign Out
        </button>
      </div>
    </div>
  );
}