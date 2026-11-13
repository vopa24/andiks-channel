// Shared UI helpers
import { CAFE } from "./firebase-config.js";
import { isDemo } from "./store.js";

export const $ = (sel, root = document) => root.querySelector(sel);

export function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export function timeLabel(ms) {
  if (!ms) return "";
  return new Intl.DateTimeFormat("en-MY", { timeZone: CAFE.timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(ms));
}

export function backAtLabel(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(2000, 0, 1, h, m);
  return d.toLocaleTimeString("en-MY", { hour: "numeric", minute: "2-digit" });
}

export function initials(name) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

const HUES = [12, 28, 42, 150, 190, 210, 262, 320];
export function hueFor(name) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return HUES[h % HUES.length];
}

export function toast(msg, kind = "ok") {
  let box = $("#toasts");
  if (!box) { box = document.createElement("div"); box.id = "toasts"; document.body.appendChild(box); }
  const t = document.createElement("div");
  t.className = `toast toast-${kind}`; t.textContent = msg;
  box.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 2600);
}

export function demoBanner() {
  if (!isDemo) return;
  const b = document.createElement("div");
  b.className = "demo-banner";
  b.innerHTML = `<span>Demo mode</span> Data is saved on this device only. Add your Firebase config to go live.`;
  document.body.prepend(b);
}

export function registerSW() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
  }
}

export function setupInstall(btn) {
  let evt = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); evt = e; btn.hidden = false; });
  btn.addEventListener("click", async () => { if (!evt) return; evt.prompt(); await evt.userChoice; evt = null; btn.hidden = true; });
}
