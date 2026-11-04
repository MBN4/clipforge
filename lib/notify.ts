"use client";

export function requestNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}

export function notifyJobDone(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if (document.visibilityState === "visible") return; // in-page toast covers this case
  try {
    new Notification(title, { body, icon: "/favicon.ico" });
  } catch {
    // ignore — some browsers (e.g. iOS Safari) don't support this
  }
}
