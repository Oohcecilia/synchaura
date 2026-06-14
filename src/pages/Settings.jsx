import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, KeyRound, Loader2, Moon, Phone, Shield, Sun, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/lib/AuthContext";
import { getSavedTheme, applyTheme } from "@/utils/theme";
import { getUser } from "@/db/api";

export default function Settings() {
  const { user, logout, changePassword } = useAuth();
  const [pref, setPref] = useState(null);
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
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

  const userName = useMemo(
    () => `${pref?.first_name || user?.first_name || ""} ${pref?.last_name || user?.last_name || ""}`.trim(),
    [pref, user]
  );

  const passwordPolicyHint = "6+ characters, mixed case, a number, and a symbol.";
  const allowsPasswordSetup = user?.auth_provider === "google";

  const handlePasswordChange = async () => {
    setPasswordError("");
    setPasswordSuccess("");

    if ((!allowsPasswordSetup && !passwordForm.currentPassword) || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError("Please fill in all password fields");
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    try {
      setLoadingPassword(true);
      await changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      setPasswordSuccess("Password updated successfully");
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err) {
      setPasswordError(err.message || "Password update failed");
    } finally {
      setLoadingPassword(false);
    }
  };

  if (!user) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">No user logged in</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="grid gap-6">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <User className="h-4 w-4 text-primary" /> Profile
          </h2>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                <span className="text-xl font-bold text-primary">
                  {(userName || user?.email || "?").charAt(0).toUpperCase()}
                </span>
              </div>

              <div>
                <p className="font-semibold">{userName || "User"}</p>
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  {pref?.phone || user?.phone}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm capitalize text-muted-foreground">
                {user?.role || "member"}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            {darkMode ? <Moon className="h-4 w-4 text-primary" /> : <Sun className="h-4 w-4 text-primary" />}
            Appearance
          </h2>

          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-sm">Dark mode</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Keep the interface comfortable in low light.
              </p>
            </div>

            <Switch checked={darkMode} onCheckedChange={toggleTheme} />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <KeyRound className="h-4 w-4 text-primary" />
            Change password
          </h2>

          <div className="grid gap-4">
            <div>
              <Label className="text-sm">
                {allowsPasswordSetup ? "Current password or Google session" : "Current password"}
              </Label>
              <input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder={allowsPasswordSetup ? "Leave blank to set a password from your Google session" : "Enter current password"}
              />
              {allowsPasswordSetup ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Google accounts can set a password from an active session.
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-sm">New password</Label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Create a new password"
                />
              </div>

              <div>
                <Label className="text-sm">Confirm password</Label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  className="mt-2 w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Confirm new password"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground dark:bg-background/40">
              <p className="font-medium text-foreground">Password policy</p>
              <p className="mt-1">{passwordPolicyHint}</p>
            </div>

            {passwordError ? (
              <div className="flex items-center gap-2 rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {passwordError}
              </div>
            ) : null}

            {passwordSuccess ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
                {passwordSuccess}
              </div>
            ) : null}

            <Button
              type="button"
              onClick={handlePasswordChange}
              disabled={loadingPassword}
              className="w-full rounded-2xl"
            >
              {loadingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Update password
            </Button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold">Account</h2>

          <Button
            variant="outline"
            onClick={logout}
            className="border-destructive/20 text-destructive hover:bg-destructive/10 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-950/30"
          >
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}
