
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";

import pnf from "@/assets/page-not-found.gif"

export default function PageNotFound() {
  const location = useLocation();
  const navigate = useNavigate();
  const pageName = location.pathname.substring(1);

  const { user, isAuthenticated, isLoadingAuth } = useAuth();

  useEffect(() => {

    const savedTheme = localStorage.getItem("theme") || "light";

    const isDark = savedTheme === "dark";

    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  if (isLoadingAuth) return null;

  return (
    <section className="relative min-h-screen flex items-center justify-center 
  bg-white text-black dark:bg-black dark:text-white 
  px-6 py-10 overflow-hidden">

      {/* Background glow */}
      <div className="absolute inset-0 
      bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.05),transparent_70%)]
      dark:bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.06),transparent_70%)]
      pointer-events-none"
      />

      <div className="max-w-xl w-full text-center relative z-10">

        {/* 404 TEXT */}
        <div className="relative mb-6">
          <h1 className="text-[90px] md:text-[140px] font-extrabold tracking-tight 
          text-black dark:text-white">
            404
          </h1>

          {/* Stroke layer */}
          <h1 className="absolute inset-0 text-[90px] md:text-[140px] font-extrabold tracking-tight text-transparent stroke-text">
            404
          </h1>
        </div>

        {/* GIF Section */}
        <div className="relative w-full h-[260px] md:h-[340px] flex items-center justify-center 
  rounded-2xl overflow-hidden 
  border border-black/10 dark:border-white/10 
  shadow-lg bg-white">

          {/* GIF */}
          <img
            src={pnf}
            alt="404 animation"
            className="w-full h-full object-contain 
    scale-100 hover:scale-105 transition-transform duration-700 ease-out"
          />

          {/* Gradient overlay */}
          <div className="absolute inset-0 
    bg-gradient-to-t from-white/40 to-transparent 
    dark:from-black/50 dark:to-transparent 
    pointer-events-none"
          />
        </div>

        {/* Content */}
        <div className="-mt-8 space-y-5">

          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Looks like you're lost
          </h2>

          <p className="text-black/60 dark:text-white/60 max-w-md mx-auto leading-relaxed">
            Oops… looks like you took a wrong turn. This page isn’t here.
          </p>

          {/* Admin Note */}
          {isAuthenticated && user?.role === "admin" && (
            <div className="mt-6 p-4 
            border border-black/10 dark:border-white/10 
            bg-black/[0.03] dark:bg-white/[0.05] 
            rounded-xl text-left shadow-sm">
              <p className="text-sm font-medium text-black dark:text-white mb-1">
                Admin Note
              </p>
              <p className="text-sm text-black/60 dark:text-white/60">
                This page may not be implemented yet.
              </p>
            </div>
          )}

          {/* Button */}
          <div className="pt-6">
            <button
              onClick={() => navigate("/")}
              className="group inline-flex items-center gap-2 px-6 py-3 text-sm font-medium 
            border border-black/20 dark:border-white/20 
            rounded-lg 
            hover:bg-black hover:text-white 
            dark:hover:bg-white dark:hover:text-black
            transition-all duration-300 ease-out
            shadow-sm hover:shadow-md"
            >
              <svg
                className="w-4 h-4 transition-transform group-hover:-translate-x-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              Go Home
            </button>
          </div>

        </div>
      </div>

      {/* Stroke style (adaptive) */}
      <style jsx>{`
      .stroke-text {
        -webkit-text-stroke: 1px rgba(0, 0, 0, 0.2);
      }
      .dark .stroke-text {
        -webkit-text-stroke: 1px rgba(255, 255, 255, 0.2);
      }
    `}</style>

    </section>
  );
}