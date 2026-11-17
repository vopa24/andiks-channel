// US01 (update food + stock) and US03 (set cafe status). US05: page needs login.
import { getStore, cleanName, validateStock, todayKey, validateItemDetails } from "./store.js";
import { $, esc, timeLabel, toast, demoBanner, registerSW, foodPic, shrinkImage } from "./ui.js";

registerSW();

let store, selected = "open", allItems = [], todayItems = [];

function selectState(state) {
  selected = state;
  document.querySelectorAll(".seg").forEach((b) => {
    const on = b.dataset.state === state;
    b.classList.toggle("active", on); b.setAttribute("aria-checked", on);
  });
  $("#back-row").hidden = state !== "prayer";
}

function renderStatus(s) {
  const setToday = s && s.updatedAt && todayKey(new Date(s.updatedAt)) === todayKey();
  if (s && s.state && setToday) {
    selectState(s.state);
    $("#back-at").value = s.backAt || "";
    $("#status-updated").textContent = s.updatedAt ? `Saved ${timeLabel(s.updatedAt)}` : "";
  } else {
    $("#status-updated").textContent = "Not set yet today";
  }
}

function renderToday(items) {
  todayItems = items;
  items.sort((a, b) => a.name.localeCompare(b.name));
  $("#count").textContent = items.length ? `${items.length} item${items.length > 1 ? "s" : ""}` : "";
  const list = $("#staff-list");
  if (!items.length) {
    list.innerHTML = `<p class="muted">No food on today's menu yet. Add food below so students can see it.</p>`;
    return;
  }
  list.innerHTML = items.map((it) => `
    <div class="stock-row ${it.stock <= 0 ? "sold" : ""}" data-id="${it.id}">
      <button class="avatar sm" data-act="edit" aria-label="Photo and description of ${esc(it.name)}">${foodPic(it)}</button>
      <div class="stock-name">
        <span>${esc(it.name)}</span>
        ${it.stock <= 0 ? `<span class="pill pill-out">Sold out</span>` : ""}
        <button class="link-btn" data-act="edit">${it.photo || it.desc ? "Edit photo / description" : "+ Add photo / description"}</button>
      </div>
      <div class="stepper">
        <button class="step" data-act="dec" aria-label="Decrease stock of ${esc(it.name)}">−</button>
        <input class="step-input" type="number" inputmode="numeric" min="0" step="1" value="${it.stock}" aria-label="Stock of ${esc(it.name)}">
        <button class="step" data-act="inc" aria-label="Increase stock of ${esc(it.name)}">+</button>
      </div>
      <button class="icon-btn" data-act="remove" title="Remove from today" aria-label="Remove ${esc(it.name)} from today">✕</button>
    </div>`).join("");
}

function renderPrevious() {
  const t = todayKey();
  const prev = allItems.filter((i) => i.onMenuDate !== t).sort((a, b) => a.name.localeCompare(b.name));
  $("#previous-wrap").hidden = !prev.length;
  $("#previous").innerHTML = prev.map((i) => `<button class="chip" data-id="${i.id}">+ ${esc(i.name)}</button>`).join("");
}

// US10: staff check the matric card photo, then approve or reject the rider
const RIDER_PILL = { pending: ["Waiting", "pill-wait"], approved: ["Approved", "pill-ok"], rejected: ["Rejected", "pill-out"] };
function renderRiders(list) {
  const order = { pending: 0, approved: 1, rejected: 2 };
  list.sort((a, b) => (order[a.status] - order[b.status]) || (b.createdAt - a.createdAt));
  const waiting = list.filter((r) => r.status === "pending").length;
  $("#rider-count").textContent = waiting ? `${waiting} waiting` : "";
  const box = $("#rider-list");
  if (!list.length) { box.innerHTML = `<p class="muted">No rider requests yet.</p>`; return; }
  box.innerHTML = list.map((r) => {
    const [label, cls] = RIDER_PILL[r.status] || RIDER_PILL.pending;
    return `
    <div class="rider-row" data-id="${esc(r.id)}">
      <button class="rider-photo" data-act="photo" aria-label="Open matric card photo of ${esc(r.name)}"><img src="${esc(r.photo)}" alt=""></button>
      <div class="rider-info">
        <span class="rider-name">${esc(r.name)} <span class="pill ${cls}">${label}</span></span>
        <span class="rider-meta">${esc(r.matric)} · ${esc(r.phone)}</span>
        <span class="rider-meta">Sent ${esc(timeLabel(r.createdAt))}</span>
      </div>
      <div class="rider-actions">
        ${r.status === "pending"
          ? `<button class="mini-btn mini-ok" data-act="approve">Approve</button><button class="mini-btn mini-no" data-act="reject">Reject</button>`
          : `<button class="mini-btn" data-act="delete">Delete</button>`}
      </div>
    </div>`;
  }).join("");
}

// Food photo and description editor
let editId = null, editPhoto = "";
function openEditor(id) {
  const it = allItems.find((i) => i.id === id) || todayItems.find((i) => i.id === id); if (!it) return;
  editId = id; editPhoto = it.photo || "";
  $("#ed-title").textContent = it.name;
  $("#ed-desc").value = it.desc || ""; $("#ed-count").textContent = `${($("#ed-desc").value).length} / 300`;
  $("#ed-error").hidden = true;
  showEditPic(it.name);
  $("#edit-sheet").hidden = false; document.body.classList.add("no-scroll");
}
function showEditPic(name) {
  $("#ed-pic").innerHTML = foodPic({ name: name || $("#ed-title").textContent, photo: editPhoto }, "big");
  $("#ed-photo-btn").textContent = editPhoto ? "Change photo" : "Add photo";
  $("#ed-remove").hidden = !editPhoto;
}
function closeEditor() { editId = null; $("#edit-sheet").hidden = true; document.body.classList.remove("no-scroll"); $("#edit-form").reset(); }

// Reservations: accept (stock goes down), reject, then collected or not collected (stock comes back)
const RES_PILL = {
  pending: ["New", "pill-wait"], accepted: ["Accepted", "pill-ok"], rejected: ["Rejected", "pill-out"],
  collected: ["Collected", "pill-done"], notcollected: ["Not collected", "pill-out"], cancelled: ["Cancelled by customer", "pill-done"]
};
function renderReservations(list) {
  const order = { pending: 0, accepted: 1 };
  list.sort((a, b) => ((order[a.status] ?? 2) - (order[b.status] ?? 2)) || ((a.createdAt || 0) - (b.createdAt || 0)));
  const waiting = list.filter((r) => r.status === "pending").length;
  $("#res-count").textContent = waiting ? `${waiting} new` : "";
  const box = $("#res-list");
  if (!list.length) { box.innerHTML = `<p class="muted">No reservations today yet.</p>`; return; }
  box.innerHTML = list.map((r) => {
    const [label, cls] = RES_PILL[r.status] || RES_PILL.pending;
    const actions = r.status === "pending"
      ? `<button class="mini-btn mini-ok" data-act="accepted">Accept</button><button class="mini-btn mini-no" data-act="rejected">Reject</button>`
      : r.status === "accepted"
        ? `<button class="mini-btn mini-ok" data-act="collected">Collected</button><button class="mini-btn" data-act="notcollected">Not collected</button>`
        : "";
    return `
    <div class="res-row ${r.status}" data-id="${esc(r.id)}">
      <div class="res-top"><span class="rider-name">${esc(r.name)}</span><span class="pill ${cls}">${label}</span></div>
      <span class="rider-meta">${esc(r.phone)} · ${esc(timeLabel(r.createdAt))}</span>
      <ul class="res-items">${(r.items || []).map((i) => `<li>${i.qty} × ${esc(i.name)}</li>`).join("")}</ul>
      ${actions ? `<div class="rider-actions">${actions}</div>` : ""}
    </div>`;
  }).join("");
}

async function saveStock(id, value, row) {
  const err = validateStock(value);
  if (err) { toast(err, "err"); renderToday(todayItems); return false; } // US01 AC4: not saved, old value restored
  row && row.classList.add("saving");
  try { await store.setStock(id, Number(value)); }
  catch (e) { toast("Couldn't save. Check your connection.", "err"); }
  finally { row && row.classList.remove("saving"); }
  return true;
}

getStore().then((s) => {
  store = s;
  store.onAuth((user) => {
    // US05 AC4: staff page without login goes to the login page
    if (!user) { location.replace("login.html"); return; }
    if (!user.isStaff) { location.replace("account.html"); return; } // customers cannot open the staff page
    if (document.body.hidden) { document.body.hidden = false; demoBanner(); }
    $("#who").textContent = `Logged in as ${user.email}`;
  });

  store.onStatus(renderStatus);
  store.onTodayItems(renderToday);
  store.onAllItems((items) => { allItems = items; renderPrevious(); });

  store.onReservations(renderReservations);
  $("#res-list").addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]"); if (!btn) return;
    const id = btn.closest(".res-row").dataset.id; const status = btn.dataset.act;
    btn.disabled = true;
    try {
      await store.setReservationStatus(id, status);
      toast({ accepted: "Accepted. Stock updated.", rejected: "Reservation rejected", collected: "Marked as collected", notcollected: "Not collected. Stock added back." }[status]);
    } catch (ex) { toast(ex.userMessage || "Couldn't save. Check your connection.", "err"); btn.disabled = false; }
  });

  // Photo and description editor
  $("#ed-photo").addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    $("#ed-error").hidden = true;
    try { editPhoto = await shrinkImage(f, { max: 700, target: 160000, limit: 290000 }); showEditPic(); }
    catch (ex) { $("#ed-error").textContent = "This file is not a photo we can use. Please choose another one."; $("#ed-error").hidden = false; }
    e.target.value = "";
  });
  $("#ed-remove").addEventListener("click", () => { editPhoto = ""; showEditPic(); });
  $("#ed-desc").addEventListener("input", () => { $("#ed-count").textContent = `${$("#ed-desc").value.length} / 300`; });
  $("#ed-close").addEventListener("click", closeEditor);
  $("#edit-sheet").addEventListener("click", (e) => { if (e.target.id === "edit-sheet") closeEditor(); });
  $("#edit-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = { photo: editPhoto, desc: $("#ed-desc").value.trim().replace(/\s+/g, " ") };
    const problem = validateItemDetails(data);
    if (problem) { $("#ed-error").textContent = problem; $("#ed-error").hidden = false; return; }
    const btn = $("#ed-save"); btn.disabled = true; btn.textContent = "Saving…";
    try { await store.setItemDetails(editId, data); toast("Photo and description saved"); closeEditor(); }
    catch (ex) { $("#ed-error").textContent = "Couldn't save. Check your connection."; $("#ed-error").hidden = false; }
    finally { btn.disabled = false; btn.textContent = "Save"; }
  });

  store.onRiderRequests(renderRiders);

  $("#rider-list").addEventListener("click", async (e) => {
    const btn = e.target.closest("button"); if (!btn) return;
    const row = btn.closest(".rider-row"); const id = row.dataset.id; const act = btn.dataset.act;
    if (act === "photo") { const v = $("#photo-view"); v.querySelector("img").src = btn.querySelector("img").src; v.hidden = false; return; }
    try {
      if (act === "approve") { await store.setRiderStatus(id, "approved"); toast("Rider approved"); }
      if (act === "reject") { await store.setRiderStatus(id, "rejected"); toast("Rider rejected"); }
      if (act === "delete") {
        if (btn.dataset.sure !== "1") { btn.dataset.sure = "1"; btn.textContent = "Tap again to delete"; return; }
        await store.deleteRiderRequest(id); toast("Request deleted");
      }
    } catch (ex) { toast("Couldn't save. Check your connection.", "err"); }
  });
  $("#photo-view").addEventListener("click", () => { $("#photo-view").hidden = true; });

  document.querySelectorAll(".seg").forEach((b) => b.addEventListener("click", () => selectState(b.dataset.state)));

  $("#save-status").addEventListener("click", async () => {
    const back = $("#back-at").value;
    const btn = $("#save-status"); btn.disabled = true;
    try {
      await store.setStatus(selected, back);
      toast(selected === "prayer" ? "Prayer break saved" : selected === "open" ? "Cafe set to open" : "Cafe set to closed");
    } catch (e) { toast("Couldn't save status. Try again.", "err"); }
    finally { btn.disabled = false; }
  });

  $("#staff-list").addEventListener("click", async (e) => {
    const btn = e.target.closest("button"); if (!btn) return;
    const row = btn.closest(".stock-row"); const id = row.dataset.id;
    const input = row.querySelector(".step-input");
    if (btn.dataset.act === "inc") { input.value = Number(input.value || 0) + 1; await saveStock(id, input.value, row); }
    if (btn.dataset.act === "dec") { if (Number(input.value) > 0) { input.value = Number(input.value) - 1; await saveStock(id, input.value, row); } }
    if (btn.dataset.act === "remove") { await store.removeFromToday(id); toast("Removed from today's menu"); }
    if (btn.dataset.act === "edit") openEditor(id);
  });

  $("#staff-list").addEventListener("change", async (e) => {
    if (!e.target.classList.contains("step-input")) return;
    const row = e.target.closest(".stock-row");
    const ok = await saveStock(row.dataset.id, e.target.value, row);
    if (ok) toast("Stock updated");
  });

  $("#add-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errEl = $("#add-error"); errEl.hidden = true;
    const name = cleanName($("#new-name").value); const stock = $("#new-stock").value;
    let err = !name ? "Please enter the food name." : validateStock(stock);
    if (err) { errEl.textContent = err; errEl.hidden = false; return; }
    try {
      await store.addItem(name, Number(stock));
      $("#new-name").value = ""; $("#new-stock").value = ""; $("#new-name").focus();
      toast(`${name} added to today`);
    } catch (ex) { errEl.textContent = "Couldn't save. Check your connection."; errEl.hidden = false; }
  });

  $("#previous").addEventListener("click", async (e) => {
    const c = e.target.closest(".chip"); if (!c) return;
    await store.putOnToday(c.dataset.id); toast("Added back to today. Check the stock number.");
  });

  $("#logout").addEventListener("click", async () => { await store.logout(); location.replace("login.html"); });
});
