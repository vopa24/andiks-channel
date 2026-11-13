// Data layer: Firebase (live) or localStorage (demo mode), same API for both.
import { firebaseConfig, CAFE, DEMO_PASSWORD } from "./firebase-config.js";

export const isDemo = !firebaseConfig.apiKey;

export function todayKey(d = new Date()) {
  // YYYY-MM-DD in Malaysia time
  return new Intl.DateTimeFormat("en-CA", { timeZone: CAFE.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export function cleanName(name) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

export function validateStock(value) {
  if (value === "" || value === null || value === undefined) return "Please enter a stock number.";
  const n = Number(value);
  if (!Number.isInteger(n)) return "Stock must be a whole number.";
  if (n < 0) return "Stock cannot be negative.";
  if (n > 999) return "Stock is too large.";
  return null;
}

/* ---------------- Demo mode (localStorage) ---------------- */
function demoStore() {
  const KEY = "andiks-demo-v1";
  const AUTH = "andiks-demo-auth";
  const listeners = new Set();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    const now = Date.now();
    const t = todayKey();
    const seed = {
      status: { state: "open", backAt: "", updatedAt: now },
      items: {
        a1: { name: "Nasi Ayam Buttermilk", stock: 15, onMenuDate: t, updatedAt: now },
        a2: { name: "Popia Big Mac", stock: 8, onMenuDate: t, updatedAt: now },
        a3: { name: "Roti Sardin", stock: 0, onMenuDate: t, updatedAt: now },
        a4: { name: "Maggi Goreng", stock: 12, onMenuDate: "", updatedAt: now }
      }
    };
    save(seed, false);
    return seed;
  }
  function save(data, notify = true) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
    if (notify) listeners.forEach((fn) => fn());
  }
  window.addEventListener("storage", (e) => { if (e.key === KEY) listeners.forEach((fn) => fn()); });

  function sub(fn) { listeners.add(fn); fn(); return () => listeners.delete(fn); }
  const authSubs = new Set();
  function currentUser() {
    try { const v = localStorage.getItem(AUTH); return v ? { email: v } : null; } catch (e) { return null; }
  }

  return {
    onStatus(cb) { return sub(() => cb(load().status || null)); },
    onTodayItems(cb) {
      return sub(() => {
        const d = load(); const t = todayKey();
        cb(Object.entries(d.items).filter(([, v]) => v.onMenuDate === t).map(([id, v]) => ({ id, ...v })));
      });
    },
    onAllItems(cb) { return sub(() => cb(Object.entries(load().items).map(([id, v]) => ({ id, ...v })))); },
    async setStatus(state, backAt) {
      const d = load(); d.status = { state, backAt: state === "prayer" ? (backAt || "") : "", updatedAt: Date.now() }; save(d);
    },
    async addItem(name, stock) {
      const d = load(); const t = todayKey();
      const existing = Object.entries(d.items).find(([, v]) => v.name.toLowerCase() === name.toLowerCase());
      const id = existing ? existing[0] : "i" + Date.now().toString(36);
      d.items[id] = { name, stock: Number(stock), onMenuDate: t, updatedAt: Date.now() }; save(d);
    },
    async setStock(id, stock) {
      const d = load(); if (!d.items[id]) return;
      d.items[id] = { ...d.items[id], stock: Number(stock), onMenuDate: todayKey(), updatedAt: Date.now() }; save(d);
    },
    async putOnToday(id) { const d = load(); if (d.items[id]) { d.items[id].onMenuDate = todayKey(); d.items[id].updatedAt = Date.now(); save(d); } },
    async removeFromToday(id) { const d = load(); if (d.items[id]) { d.items[id].onMenuDate = ""; d.items[id].updatedAt = Date.now(); save(d); } },
    onAuth(cb) { authSubs.add(cb); cb(currentUser()); return () => authSubs.delete(cb); },
    async login(email, password) {
      await new Promise((r) => setTimeout(r, 450));
      if (!email || password !== DEMO_PASSWORD) { const e = new Error("auth/invalid-credential"); e.code = "auth/invalid-credential"; throw e; }
      localStorage.setItem(AUTH, email); authSubs.forEach((fn) => fn(currentUser()));
    },
    async logout() { localStorage.removeItem(AUTH); authSubs.forEach((fn) => fn(null)); },
    resetDemo() { localStorage.removeItem(KEY); listeners.forEach((fn) => fn()); }
  };
}

/* ---------------- Live mode (Firebase) ---------------- */
async function firebaseStore() {
  const V = "10.12.2";
  const base = `https://www.gstatic.com/firebasejs/${V}`;
  const { initializeApp } = await import(`${base}/firebase-app.js`);
  const A = await import(`${base}/firebase-auth.js`);
  const F = await import(`${base}/firebase-firestore.js`);
  const app = initializeApp(firebaseConfig);
  const auth = A.getAuth(app);
  await A.setPersistence(auth, A.browserLocalPersistence);
  const db = F.getFirestore(app);
  const statusRef = F.doc(db, "cafe", "status");
  const itemsCol = F.collection(db, "items");
  const ms = (ts) => (ts && ts.toMillis ? ts.toMillis() : (typeof ts === "number" ? ts : Date.now()));
  const mapDoc = (s) => ({ id: s.id, ...s.data(), updatedAt: ms(s.data().updatedAt) });

  return {
    onStatus(cb) { return F.onSnapshot(statusRef, (s) => cb(s.exists() ? { ...s.data(), updatedAt: ms(s.data().updatedAt) } : null), () => cb(null)); },
    onTodayItems(cb) {
      const q = F.query(itemsCol, F.where("onMenuDate", "==", todayKey()));
      return F.onSnapshot(q, (snap) => cb(snap.docs.map(mapDoc)), () => cb([]));
    },
    onAllItems(cb) { return F.onSnapshot(itemsCol, (snap) => cb(snap.docs.map(mapDoc)), () => cb([])); },
    async setStatus(state, backAt) {
      await F.setDoc(statusRef, { state, backAt: state === "prayer" ? (backAt || "") : "", updatedAt: F.serverTimestamp() });
    },
    async addItem(name, stock) {
      const snap = await F.getDocs(F.query(itemsCol, F.where("nameLower", "==", name.toLowerCase())));
      const data = { name, nameLower: name.toLowerCase(), stock: Number(stock), onMenuDate: todayKey(), updatedAt: F.serverTimestamp() };
      if (!snap.empty) await F.updateDoc(snap.docs[0].ref, data); else await F.addDoc(itemsCol, data);
    },
    async setStock(id, stock) { await F.updateDoc(F.doc(db, "items", id), { stock: Number(stock), onMenuDate: todayKey(), updatedAt: F.serverTimestamp() }); },
    async putOnToday(id) { await F.updateDoc(F.doc(db, "items", id), { onMenuDate: todayKey(), updatedAt: F.serverTimestamp() }); },
    async removeFromToday(id) { await F.updateDoc(F.doc(db, "items", id), { onMenuDate: "", updatedAt: F.serverTimestamp() }); },
    onAuth(cb) { return A.onAuthStateChanged(auth, (u) => cb(u ? { email: u.email } : null)); },
    async login(email, password) { await A.signInWithEmailAndPassword(auth, email, password); },
    async logout() { await A.signOut(auth); }
  };
}

let storePromise;
export function getStore() {
  if (!storePromise) storePromise = isDemo ? Promise.resolve(demoStore()) : firebaseStore();
  return storePromise;
}
