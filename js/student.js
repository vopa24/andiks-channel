// US02 (today's food + stock) and US04 (opening hours + current status)
import { getStore, todayKey } from "./store.js";
import { CAFE } from "./firebase-config.js";
import { $, esc, timeLabel, backAtLabel, demoBanner, registerSW, setupInstall, getCart, setCart, cartCount, foodPic, toast } from "./ui.js";

demoBanner();
registerSW();
setupInstall($("#install-btn"));
$("#cafe-line").textContent = `${CAFE.name} · ${CAFE.location}`;

const STATUS = {
  open:   { cls: "status-open",   badge: "Open now",     title: "Cafe is open" },
  prayer: { cls: "status-prayer", badge: "Prayer break", title: "On prayer break" },
  closed: { cls: "status-closed", badge: "Closed",       title: "Cafe is closed now" }
};

function renderStatus(s) {
  const card = $("#status-card");
  const badge = $("#status-badge");
  card.className = "status-card";
  // A status only counts for the day it was set, so yesterday's status is never shown as live
  const setToday = s && s.updatedAt && todayKey(new Date(s.updatedAt)) === todayKey();
  if (!s || !STATUS[s.state] || !setToday) {
    // US04 AC3: no status set yet, show normal opening hours only
    card.classList.add("status-none");
    badge.hidden = true;
    $("#status-title").textContent = `Opening hours ${CAFE.hours}`;
    $("#status-meta").textContent = "Live status not set yet today";
    return;
  }
  const cfg = STATUS[s.state];
  card.classList.add(cfg.cls);
  badge.textContent = cfg.badge; badge.hidden = false;
  $("#status-title").textContent = s.state === "prayer" && s.backAt ? `Back at ${backAtLabel(s.backAt)}` : cfg.title;
  const upd = s.updatedAt ? ` · updated ${timeLabel(s.updatedAt)}` : "";
  $("#status-meta").textContent = `Opening hours ${CAFE.hours}${upd}`;
}

function stockLabel(stock) {
  if (stock <= 0) return `<span class="food-stock">0 left</span>`;
  return `<span class="food-stock ${stock <= 5 ? "low" : ""}">Available • ${stock} left</span>`;
}

let user = null, menu = [], openId = null;

function renderMenu(items) {
  menu = items;
  if (openId) renderSheet();
  const list = $("#menu-list");
  if (!items.length) {
    // US02 AC4
    list.innerHTML = `
      <div class="empty">
        <div class="empty-plate" aria-hidden="true"></div>
        <p class="empty-title">Menu not updated yet today</p>
        <p class="empty-sub">The cafe staff will post today's food soon. Check back later.</p>
      </div>`;
    $("#menu-updated").textContent = "";
    return;
  }
  items.sort((a, b) => (b.stock > 0) - (a.stock > 0) || a.name.localeCompare(b.name));
  list.innerHTML = items.map((it) => `
    <button type="button" class="food ${it.stock <= 0 ? "sold" : ""}" data-id="${esc(it.id)}" aria-label="${esc(it.name)}, see details">
      <div class="food-top">
        ${stockLabel(it.stock)}
        <div class="avatar">${foodPic(it)}${it.stock <= 0 ? `<span class="sold-tag">SOLD OUT</span>` : ""}</div>
      </div>
      <div class="food-body"><h3>${esc(it.name)}</h3>${it.desc ? `<p class="food-desc">${esc(it.desc)}</p>` : ""}</div>
    </button>`).join("");
  const last = Math.max(...items.map((i) => i.updatedAt || 0));
  $("#menu-updated").textContent = last ? `Updated ${timeLabel(last)}` : ""; // US02 AC3
}

// Food details sheet: photo, description, and add to cart
function openSheet(id) { openId = id; renderSheet(); $("#food-sheet").hidden = false; document.body.classList.add("no-scroll"); }
function closeSheet() { openId = null; $("#food-sheet").hidden = true; document.body.classList.remove("no-scroll"); }
let pickQty = 1;
function renderSheet() {
  const it = menu.find((m) => m.id === openId);
  if (!it) { closeSheet(); return; }
  $("#fs-pic").innerHTML = foodPic(it, "big");
  $("#fs-name").textContent = it.name;
  $("#fs-stock").innerHTML = stockLabel(it.stock);
  $("#fs-desc").textContent = it.desc || "No description yet.";
  $("#fs-desc").classList.toggle("muted-desc", !it.desc);
  const box = $("#fs-actions");
  if (it.stock <= 0) { box.innerHTML = `<p class="sheet-note">Sold out today.</p>`; return; }
  if (!user) {
    box.innerHTML = `<p class="sheet-note">Log in to reserve this food.</p>
      <div class="two-btns"><a class="btn btn-light" href="account.html#login">Log in</a><a class="btn btn-primary" href="account.html#signup">Sign up</a></div>`;
    return;
  }
  if (user.isStaff) {
    box.innerHTML = `<p class="sheet-note">You are logged in as staff, so you can't reserve. To test as a student, use another phone or a private window and log in with a student account.</p>`;
    return;
  }
  const inCart = getCart()[it.id] || 0;
  const room = Math.max(0, it.stock - inCart);
  if (!room) { box.innerHTML = `<p class="sheet-note">You already have all ${it.stock} in your cart.</p><a class="btn btn-primary" href="cart.html">Go to cart</a>`; return; }
  pickQty = Math.min(Math.max(1, pickQty), room);
  box.innerHTML = `
    ${inCart ? `<p class="sheet-note">${inCart} already in your cart.</p>` : ""}
    <div class="qty-row">
      <div class="stepper"><button class="step" data-q="-1" aria-label="Less">−</button><span class="qty-val" id="fs-qty">${pickQty}</span><button class="step" data-q="1" aria-label="More">+</button></div>
      <button class="btn btn-primary" id="fs-add">Add to cart</button>
    </div>`;
}

getStore().then((store) => {
  // Header and footer change with who is logged in
  store.onAuth((u) => {
    user = u;
    const customer = u && !u.isStaff;
    $("#login-link").hidden = !!u; $("#signup-link").hidden = !!u;
    const acc = $("#account-link"); acc.hidden = !u;
    if (u) { acc.textContent = u.isStaff ? "Staff page" : "My account"; acc.href = u.isStaff ? "staff.html" : "account.html"; }
    $("#staff-link").hidden = !!customer; // a logged-in student does not need the staff login
    updateCartBar();
    if (openId) renderSheet();
  });

  store.onStatus(renderStatus);
  store.onTodayItems(renderMenu);
});

function updateCartBar() {
  const n = cartCount();
  $("#cart-bar").hidden = !(user && !user.isStaff && n > 0);
  $("#cart-bar-count").textContent = n;
}
window.addEventListener("cartchange", updateCartBar);

$("#menu-list").addEventListener("click", (e) => { const c = e.target.closest(".food[data-id]"); if (c) { pickQty = 1; openSheet(c.dataset.id); } });
$("#fs-close").addEventListener("click", closeSheet);
$("#food-sheet").addEventListener("click", (e) => { if (e.target.id === "food-sheet") closeSheet(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && openId) closeSheet(); });
$("#fs-actions").addEventListener("click", (e) => {
  const q = e.target.closest("[data-q]");
  if (q) { pickQty += Number(q.dataset.q); renderSheet(); return; }
  if (e.target.closest("#fs-add")) {
    const it = menu.find((m) => m.id === openId); if (!it) return;
    const cart = getCart(); const now = cart[it.id] || 0;
    cart[it.id] = Math.min(it.stock, now + pickQty); setCart(cart);
    toast(`${pickQty} × ${it.name} added to cart`);
    closeSheet();
  }
});

getStore().catch(() => {
  $("#status-title").textContent = "Can't connect right now";
  $("#menu-list").innerHTML = `<div class="empty"><p class="empty-title">Can't load the menu</p><p class="empty-sub">Check your internet and refresh.</p></div>`;
});
