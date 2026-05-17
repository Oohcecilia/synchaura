import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useNavigate } from "react-router-dom";
import { User, Users } from "lucide-react";
import { cn } from "@/lib/utils";


const ACCOUNT_TYPES = [
  {
    key: "personal",
    label: "Personal",
    desc: "For individual use",
    icon: User,
  },
  {
    key: "team",
    label: "Team Workspace",
    desc: "Collaborate with your team",
    icon: Users,
  },
];

export default function Register() {
  const { register, authError } = useAuth();
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "light";
    document.documentElement.classList.toggle("dark", savedTheme === "dark");
  }, []);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    pin: "",
    accountType: "personal",
    workspaceName: "",
    workspaceDesc: "",
  });

  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");

    setIsLoadingAuth(true);


    // =========================
    // VALIDATION
    // =========================
    if (!form.first_name.trim()) {
      setError("First name is required");
      return;
    }

    if (!form.last_name.trim()) {
      setError("Last name is required");
      return;
    }

    if (!form.phone.trim()) {
      setError("Phone is required");
      return;
    }

    if (!/^\d{4}$/.test(form.pin)) {
      setError("PIN must be exactly 4 digits");
      return;
    }

    if (form.accountType === "team" && !form.workspaceName.trim()) {
      setError("Workspace name is required");
      return;
    }

    const payload = {
      first_name: form.first_name,
      last_name: form.last_name,
      phone: form.phone,
      pin: form.pin,
      accountType: form.accountType,
      workspaceName: form.workspaceName || null,
      workspaceDesc: form.workspaceDesc || null,
    };
    try {
      const res = await register(payload);

      setTimeout(() => {
        navigate("/setup");
      }, 1500);

    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setIsLoadingAuth(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted px-4 py-6 transition-colors">

      <div className="w-full max-w-md bg-card/80 backdrop-blur-xl border border-border shadow-xl rounded-3xl p-5 sm:p-6 flex flex-col gap-5 transition-colors">

        {/* TITLE */}
        <div className="text-center space-y-1">
          <h1 className="text-xl sm:text-2xl font-semibold text-foreground">
            Create Account
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Choose how you want to use your workspace
          </p>
        </div>

        {/* NAME */}
        <div className="grid grid-cols-2 gap-2">
          <input
            placeholder="First Name"
            value={form.first_name}
            onChange={(e) => setForm({ ...form, first_name: e.target.value })}
            className="w-full px-4 py-3 text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
          />
          <input
            placeholder="Last Name"
            value={form.last_name}
            onChange={(e) => setForm({ ...form, last_name: e.target.value })}
            className="w-full px-4 py-3 text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
          />
        </div>

        {/* PHONE */}
        <input
          placeholder="Phone Number"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="w-full px-4 py-3 text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
        />

        {/* PIN */}
        <input
          type="password"
          maxLength={4}
          placeholder="4-digit PIN"
          value={form.pin}
          onChange={(e) => setForm({ ...form, pin: e.target.value })}
          className="w-full px-4 py-3 text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground text-center tracking-widest focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
        />

        {/* ACCOUNT TYPE */}
        <div>
          <p className="text-xs text-muted-foreground mb-3">
            Choose Account Type
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ACCOUNT_TYPES.map((type) => {
              const Icon = type.icon;
              const isActive = form.accountType === type.key;

              return (
                <button
                  key={type.key}
                  onClick={() => setForm({ ...form, accountType: type.key })}
                  className={cn(
                    "relative p-4 rounded-2xl border text-left transition-all duration-200 group",
                    "hover:shadow-md hover:-translate-y-[1px]",
                    isActive
                      ? "border-primary bg-primary/5"
                      : "border-border bg-background"
                  )}
                >
                  {/* CHECK */}
                  <div
                    className={cn(
                      "absolute top-3 right-3 w-4 h-4 rounded-full border",
                      isActive
                        ? "bg-primary border-primary"
                        : "border-border"
                    )}
                  />

                  {/* ICON */}
                  <div
                    className={cn(
                      "w-10 h-10 flex items-center justify-center rounded-xl mb-3 transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground dark:text-black"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Icon size={18} />
                  </div>

                  {/* TEXT */}
                  <p className="text-sm font-semibold text-foreground">
                    {type.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {type.desc}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* TEAM FIELDS */}
        {form.accountType === "team" && (
          <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <input
              placeholder="Workspace Name"
              value={form.workspaceName}
              onChange={(e) =>
                setForm({ ...form, workspaceName: e.target.value })
              }
              className="w-full px-4 py-3 text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
            />

            <textarea
              placeholder="Workspace Description (optional)"
              value={form.workspaceDesc}
              onChange={(e) =>
                setForm({ ...form, workspaceDesc: e.target.value })
              }
              className="w-full px-4 py-3 text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
            />
          </div>
        )}

        {/* ERROR */}
        {error && (
          <div className="text-center text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl py-2 px-3">
            {error}
          </div>
        )}

        {/* SUBMIT */}
        <button
          onClick={handleSubmit}
          disabled={isLoadingAuth}
          className="w-full py-3 rounded-xl font-medium shadow-md
        bg-primary text-white hover:opacity-90 active:scale-[0.98]
        transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoadingAuth ? "Creating Account..." : "Create Account"}
        </button>

        {/* LOGIN */}
        <p className="text-xs sm:text-sm text-center text-muted-foreground">
          Already have an account?{" "}
          <span
            className="text-primary font-medium cursor-pointer"
            onClick={() => navigate("/auth")}
          >
            Login
          </span>
        </p>

      </div>
    </div>
  );
}