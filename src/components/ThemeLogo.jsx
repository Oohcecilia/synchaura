import { useEffect, useState } from "react";
import logo_dark from "@/assets/logo_dark.png";
import logo_light from "@/assets/logo_light.png";

const getThemeIsDark = () => {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
};

export default function ThemeLogo({ className, alt = "Synchaura" }) {
  const [isDark, setIsDark] = useState(getThemeIsDark);

  useEffect(() => {
    const syncTheme = () => setIsDark(getThemeIsDark());

    syncTheme();
    window.addEventListener("themechange", syncTheme);
    window.addEventListener("storage", syncTheme);

    const observer = new MutationObserver(syncTheme);
    if (typeof document !== "undefined" && document.documentElement) {
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
    }

    return () => {
      window.removeEventListener("themechange", syncTheme);
      window.removeEventListener("storage", syncTheme);
      observer.disconnect();
    };
  }, []);

  return (
    <img
      src={isDark ? logo_dark : logo_light}
      alt={alt}
      className={className}
    />
  );
}
