"use client";

import { useEffect } from "react";

type CapacitorBridge = {
  isNativePlatform?: () => boolean;
};

export function PwaRuntime() {
  useEffect(() => {
    const bridge = (window as Window & { Capacitor?: CapacitorBridge }).Capacitor;
    const isNative = bridge?.isNativePlatform?.() === true;

    // Capacitor owns the native WebView lifecycle. Register the worker only for
    // the HTTPS/localhost PWA so native bridge injection can never be cached.
    if (isNative || !window.isSecureContext || !("serviceWorker" in navigator)) return;

    const register = () => {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // Along stays fully usable when a browser blocks service workers.
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
