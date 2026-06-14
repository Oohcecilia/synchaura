import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useNavigate } from "react-router-dom";
import { API_URL } from "@/api/client";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Sparkles, ShieldCheck, Users } from "lucide-react";

const LOGIN_BENEFITS = [
  {
    title: "Team-first sign in",
    description: "Use one secure password to unlock your workspace, tasks, and collaboration history.",
    icon: ShieldCheck,
  },
  {
    title: "Fast Google access",
    description: "Continue with Google for a quick onboarding path without losing offline-first support.",
    icon: Sparkles,
  },
  {
    title: "Built for collaboration",
    description: "Stay in sync with teammates across tasks, comments, calendars, and notifications.",
    icon: Users,
  },
];

export default function Auth() {
  const {
    login,
    authError,
    setAuthError,
    isAuthenticated,
    isLoadingAuth,
  } = useAuth();
  const navigate = useNavigate();

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkedInitialAuth, setCheckedInitialAuth] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "light";
    document.documentElement.classList.toggle("dark", savedTheme === "dark");

    setAuthError(null);
  }, [setAuthError]);

  useEffect(() => {
    if (checkedInitialAuth) return;

    if (!isLoadingAuth && isAuthenticated) {
      navigate("/", { replace: true });
    }
    setCheckedInitialAuth(true);
  }, [checkedInitialAuth, isAuthenticated, isLoadingAuth, navigate]);

  const passwordScore = useMemo(() => {
    let score = 0;
    if (!password) return score;
    if (password.length >= 6) score += 1;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^a-zA-Z0-9]/.test(password)) score += 1;
    return Math.max(1, score); // Base score of 1 if typing
  }, [password]);

  const passwordLabel = useMemo(() => {
    if (!password) return "None";
    if (passwordScore === 1) return "Weak";
    if (passwordScore === 2) return "Fair";
    if (passwordScore === 3) return "Strong";
    return "Excellent";
  }, [password, passwordScore]);

  const handleGoogleAuth = () => {
    if (submitting || isLoadingAuth) return;

    if (!navigator.onLine) {
      setError("Google sign-in requires an internet connection");
      return;
    }

    window.location.assign(`${API_URL}/auth/google/start?flow=login`);
  };

  const handleSubmit = async () => {
    if (submitting || isLoadingAuth) return;

    setError("");

    if (!phone.trim()) {
      setError("Please enter your email or phone number");
      return;
    }

    if (password.length < 1) {
      setError("Please enter your password");
      return;
    }

    try {
      setSubmitting(true);
      const result = await login({ phone, password });
      navigate(result?.mustChangePassword ? "/settings" : "/", { replace: true });
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  const disabled = submitting || isLoadingAuth;

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground transition-colors selection:bg-primary/20">
      {/* Refined Background Gradients */}
      <div className="pointer-events-none absolute inset-0 opacity-40 mix-blend-multiply dark:opacity-20 dark:mix-blend-screen">
        <div className="absolute -left-[10%] -top-[10%] h-[40rem] w-[40rem] rounded-full bg-primary/10 blur-[100px]" />
        <div className="absolute right-[0%] top-[20%] h-[30rem] w-[30rem] rounded-full bg-muted-foreground/10 blur-[100px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center p-4 sm:p-8">
        <div className="grid w-full max-w-5xl gap-12 lg:grid-cols-[1fr_400px] xl:gap-20 items-center">
          
          {/* Left Column: Context & Benefits */}
          <section className="hidden lg:flex flex-col space-y-10">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2.5 rounded-full border border-border/50 bg-muted/30 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm">
                <div className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/60 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary"></span>
                </div>
                Secure Workspace Authentication
              </div>

              <h1 className="text-4xl font-semibold tracking-tight text-foreground xl:text-5xl/tight">
                Your team's work, securely synced and accessible.
              </h1>
              <p className="max-w-md text-base leading-relaxed text-muted-foreground">
                Sign in to seamlessly resume your tasks, manage calendars, and collaborate without losing access to our offline-first architecture.
              </p>
            </div>

            <div className="space-y-6 pt-4 border-t border-border/40">
              {LOGIN_BENEFITS.map((item) => {
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

          {/* Right Column: Authentication Form */}
          <section className="w-full max-w-md mx-auto">
            <div className="rounded-3xl border border-border/60 bg-card/50 p-6 shadow-2xl shadow-primary/5 backdrop-blur-xl sm:p-10 dark:bg-card/40">
              
              <div className="mb-8 text-center sm:text-left">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary sm:hidden">
                  <LockKeyhole className="h-6 w-6" />
                </div>
                <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
                <p className="mt-1 text-sm text-muted-foreground">Log in to your workspace</p>
              </div>

              <div className="space-y-5">
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
                  Continue with Google
                </button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border/60"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card/50 px-3 text-muted-foreground backdrop-blur-xl">Or continue with</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Email or phone number</label>
                    <input
                      placeholder="Email or phone number"
                      value={phone}
                      disabled={disabled}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        setError("");
                      }}
                      className="w-full rounded-xl border border-border bg-background/50 px-3 py-2.5 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-foreground">Password</label>
                    </div>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••••••"
                        value={password}
                        disabled={disabled}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setError("");
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSubmit();
                        }}
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
                    {/* {password && (
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
                          <span className="text-muted-foreground">6+ characters</span>
                        </div>
                      </div>
                    )} */}
                  </div>
                </div>

                {error || authError ? (
                  <div className="rounded-xl bg-destructive/10 px-3 py-2.5 text-sm font-medium text-destructive">
                    {error || authError}
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={disabled}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 focus:ring-offset-background active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting || isLoadingAuth ? "Signing in..." : "Continue"}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </button>

                <div className="text-center text-sm text-muted-foreground">
                  Don't have an account?{" "}
                  <button
                    onClick={() => !disabled && navigate("/register")}
                    className="font-medium text-primary hover:underline focus:outline-none"
                  >
                    Sign up
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
