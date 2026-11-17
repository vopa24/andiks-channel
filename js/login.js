// US05: staff login
import { getStore, isDemo } from "./store.js";
import { $, demoBanner, registerSW } from "./ui.js";

demoBanner();
registerSW();
if (isDemo) $("#demo-hint").hidden = false;

$("#pw-toggle").addEventListener("click", () => {
  const p = $("#password"); const show = p.type === "password";
  p.type = show ? "text" : "password"; $("#pw-toggle").textContent = show ? "Hide" : "Show";
});

getStore().then((store) => {
  // Already logged in (AC3: session stays after refresh) → go straight to dashboard
  // A customer account is not staff: log it out here and show a message (US05: only staff get access)
  let submitted = false;
  store.onAuth(async (u) => {
    if (!u) return;
    if (u.isStaff) { location.replace("staff.html"); return; }
    if (!submitted) return; // a customer who only opened this page stays logged in
    submitted = false;
    await store.logout();
    const err = $("#login-error");
    err.textContent = "This is not a staff account. Customers can log in from the student page."; err.hidden = false;
    const btn = $("#login-btn"); btn.disabled = false; btn.classList.remove("loading"); btn.textContent = "Log in";
  });

  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#login-error"); err.hidden = true;
    const email = $("#email").value.trim(); const pw = $("#password").value;
    if (!email || !pw) { err.textContent = "Please enter your email and password."; err.hidden = false; return; }
    const btn = $("#login-btn"); btn.disabled = true; btn.classList.add("loading"); btn.textContent = "Logging in…";
    try {
      submitted = true;
      await store.login(email, pw); // onAuth above opens the dashboard for staff
    } catch (ex) {
      // AC2: wrong password shows an error and gives no access
      const code = ex && ex.code || "";
      err.textContent = code.includes("too-many") ? "Too many attempts. Please wait a minute and try again."
        : code.includes("network") ? "No internet connection. Please try again."
        : "Wrong email or password. Please try again.";
      err.hidden = false;
      $("#password").value = ""; $("#password").focus();
    } finally {
      btn.disabled = false; btn.classList.remove("loading"); btn.textContent = "Log in";
    }
  });
});
