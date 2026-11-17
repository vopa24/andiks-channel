// US06: customer sign up, log in and saved details
import { getStore, cleanName, validateCustomer } from "./store.js";
import { $, demoBanner, registerSW } from "./ui.js";

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
  let stopProfile = null;

  store.onAuth((user) => {
    if (stopProfile) { stopProfile(); stopProfile = null; }
    if (!user) { $("#profile-box").hidden = true; $("#auth-box").hidden = false; return; }
    if (user.isStaff) { location.replace("staff.html"); return; }
    $("#auth-box").hidden = true; $("#profile-box").hidden = false;
    $("#p-email").textContent = user.email;
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

  $("#c-logout").addEventListener("click", async () => { await store.logout(); showTab("login"); });
});
