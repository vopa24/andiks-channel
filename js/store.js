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

// US10 (rider verification): check the rider form before saving
export function validateRider({ name, matric, phone, photo }) {
  if (!cleanName(name)) return "Please enter your full name.";
  if (!/^[A-Za-z0-9]{5,12}$/.test(String(matric || "").trim())) return "Please enter a valid matric number.";
  if (!/^\+?[0-9]{9,13}$/.test(String(phone || "").replace(/[\s-]/g, ""))) return "Please enter a valid phone number.";
  if (!photo) return "Please add a photo of your matric card.";
  return null;
}
// US06 (customer accounts): check the sign-up form before creating the account
export function validateCustomer({ name, phone, email, password }) {
  if (!cleanName(name)) return "Please enter your full name.";
  if (!/^\+?[0-9]{9,13}$/.test(String(phone || "").replace(/[\s-]/g, ""))) return "Please enter a valid phone number.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim())) return "Please enter a valid email.";
  if (String(password || "").length < 6) return "Password must be at least 6 characters.";
  return null;
}
// Food photo and description (added by staff)
export function validateItemDetails({ photo, desc }) {
  if (String(desc || "").length > 300) return "Description is too long (max 300 characters).";
  if (photo && photo.length > 300000) return "Photo is too big. Please choose another one.";
  return null;
}
export const RES_STATES = ["pending", "accepted", "rejected", "collected", "notcollected", "cancelled"];
function resError(msg) { const e = new Error(msg); e.code = "reservation/" + msg; e.userMessage = msg; return e; }
const RIDER_STATES = ["pending", "approved", "rejected"];

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
  // Demo accounts: staff use any email with the demo password, customers sign up on the account page
  function currentUser() {
    try {
      const v = localStorage.getItem(AUTH); if (!v) return null;
      if (v[0] !== "{") return { email: v, uid: v, isStaff: true }; // older demo sessions
      return JSON.parse(v);
    } catch (e) { return null; }
  }
  function setUser(u) { u ? localStorage.setItem(AUTH, JSON.stringify(u)) : localStorage.removeItem(AUTH); authSubs.forEach((fn) => fn(currentUser())); }
  const authError = (code) => { const e = new Error(code); e.code = code; return e; };

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
      const key = String(email || "").trim().toLowerCase();
      const c = (load().customers || {})[key];
      if (c) { if (c.password !== password) throw authError("auth/invalid-credential"); setUser({ email: key, uid: key, isStaff: false }); return; }
      if (!key || password !== DEMO_PASSWORD) throw authError("auth/invalid-credential");
      setUser({ email: key, uid: key, isStaff: true });
    },
    async logout() { setUser(null); },
    // Customer accounts (US06)
    async signUp({ name, phone, email, password }) {
      await new Promise((r) => setTimeout(r, 450));
      const d = load(); d.customers = d.customers || {};
      const key = String(email).trim().toLowerCase();
      if (d.customers[key]) throw authError("auth/email-already-in-use");
      d.customers[key] = { name, phone, email: key, password, createdAt: Date.now() }; save(d);
      setUser({ email: key, uid: key, isStaff: false });
    },
    onProfile(uid, cb) {
      return sub(() => { const c = (load().customers || {})[uid]; cb(c ? { name: c.name, phone: c.phone, email: c.email, createdAt: c.createdAt } : null); });
    },
    // Rider verification (US10)
    async submitRiderRequest({ name, matric, phone, photo }) {
      const d = load(); d.riders = d.riders || {};
      const id = "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      d.riders[id] = { name, matric, phone, photo, status: "pending", createdAt: Date.now() }; save(d);
      return id;
    },
    onRiderStatus(id, cb) { return sub(() => { const r = (load().riders || {})[id]; cb(r ? r.status : null); }); },
    onRiderRequests(cb) { return sub(() => cb(Object.entries(load().riders || {}).map(([id, v]) => ({ id, ...v })))); },
    async setRiderStatus(id, status) {
      const d = load(); if (!d.riders || !d.riders[id] || !RIDER_STATES.includes(status)) return;
      d.riders[id].status = status; save(d);
    },
    async deleteRiderRequest(id) { const d = load(); if (d.riders) { delete d.riders[id]; save(d); } },
    // Food photo and description
    async setItemDetails(id, { photo, desc }) {
      const d = load(); if (!d.items[id]) return;
      d.items[id] = { ...d.items[id], photo: photo || "", desc: desc || "", updatedAt: Date.now() }; save(d);
    },
    // Reservations: the customer reserves food from the cart, staff accept it (stock goes down)
    async createReservation({ uid, name, phone, items }) {
      const d = load(); d.reservations = d.reservations || {};
      const id = "v" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      d.reservations[id] = { uid, name, phone, items, count: items.reduce((a, i) => a + i.qty, 0), status: "pending", createdAt: Date.now() };
      save(d); return id;
    },
    onMyReservations(uid, cb) { return sub(() => cb(Object.entries(load().reservations || {}).filter(([, v]) => v.uid === uid).map(([id, v]) => ({ id, ...v })))); },
    onReservations(cb) {
      return sub(() => {
        const t = todayKey();
        cb(Object.entries(load().reservations || {}).filter(([, v]) => todayKey(new Date(v.createdAt)) === t).map(([id, v]) => ({ id, ...v })));
      });
    },
    async setReservationStatus(id, status) {
      const d = load(); const r = (d.reservations || {})[id]; if (!r || !RES_STATES.includes(status)) return;
      if (status === "accepted") {
        for (const it of r.items) {
          const item = d.items[it.id];
          if (!item || item.stock < it.qty) throw resError(`Not enough ${it.name} left. Reject it or update the stock first.`);
        }
        r.items.forEach((it) => { d.items[it.id].stock -= it.qty; d.items[it.id].updatedAt = Date.now(); });
      }
      if (status === "notcollected" && r.status === "accepted") {
        r.items.forEach((it) => { if (d.items[it.id]) { d.items[it.id].stock += it.qty; d.items[it.id].updatedAt = Date.now(); } });
      }
      r.status = status; r.updatedAt = Date.now(); save(d);
    },
    async cancelReservation(id) {
      const d = load(); const r = (d.reservations || {})[id];
      if (!r || r.status !== "pending") throw resError("This reservation can't be cancelled now.");
      r.status = "cancelled"; r.updatedAt = Date.now(); save(d);
    },
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
  const mapRes = (d) => ({ id: d.id, ...d.data(), createdAt: ms(d.data().createdAt), updatedAt: ms(d.data().updatedAt) });

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
    // Food photo and description (public, students see them)
    async setItemDetails(id, { photo, desc }) {
      await F.updateDoc(F.doc(db, "items", id), { photo: photo || "", desc: desc || "", updatedAt: F.serverTimestamp() });
    },
    // Reservations: the customer reserves from the cart; staff accept it and the stock goes down
    async createReservation({ uid, name, phone, items }) {
      const ref = await F.addDoc(F.collection(db, "reservations"), {
        uid, name, phone, items, count: items.reduce((a, i) => a + i.qty, 0), status: "pending", createdAt: F.serverTimestamp()
      });
      return ref.id;
    },
    onMyReservations(uid, cb) {
      const q = F.query(F.collection(db, "reservations"), F.where("uid", "==", uid));
      return F.onSnapshot(q, (snap) => cb(snap.docs.map(mapRes)), () => cb([]));
    },
    onReservations(cb) {
      const start = F.Timestamp.fromDate(new Date(`${todayKey()}T00:00:00+08:00`));
      const q = F.query(F.collection(db, "reservations"), F.where("createdAt", ">=", start));
      return F.onSnapshot(q, (snap) => cb(snap.docs.map(mapRes)), () => cb([]));
    },
    async setReservationStatus(id, status) {
      if (!RES_STATES.includes(status)) return;
      const rRef = F.doc(db, "reservations", id);
      await F.runTransaction(db, async (tx) => {
        const rs = await tx.get(rRef); if (!rs.exists()) throw resError("This reservation no longer exists.");
        const r = rs.data();
        const take = status === "accepted" && r.status === "pending";
        const give = status === "notcollected" && r.status === "accepted";
        if (take || give) {
          const refs = r.items.map((it) => F.doc(db, "items", it.id));
          const snaps = [];
          for (const ref of refs) snaps.push(await tx.get(ref));
          if (take) snaps.forEach((sn, i) => {
            if (!sn.exists() || sn.data().stock < r.items[i].qty) throw resError(`Not enough ${r.items[i].name} left. Reject it or update the stock first.`);
          });
          snaps.forEach((sn, i) => {
            if (!sn.exists()) return;
            tx.update(refs[i], { stock: sn.data().stock + (take ? -r.items[i].qty : r.items[i].qty), updatedAt: F.serverTimestamp() });
          });
        }
        tx.update(rRef, { status, updatedAt: F.serverTimestamp() });
      });
    },
    async cancelReservation(id) {
      await F.updateDoc(F.doc(db, "reservations", id), { status: "cancelled", updatedAt: F.serverTimestamp() });
    },
    // Rider verification (US10). The request (with the matric card photo) can only be read by staff.
    // The rider only reads a small status document, so the photo is never public.
    async submitRiderRequest({ name, matric, phone, photo }) {
      const ref = F.doc(F.collection(db, "riderRequests"));
      const batch = F.writeBatch(db);
      batch.set(ref, { name, matric, phone, photo, status: "pending", createdAt: F.serverTimestamp() });
      batch.set(F.doc(db, "riderStatus", ref.id), { status: "pending" });
      await batch.commit();
      return ref.id;
    },
    onRiderStatus(id, cb) {
      return F.onSnapshot(F.doc(db, "riderStatus", id), (s) => cb(s.exists() ? s.data().status : null), () => cb(null));
    },
    onRiderRequests(cb) {
      return F.onSnapshot(F.collection(db, "riderRequests"), (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: ms(d.data().createdAt) }))), () => cb([]));
    },
    async setRiderStatus(id, status) {
      if (!RIDER_STATES.includes(status)) return;
      const batch = F.writeBatch(db);
      batch.update(F.doc(db, "riderRequests", id), { status });
      batch.set(F.doc(db, "riderStatus", id), { status });
      await batch.commit();
    },
    async deleteRiderRequest(id) {
      const batch = F.writeBatch(db);
      batch.delete(F.doc(db, "riderRequests", id));
      batch.delete(F.doc(db, "riderStatus", id));
      await batch.commit();
    },
    // A logged-in account is staff only if it has a document in the "staff" collection (added by our team)
    onAuth(cb) {
      return A.onAuthStateChanged(auth, async (u) => {
        if (!u) { cb(null); return; }
        let isStaff = false;
        try { isStaff = (await F.getDoc(F.doc(db, "staff", u.uid))).exists(); } catch (e) { isStaff = false; }
        cb({ email: u.email, uid: u.uid, isStaff });
      });
    },
    async login(email, password) { await A.signInWithEmailAndPassword(auth, email, password); },
    async logout() { await A.signOut(auth); },
    // Customer accounts (US06): the account is in Firebase Authentication, the saved details in "customers"
    async signUp({ name, phone, email, password }) {
      const cred = await A.createUserWithEmailAndPassword(auth, email, password);
      await F.setDoc(F.doc(db, "customers", cred.user.uid), { name, phone, email: cred.user.email, createdAt: F.serverTimestamp() });
    },
    onProfile(uid, cb) {
      return F.onSnapshot(F.doc(db, "customers", uid), (s) => cb(s.exists() ? { ...s.data(), createdAt: ms(s.data().createdAt) } : null), () => cb(null));
    }
  };
}

let storePromise;
export function getStore() {
  if (!storePromise) storePromise = isDemo ? Promise.resolve(demoStore()) : firebaseStore();
  return storePromise;
}
