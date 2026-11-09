import { useEffect, useRef } from "react";
import { useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/AuthContext";

const VISITOR_KEY = "paracolor_site_visitor_id";

function visitorId() {
  try {
    let id = window.localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = window.crypto?.randomUUID?.();
      if (!id) {
        const bytes = new Uint8Array(16);
        window.crypto.getRandomValues(bytes);
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
        id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
      }
      window.localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

export default function SiteAnalyticsTracker() {
  const location = useLocation();
  const pathname = location.pathname;
  const { user, isLoadingAuth } = useAuth();
  const lastPageRef = useRef("");

  useEffect(() => {
    if (isLoadingAuth || (user?.role && user.role !== "user")) return undefined;
    const id = visitorId();
    if (!id) return undefined;

    const send = (pageView = false) => {
      void fetch("/api/analytics/visit", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ visitor_id: id, page_view: pageView }),
        keepalive: true,
      }).catch(() => {});
    };

    if (lastPageRef.current !== pathname) {
      lastPageRef.current = pathname;
      send(true);
    }
    const heartbeat = window.setInterval(() => {
      if (!document.hidden) send(false);
    }, 25_000);
    const onVisibility = () => {
      if (!document.hidden) send(false);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [isLoadingAuth, pathname, user?.role]);

  return null;
}
