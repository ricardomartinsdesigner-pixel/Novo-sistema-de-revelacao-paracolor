// Capture the browser prompt before React hydrates so it can be opened on a tap.
window.addEventListener("beforeinstallprompt", (event) => {
  if (!/Android/i.test(navigator.userAgent)) return;
  event.preventDefault();
  window.paracolorInstallPrompt = event;
});
