import { useState, useEffect } from "react";
import { Moon, Sun, User, Shield, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/AuthContext";
import { getSavedTheme, applyTheme } from "@/utils/theme";
import { getUser } from "@/db/api";

export default function Settings() {
  const { user, session, logout } = useAuth();
  const [pref, setPref] = useState(null);

  const [loading] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("theme");
    return saved ? saved === "dark" : false;
  });

useEffect(() => {
  if (!user?.id) return;

  const loadUserPref = async () => {
    try {
      const data = await getUser(user.id);
      setPref(data);

      const theme = data?.theme || getSavedTheme();
      setDarkMode(applyTheme(theme));

    } catch (err) {
      console.error("User pref error:", err);
    }
  };

  loadUserPref();
}, [user]);

  const toggleTheme = (checked) => {
    setDarkMode(checked);
    document.documentElement.classList.toggle("dark", checked);
    localStorage.setItem("theme", checked ? "dark" : "light");
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">No user logged in</p>
      </div>
    );
  }

  const userName = `${pref?.first_name} ${pref?.last_name}`;

  return (
    <div className="max-w-2xl mx-auto space-y-8">

      {/* Profile */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
          <User className="h-4 w-4 text-primary" /> Profile
        </h2>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <span className="text-xl font-bold text-primary">
                {(userName || user?.email || "?").charAt(0).toUpperCase()}
              </span>
            </div>

            <div>
              <p className="font-semibold">{userName || "User"}</p>
              <p className="text-sm text-muted-foreground flex items-center gap-2"> <Phone className="h-3.5 w-3.5 text-muted-foreground" /> {pref?.phone}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground capitalize">
              {user?.role || "member"}
            </span>
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
          {darkMode ? <Moon className="h-4 w-4 text-primary" /> : <Sun className="h-4 w-4 text-primary" />}
          Appearance
        </h2>

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm">Dark Mode</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Switch theme
            </p>
          </div>

          <Switch checked={darkMode} onCheckedChange={toggleTheme} />
        </div>
      </div>

      {/* Sign Out */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="text-sm font-semibold mb-4">Account</h2>

        <Button
          variant="outline"
          onClick={logout}
          className="text-destructive border-destructive/20 hover:bg-destructive/10 dark:text-red-400 dark:border-red-900/40 dark:hover:bg-red-950/30"
        >
          Sign Out
        </Button>
      </div>

    </div>
  );
}