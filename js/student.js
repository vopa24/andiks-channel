// US02 (today's food + stock) and US04 (opening hours + current status)
import { getStore } from "./store.js";
import { CAFE } from "./firebase-config.js";
import { $, esc, timeLabel, backAtLabel, initials, hueFor, demoBanner, registerSW, setupInstall } from "./ui.js";

demoBanner();
registerSW();
setupInstall($("#install-btn"));
$("#cafe-line").textContent = `${CAFE.name} · ${CAFE.location}`;

const STATUS = {
  open:   { cls: "status-open",   title: "Open now" },
  prayer: { cls: "status-prayer", title: "Prayer break" },
  closed: { cls: "status-closed", title: "Closed now" }
};

function renderStatus(s) {
  const card = $("#status-card");
  card.className = "status-card";
  if (!s || !STATUS[s.state]) {
    // US04 AC3: no status set yet, show normal opening hours only
    card.classList.add("status-none");
    $("#status-title").textContent = `Opening hours ${CAFE.hours}`;
    $("#status-meta").textContent = "Live status not set yet today";
    return;
  }
  const cfg = STATUS[s.state];
  card.classList.add(cfg.cls);
  let title = cfg.title;
  if (s.state === "prayer" && s.backAt) title += ` · back at ${backAtLabel(s.backAt)}`;
  $("#status-title").textContent = title;
  const upd = s.updatedAt ? ` · updated ${timeLabel(s.updatedAt)}` : "";
  $("#status-meta").textContent = `Opening hours ${CAFE.hours}${upd}`;
}

function stockPill(stock) {
  if (stock <= 0) return `<span class="pill pill-out">Sold out</span>`;
  if (stock <= 5) return `<span class="pill pill-low">${stock} left</span>`;
  return `<span class="pill pill-ok">${stock} left</span>`;
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
      <div class="avatar" style="--h:${hueFor(it.name)}">${esc(initials(it.name))}</div>
      <div class="food-body">
        <h3>${esc(it.name)}</h3>
        ${stockPill(it.stock)}
      </div>
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
