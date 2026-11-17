// Cart and reservation: the customer reserves food and picks it up at the cafe
import { getStore, todayKey } from "./store.js";
import { CAFE } from "./firebase-config.js";
import { $, esc, demoBanner, registerSW, getCart, setCart, cartCount, foodPic, toast } from "./ui.js";

demoBanner();
registerSW();
$("#pickup-note").textContent = `Pick up at ${CAFE.name}, ${CAFE.location}. Pay at the counter when you collect.`;

let store, user = null, profile = null, menu = [], status = null, sending = false;

function cartLines() {
  const cart = getCart();
  return Object.entries(cart).map(([id, qty]) => {
    const it = menu.find((m) => m.id === id);
    return { id, qty, it, ok: !!it && it.stock > 0 };
  });
}

function render() {
  if (!$("#done-box").hidden) return;
  const loggedIn = user && !user.isStaff;
  $("#need-login").hidden = !!loggedIn;
  $("#cart-box").hidden = !loggedIn;
  if (!loggedIn) return;

  // Keep the cart inside today's stock
  const cart = getCart(); let changed = false;
  cartLines().forEach((l) => { if (l.ok && l.qty > l.it.stock) { cart[l.id] = l.it.stock; changed = true; } });
  if (changed) { setCart(cart); return; }

  const lines = cartLines();
  const n = cartCount();
  $("#cart-count").textContent = n ? `${n} item${n > 1 ? "s" : ""}` : "";
  const list = $("#cart-list");
  if (!lines.length) {
    list.innerHTML = `<p class="muted">Your cart is empty. Tap a food on the menu to add it.</p>`;
    $("#cart-foot").hidden = true; return;
  }
  $("#cart-foot").hidden = false;
  list.innerHTML = lines.map((l) => {
    const name = l.it ? l.it.name : "Not on today's menu";
    return `
    <div class="cart-row ${l.ok ? "" : "off"}" data-id="${esc(l.id)}">
      <div class="cart-pic">${l.it ? foodPic(l.it) : ""}</div>
      <div class="cart-info">
        <span class="cart-name">${esc(name)}</span>
        <span class="cart-meta">${l.ok ? `${l.it.stock} left today` : "Not available, remove it"}</span>
      </div>
      <div class="stepper sm-step">
        <button class="step" data-act="dec" aria-label="Less" ${l.ok ? "" : "disabled"}>−</button>
        <span class="qty-val">${l.qty}</span>
        <button class="step" data-act="inc" aria-label="More" ${l.ok && l.qty < l.it.stock ? "" : "disabled"}>+</button>
      </div>
      <button class="icon-btn" data-act="remove" aria-label="Remove ${esc(name)}">✕</button>
    </div>`;
  }).join("");
  const bad = lines.some((l) => !l.ok);
  const closed = status && status.state === "closed" && status.updatedAt && todayKey(new Date(status.updatedAt)) === todayKey();
  const btn = $("#reserve-btn");
  btn.disabled = bad || closed || sending;
  btn.textContent = closed ? "Cafe is closed now" : bad ? "Remove unavailable food first" : sending ? "Sending…" : `Reserve ${n} item${n > 1 ? "s" : ""}`;
}

getStore().then((s) => {
  store = s;
  let stopProfile = null;
  store.onAuth((u) => {
    user = u;
    if (u && u.isStaff) { location.replace("staff.html"); return; }
    if (stopProfile) { stopProfile(); stopProfile = null; }
    profile = null;
    if (u) stopProfile = store.onProfile(u.uid, (p) => { profile = p; });
    render();
  });
  store.onTodayItems((items) => { menu = items; render(); });
  store.onStatus((st) => { status = st; render(); });
});
window.addEventListener("cartchange", render);

$("#cart-list").addEventListener("click", (e) => {
  const btn = e.target.closest("button"); if (!btn) return;
  const id = btn.closest(".cart-row").dataset.id;
  const cart = getCart();
  if (btn.dataset.act === "inc") cart[id] = (cart[id] || 0) + 1;
  if (btn.dataset.act === "dec") cart[id] = (cart[id] || 0) - 1;
  if (btn.dataset.act === "remove") delete cart[id];
  setCart(cart);
});

$("#reserve-btn").addEventListener("click", async () => {
  const err = $("#cart-error"); err.hidden = true;
  if (!profile) { err.textContent = "Your account details are missing. Please log out and create your account again."; err.hidden = false; return; }
  const items = cartLines().filter((l) => l.ok).map((l) => ({ id: l.id, name: l.it.name, qty: l.qty }));
  if (!items.length) return;
  sending = true; render();
  try {
    await store.createReservation({ uid: user.uid, name: profile.name, phone: profile.phone, items });
    setCart({});
    $("#cart-box").hidden = true; $("#done-box").hidden = false;
    toast("Reservation sent");
  } catch (ex) {
    err.textContent = "Couldn't send your reservation. Check your connection and try again."; err.hidden = false;
  } finally { sending = false; render(); }
});
