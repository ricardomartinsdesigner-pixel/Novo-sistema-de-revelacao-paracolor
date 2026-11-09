import { useEffect, useState } from "react";

const CHOICE_KEY = "paracolor.install-app.v1";

function phonePlatform() {
  if (/Android/i.test(navigator.userAgent)) return "android";
  if (/iPhone|iPod|iPad/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "ios";
  return "";
}

function savedChoice() {
  try { return localStorage.getItem(CHOICE_KEY) || ""; }
  catch { return ""; }
}

function isInstalled() {
  return navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}

export function useInstallApp({ enabled, waitingForCoupon }) {
  const [platform, setPlatform] = useState("");
  const [choice, setChoice] = useState(null);
  const [inviteReady, setInviteReady] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [nativeReady, setNativeReady] = useState(false);

  function remember(value) {
    setChoice(value);
    try { localStorage.setItem(CHOICE_KEY, value); } catch { /* keep the current visit working */ }
  }

  useEffect(() => {
    setPlatform(phonePlatform());
    setChoice(isInstalled() ? "installed" : savedChoice());
    setNativeReady(Boolean(window.paracolorInstallPrompt));

    function onNativePrompt() { setNativeReady(Boolean(window.paracolorInstallPrompt)); }
    function onInstalled() {
      window.paracolorInstallPrompt = null;
      setNativeReady(false);
      setGuideOpen(false);
      remember("installed");
    }
    function onStorage(event) {
      if (event.key === CHOICE_KEY) setChoice(isInstalled() ? "installed" : savedChoice());
    }

    window.addEventListener("beforeinstallprompt", onNativePrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("beforeinstallprompt", onNativePrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const canInstall = enabled && Boolean(platform) && choice !== null && choice !== "installed";
  useEffect(() => {
    if (!canInstall || choice || waitingForCoupon) return undefined;
    const timer = setTimeout(() => setInviteReady(true), 1200);
    return () => clearTimeout(timer);
  }, [canInstall, choice, waitingForCoupon]);

  async function openInstall() {
    const prompt = platform === "android" ? window.paracolorInstallPrompt : null;
    remember("answered");
    if (prompt) {
      window.paracolorInstallPrompt = null;
      setNativeReady(false);
      setGuideOpen(false);
      try {
        const result = await prompt.prompt();
        if ((result?.outcome ?? (await prompt.userChoice)?.outcome) === "accepted") remember("installed");
        return;
      } catch { /* the browser can revoke the prompt, so offer the manual path */ }
    }
    setGuideOpen(true);
  }

  return {
    platform,
    canInstall,
    nativeReady,
    inviteOpen: canInstall && inviteReady && !choice && !waitingForCoupon,
    guideOpen: canInstall && guideOpen,
    openInstall,
    dismiss: () => remember("answered"),
    closeGuide: () => setGuideOpen(false),
  };
}
