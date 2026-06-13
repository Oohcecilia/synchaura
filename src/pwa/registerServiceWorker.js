export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return null;

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });

    registration.addEventListener("updatefound", () => {
      const nextWorker = registration.installing;
      if (!nextWorker) return;

      nextWorker.addEventListener("statechange", () => {
        if (nextWorker.state === "installed" && navigator.serviceWorker.controller) {
          window.dispatchEvent(new CustomEvent("synchaura:update-available"));
        }
      });
    });

    return registration;
  } catch (error) {
    console.warn("Service worker registration failed:", error);
    return null;
  }
}
