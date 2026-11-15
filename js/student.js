// US02 (today's food + stock) and US04 (opening hours + current status)
import { getStore } from "./store.js";
import { CAFE } from "./firebase-config.js";
import { $, esc, timeLabel, backAtLabel, initials, demoBanner, registerSW, setupInstall } from "./ui.js";

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
  if (!s || !STATUS[s.state]) {
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

function renderMenu(items) {
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
    <article class="food ${it.stock <= 0 ? "sold" : ""}">
      <div class="food-top">
        ${stockLabel(it.stock)}
        <div class="avatar">${esc(initials(it.name))}${it.stock <= 0 ? `<span class="sold-tag">SOLD OUT</span>` : ""}</div>
      </div>
      <div class="food-body"><h3>${esc(it.name)}</h3></div>
    </article>`).join("");
  const last = Math.max(...items.map((i) => i.updatedAt || 0));
  $("#menu-updated").textContent = last ? `Updated ${timeLabel(last)}` : ""; // US02 AC3
}

getStore().then((store) => {
  store.onStatus(renderStatus);
  store.onTodayItems(renderMenu);
}).catch(() => {
  $("#status-title").textContent = "Can't connect right now";
  $("#menu-list").innerHTML = `<div class="empty"><p class="empty-title">Can't load the menu</p><p class="empty-sub">Check your internet and refresh.</p></div>`;
});
