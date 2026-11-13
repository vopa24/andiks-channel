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
  store.onAuth((u) => { if (u) location.replace("staff.html"); });

  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#login-error"); err.hidden = true;
    const email = $("#email").value.trim(); const pw = $("#password").value;
    if (!email || !pw) { err.textContent = "Please enter your email and password."; err.hidden = false; return; }
    const btn = $("#login-btn"); btn.disabled = true; btn.classList.add("loading"); btn.textContent = "Logging in…";
    try {
      await store.login(email, pw);
      location.replace("staff.html");
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
