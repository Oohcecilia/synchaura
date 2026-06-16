import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";

function decodeSession(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return JSON.parse(atob(padded));
}

export default function GoogleAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { completeOAuthSession, setAuthError } = useAuth();
  const [message, setMessage] = useState("Finishing Google sign-in...");

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const sessionParam = hashParams.get("session") || searchParams.get("session");

    if (!sessionParam) {
      setMessage("Missing Google session data.");
      return;
    }

    if (hashParams.has("session")) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    try {
      const payload = decodeSession(sessionParam);
      completeOAuthSession(payload);
      setMessage("Google sign-in complete.");

      window.setTimeout(() => {
        navigate(payload.is_new_user ? "/setup" : "/", { replace: true });
      }, 200);
    } catch (error) {
      const fallback = error?.message || "Google sign-in failed.";
      setAuthError(fallback);
      setMessage(fallback);

      window.setTimeout(() => {
        navigate("/auth", { replace: true });
      }, 1600);
    }
  }, [completeOAuthSession, navigate, searchParams, setAuthError]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted px-4 py-6">
      <div className="w-full max-w-sm bg-card/80 backdrop-blur-xl border border-border shadow-xl rounded-3xl p-6 text-center space-y-4">
        <div className="mx-auto w-10 h-10 border-4 border-muted border-t-primary rounded-full animate-spin" />
        <div>
          <h1 className="text-lg font-semibold">Google authentication</h1>
          <p className="text-sm text-muted-foreground mt-1">{message}</p>
        </div>
      </div>
    </div>
  );
}
