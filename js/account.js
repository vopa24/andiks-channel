// US06: customer sign up, log in and saved details
import { getStore, cleanName, validateCustomer } from "./store.js";
import { $, esc, timeLabel, demoBanner, registerSW, setCart, toast } from "./ui.js";

demoBanner();
registerSW();

function showTab(which) {
  const login = which === "login";
  $("#c-login-form").hidden = !login; $("#c-signup-form").hidden = login;
  $("#tab-login").classList.toggle("active", login); $("#tab-signup").classList.toggle("active", !login);
  $("#tab-login").setAttribute("aria-selected", login); $("#tab-signup").setAttribute("aria-selected", !login);
}
$("#tab-login").addEventListener("click", () => showTab("login"));
$("#tab-signup").addEventListener("click", () => showTab("signup"));
if (location.hash === "#signup") showTab("signup");
if (location.hash === "#login") showTab("login");

// Reservation status for the customer
const RES_LABEL = {
  pending: ["Waiting for the cafe", "pill-wait"], accepted: ["Accepted, ready to pick up", "pill-ok"],
  rejected: ["Rejected by the cafe", "pill-out"], collected: ["Collected", "pill-done"],
  notcollected: ["Not collected", "pill-out"], cancelled: ["Cancelled by you", "pill-done"]
};
function renderMyRes(list) {
  const box = $("#my-res");
  if (!list.length) { box.innerHTML = `<p class="sub">No reservations yet. Add food to your cart from the menu.</p>`; return; }
  list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  box.innerHTML = list.slice(0, 10).map((r) => {
    const [label, cls] = RES_LABEL[r.status] || RES_LABEL.pending;
    return `
    <div class="res-card" data-id="${esc(r.id)}">
      <div class="res-top"><span class="pill ${cls}">${label}</span><span class="res-time">${esc(timeLabel(r.createdAt))}</span></div>
      <ul class="res-items">${r.items.map((i) => `<li>${i.qty} × ${esc(i.name)}</li>`).join("")}</ul>
      ${r.status === "pending" ? `<button class="mini-btn mini-no" data-act="cancel">Cancel reservation</button>` : ""}
    </div>`;
  }).join("");
}

function authMessage(ex, fallback) {
  const code = (ex && ex.code) || "";
  if (code.includes("email-already-in-use")) return "This email already has an account. Please log in.";
  if (code.includes("weak-password")) return "Password must be at least 6 characters.";
  if (code.includes("invalid-email")) return "Please enter a valid email.";
  if (code.includes("too-many")) return "Too many attempts. Please wait a minute and try again.";
  if (code.includes("network")) return "No internet connection. Please try again.";
  if (code.includes("admin-restricted") || code.includes("operation-not-allowed")) return "Creating accounts is turned off right now. Please tell the cafe staff.";
  return fallback;
}

getStore().then((store) => {
  let stopProfile = null, stopRes = null;

  store.onAuth((user) => {
    if (stopProfile) { stopProfile(); stopProfile = null; }
    if (stopRes) { stopRes(); stopRes = null; }
    if (!user) { $("#profile-box").hidden = true; $("#auth-box").hidden = false; return; }
    if (user.isStaff) { location.replace("staff.html"); return; }
    $("#auth-box").hidden = true; $("#profile-box").hidden = false;
    $("#p-email").textContent = user.email;
    stopRes = store.onMyReservations(user.uid, renderMyRes);
    // The saved details come back from the database every time the customer logs in
    stopProfile = store.onProfile(user.uid, (p) => {
      $("#p-name").textContent = p ? p.name : "Not saved yet";
      $("#p-phone").textContent = p ? p.phone : "Not saved yet";
      $("#p-hello").textContent = p ? `Hi, ${p.name.split(" ")[0]}` : "My account";
    });
  });

  $("#c-login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#c-login-error"); err.hidden = true;
    const email = $("#l-email").value.trim(); const pw = $("#l-password").value;
    if (!email || !pw) { err.textContent = "Please enter your email and password."; err.hidden = false; return; }
    const btn = $("#c-login-btn"); btn.disabled = true; btn.textContent = "Logging in…";
    try { await store.login(email, pw); $("#l-password").value = ""; }
    catch (ex) { err.textContent = authMessage(ex, "Wrong email or password. Please try again."); err.hidden = false; $("#l-password").value = ""; }
    finally { btn.disabled = false; btn.textContent = "Log in"; }
  });

  $("#c-signup-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#c-signup-error"); err.hidden = true;
    const data = {
      name: cleanName($("#s-name").value),
      phone: $("#s-phone").value.replace(/[\s-]/g, ""),
      email: $("#s-email").value.trim(),
      password: $("#s-password").value
    };
    const problem = validateCustomer(data);
    if (problem) { err.textContent = problem; err.hidden = false; return; }
    const btn = $("#c-signup-btn"); btn.disabled = true; btn.textContent = "Creating…";
    try { await store.signUp(data); $("#c-signup-form").reset(); }
    catch (ex) { err.textContent = authMessage(ex, "Couldn't create your account. Please try again."); err.hidden = false; }
    finally { btn.disabled = false; btn.textContent = "Create account"; }
  });

  $("#c-logout").addEventListener("click", async () => { setCart({}); await store.logout(); showTab("login"); });

  $("#my-res").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-act=cancel]"); if (!btn) return;
    if (btn.dataset.sure !== "1") { btn.dataset.sure = "1"; btn.textContent = "Tap again to cancel"; return; }
    try { await store.cancelReservation(btn.closest(".res-card").dataset.id); toast("Reservation cancelled"); }
    catch (ex) { toast("Couldn't cancel. The cafe may have already accepted it.", "err"); }
  });
});
