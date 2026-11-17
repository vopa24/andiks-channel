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

// Make a photo small enough to save, on the phone before sending (JPEG)
export function shrinkImage(file, { max = 1000, target = 450000, limit = 650000, quality = 0.72 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type || "image/")) { reject(new Error("not-image")); return; }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      let q = quality, m = max, out = "";
      for (let i = 0; i < 6; i++) {
        const scale = Math.min(1, m / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        out = c.toDataURL("image/jpeg", q);
        if (out.length <= target) break;
        m = Math.round(m * 0.8); q = Math.max(0.4, q - 0.08);
      }
      URL.revokeObjectURL(url);
      out.length <= limit ? resolve(out) : reject(new Error("too-big"));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("not-image")); };
    img.src = url;
  });
}

// Cart: saved on this phone only, as { itemId: quantity }
const CART_KEY = "andiks-cart";
export function getCart() {
  try { const c = JSON.parse(localStorage.getItem(CART_KEY) || "{}"); return c && typeof c === "object" ? c : {}; }
  catch (e) { return {}; }
}
export function setCart(cart) {
  const clean = {};
  Object.entries(cart || {}).forEach(([id, q]) => { const n = Math.floor(Number(q)); if (n > 0) clean[id] = Math.min(n, 50); });
  try { localStorage.setItem(CART_KEY, JSON.stringify(clean)); } catch (e) { /* ignore */ }
  window.dispatchEvent(new Event("cartchange"));
}
export function cartCount(cart = getCart()) { return Object.values(cart).reduce((a, b) => a + b, 0); }
window.addEventListener("storage", (e) => { if (e.key === CART_KEY) window.dispatchEvent(new Event("cartchange")); });

// Food picture: the photo if staff added one, otherwise the initials
export function foodPic(it, cls = "") {
  return it.photo
    ? `<img class="food-img ${cls}" src="${esc(it.photo)}" alt="">`
    : `<span class="food-initials ${cls}">${esc(initials(it.name))}</span>`;
}
