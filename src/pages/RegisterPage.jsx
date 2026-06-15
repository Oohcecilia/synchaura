import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useNavigate } from "react-router-dom";
import { API_URL } from "@/api/client";
import { ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, Sparkles, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCOUNT_TYPES = [
  {
    key: "personal",
    label: "Personal",
    desc: "Private workspaces for independent planning.",
    icon: User,
  },
  {
    key: "team",
    label: "Team Workspace",
    desc: "Designed for shared execution and collaboration.",
    icon: Users,
  },
];

const PASSWORD_RULES = [
  "At least 6 characters",
  "Uppercase and lowercase letters",
  "A number and a symbol",
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
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    accountType: "personal",
    workspaceName: "",
    workspaceDesc: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");

  const passwordScore = useMemo(() => {
    let score = 0;
    if (!form.password) return score;
    if (form.password.length >= 6) score += 1;
    if (/[a-z]/.test(form.password) && /[A-Z]/.test(form.password)) score += 1;
    if (/\d/.test(form.password)) score += 1;
    if (/[^a-zA-Z0-9]/.test(form.password)) score += 1;
    return Math.max(1, score);
  }, [form.password]);

  const passwordLabel = useMemo(() => {
    if (!form.password) return "None";
    if (passwordScore === 1) return "Weak";
    if (passwordScore === 2) return "Fair";
    if (passwordScore === 3) return "Strong";
    return "Excellent";
  }, [form.password, passwordScore]);

  const handleGoogleAuth = () => {
    if (isLoadingAuth) return;

    if (!navigator.onLine) {
      setError("Google sign-up requires an internet connection");
      return;
    }

    window.location.assign(`${API_URL}/auth/google/start?flow=register`);
  };

  const handleSubmit = async () => {
    setError("");

    if (!form.first_name.trim()) {
      setError("First name is required");
      return;
    }

    if (!form.last_name.trim()) {
      setError("Last name is required");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!form.email.trim() || !emailRegex.test(form.email)) {
      setError("A valid email address is required");
      return;
    }

    if (!form.phone.trim()) {
      setError("Phone number is required");
      return;
    }

    if (form.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!/[a-z]/.test(form.password) || !/[A-Z]/.test(form.password) || !/\d/.test(form.password) || !/[^a-zA-Z0-9]/.test(form.password)) {
      setError("Password must include uppercase, lowercase, a number, and a symbol");
      return;
    }

    if (form.accountType === "team" && !form.workspaceName.trim()) {
      setError("Workspace name is required");
      return;
    }

    const payload = {
      first_name: form.first_name,
      last_name: form.last_name,
      email: form.email,
      phone: form.phone,
      password: form.password,
      accountType: form.accountType,
      workspaceName: form.workspaceName || null,
      workspaceDesc: form.workspaceDesc || null,
    };

    try {
      setIsLoadingAuth(true);
      await register(payload);

      setTimeout(() => {
        navigate("/setup");
      }, 1500);
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const disabled = isLoadingAuth;

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground transition-colors selection:bg-primary/20">
      {/* Refined Background Gradients */}
      <div className="pointer-events-none absolute inset-0 opacity-40 mix-blend-multiply dark:opacity-20 dark:mix-blend-screen">
        <div className="absolute -right-[10%] -top-[10%] h-[40rem] w-[40rem] rounded-full bg-primary/10 blur-[100px]" />
        <div className="absolute left-[0%] top-[30%] h-[30rem] w-[30rem] rounded-full bg-muted-foreground/10 blur-[100px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center p-4 sm:p-8">
        <div className="grid w-full max-w-6xl gap-12 lg:grid-cols-[1fr_500px] xl:gap-20 items-start py-8">
          
          {/* Left Column: Context & Benefits */}
          <section className="sticky top-12 hidden lg:flex flex-col space-y-10 pt-12">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2.5 rounded-full border border-border/50 bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm">
                <div className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
                </div>
                Built for secure task collaboration
              </div>

              <h1 className="text-4xl font-semibold tracking-tight text-foreground xl:text-5xl/tight">
                Start a workspace that feels polished and private.
              </h1>
              <p className="max-w-md text-base leading-relaxed text-muted-foreground">
                Create a secure account with a modern password, then shape a personal or team workspace for planning, discussion, and execution.
              </p>
            </div>

            <div className="space-y-6 pt-4 border-t border-border/40">
              {[
                {
                  title: "Password-based security",
                  description: "Every account starts with a stronger credential from the beginning.",
                  icon: LockKeyhole,
                },
                {
                  title: "Personal or team modes",
                  description: "Choose the collaboration model that fits your workflow before the first task is created.",
                  icon: Users,
                },
                {
                  title: "Clear onboarding",
                  description: "A smoother setup experience with simple validation and a cleaner visual hierarchy.",
                  icon: CheckCircle2,
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="group flex items-start gap-4 transition-opacity hover:opacity-100 opacity-80">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-muted/50 text-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary group-hover:border-primary/20">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Right Column: Registration Form */}
          <section className="w-full mx-auto">
            <div className="rounded-3xl border border-border/60 bg-card/50 p-6 shadow-2xl shadow-primary/5 backdrop-blur-xl sm:p-10 dark:bg-card/40">
              
              <div className="mb-8 text-center sm:text-left">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary sm:hidden">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h2 className="text-2xl font-semibold tracking-tight">Create your account</h2>
                <p className="mt-1 text-sm text-muted-foreground">Set up your workspace credentials.</p>
              </div>

              <div className="space-y-6">
                <button
                  type="button"
                  onClick={handleGoogleAuth}
                  disabled={disabled}
                  className="flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-background/50 px-4 py-2.5 text-sm font-medium text-foreground transition-all hover:bg-muted hover:border-border/80 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Sign up with Google
                </button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border/60"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card/50 px-3 text-muted-foreground backdrop-blur-xl">Or register with</span>
                  </div>
                </div>

                {/* Core Information Section */}
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">First name</label>
                      <input
                        placeholder="Jane"
                        value={form.first_name}
                        onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                        className="w-full capitalize rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Last name</label>
                      <input
                        placeholder="Doe"
                        value={form.last_name}
                        onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                        className="w-full capitalize rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Email address</label>
                      <input
                        type="email"
                        placeholder="jane@example.com"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Phone number</label>
                      <input
                        placeholder="+1 (555) 000-0000"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        className="w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                      />
                    </div>
                  </div>

                  {/* Password Section */}
                  <div className="grid gap-4 sm:grid-cols-2 items-start">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Password</label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="Create a password"
                          value={form.password}
                          onChange={(e) => setForm({ ...form, password: e.target.value })}
                          className="w-full rounded-xl border border-border bg-background/50 pl-3 pr-10 py-2.5 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((value) => !value)}
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground transition hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      
                      {/* Visual Password Strength Meter */}
                      {form.password && (
                        <div className="mt-2 space-y-1.5">
                          <div className="flex h-1 gap-1">
                            {[1, 2, 3, 4].map((level) => (
                              <div
                                key={level}
                                className={`h-full w-full rounded-full transition-colors duration-300 ${
                                  passwordScore >= level
                                    ? passwordScore <= 1
                                      ? "bg-red-500"
                                      : passwordScore === 2
                                      ? "bg-amber-500"
                                      : passwordScore === 3
                                      ? "bg-emerald-500"
                                      : "bg-primary"
                                    : "bg-muted"
                                }`}
                              />
                            ))}
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className={
                              passwordScore <= 1 ? "text-red-500" :
                              passwordScore === 2 ? "text-amber-500" :
                              passwordScore === 3 ? "text-emerald-500" : "text-primary"
                            }>
                              {passwordLabel}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Confirm password</label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Confirm password"
                          value={form.confirmPassword}
                          onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                          className="w-full rounded-xl border border-border bg-background/50 pl-3 pr-10 py-2.5 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((value) => !value)}
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground transition hover:text-foreground"
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border/50 bg-muted/30 p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground mb-2">Password requirements</p>
                  <ul className="space-y-1.5">
                    {PASSWORD_RULES.map((rule) => (
                      <li key={rule} className="flex items-center gap-2.5 text-xs">
                        <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground/70" />
                        {rule}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Workspace Selection Section */}
                <div className="pt-2">
                  <label className="mb-3 block text-sm font-medium text-foreground">Workspace type</label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {ACCOUNT_TYPES.map((type) => {
                      const Icon = type.icon;
                      const isActive = form.accountType === type.key;

                      return (
                        <button
                          key={type.key}
                          type="button"
                          onClick={() => setForm({ ...form, accountType: type.key })}
                          className={cn(
                            "relative rounded-xl border p-4 text-left transition-all duration-200 hover:-translate-y-[1px] hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20",
                            isActive
                              ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                              : "border-border bg-background/50"
                          )}
                        >
                          <div
                            className={cn(
                              "absolute right-3 top-3 h-4 w-4 rounded-full border transition-colors",
                              isActive ? "border-primary bg-primary" : "border-border"
                            )}
                          />

                          <div
                            className={cn(
                              "mb-3 flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                              isActive ? "bg-primary text-primary-foreground dark:text-black" : "bg-muted text-muted-foreground"
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </div>

                          <p className="text-sm font-semibold text-foreground">{type.label}</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">{type.desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {form.accountType === "team" && (
                  <div className="space-y-4 rounded-xl border border-border/70 bg-muted/20 p-5 backdrop-blur-sm">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Workspace name</label>
                      <input
                        placeholder="e.g. Acme Corp Design"
                        value={form.workspaceName}
                        onChange={(e) => setForm({ ...form, workspaceName: e.target.value })}
                        className="w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Workspace description <span className="text-muted-foreground font-normal">(Optional)</span></label>
                      <textarea
                        placeholder="What is this workspace for?"
                        value={form.workspaceDesc}
                        onChange={(e) => setForm({ ...form, workspaceDesc: e.target.value })}
                        className="min-h-[80px] w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-y"
                      />
                    </div>
                  </div>
                )}

                

                {(error || authError) && (
                  <div className="rounded-xl bg-destructive/10 px-3 py-2.5 text-sm font-medium text-destructive">
                    {error || authError}
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={disabled}
                    className="group flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 focus:ring-offset-background active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoadingAuth ? "Creating account..." : "Create account"}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>

                <div className="text-center text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <button
                    onClick={() => navigate("/auth")}
                    className="font-medium text-primary hover:underline focus:outline-none"
                  >
                    Sign in
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
