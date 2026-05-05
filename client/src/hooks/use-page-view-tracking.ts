import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

export function usePageViewTracking() {
  const location = useLocation();
  const lastSentRef = useRef<string | null>(null);

  useEffect(() => {
    const path = location.pathname + location.search;
    if (lastSentRef.current === path) return;
    lastSentRef.current = path;

    const body = JSON.stringify({
      path: location.pathname,
      referer: document.referrer || null,
    });

    try {
      if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
        const blob = new Blob([body], { type: "application/json" });
        const ok = navigator.sendBeacon("/api/_pv", blob);
        if (ok) return;
      }
    } catch {
    }

    fetch("/api/_pv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      credentials: "include",
      keepalive: true,
    }).catch(() => {
    });
  }, [location.pathname, location.search]);
}
