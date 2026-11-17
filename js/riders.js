// US10: a student registers as a rider and is verified by cafe staff (matric card photo)
import { getStore, cleanName, validateRider } from "./store.js";
import { $, demoBanner, registerSW } from "./ui.js";

demoBanner();
registerSW();

const KEY = "andiks-rider-id";
const getId = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
const setId = (v) => { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch (e) { /* ignore */ } };

const RESULT = {
  pending:  { badge: "Waiting for approval", title: "Request sent", text: "Cafe staff will check your matric card. Open this page again later to see the result." },
  approved: { badge: "Verified", title: "You are approved", text: "Cafe staff verified you as a UTM student rider." },
  rejected: { badge: "Not approved", title: "Request rejected", text: "Cafe staff could not verify your matric card. You can register again with a clearer photo.", again: true },
  missing:  { badge: "Not found", title: "No request found", text: "Your request is no longer saved. Please register again.", again: true }
};

let photoData = "";
let stop = null;

// Make the photo small enough to save (max 1000px, JPEG), on the phone before sending
function shrink(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      let quality = 0.72, max = 1000, out = "";
      for (let i = 0; i < 5; i++) {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        out = c.toDataURL("image/jpeg", quality);
        if (out.length <= 450000) break;
        max = Math.round(max * 0.8); quality -= 0.08;
      }
      URL.revokeObjectURL(url);
      out.length <= 650000 ? resolve(out) : reject(new Error("too-big"));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("not-image")); };
    img.src = url;
  });
}

function showForm() {
  if (stop) { stop(); stop = null; }
  $("#rider-result").hidden = true; $("#rider-form").hidden = false;
}

function showResult(state) {
  const r = RESULT[state] || RESULT.missing;
  $("#rider-form").hidden = true;
  const box = $("#rider-result"); box.hidden = false; box.dataset.state = state || "missing";
  $("#result-badge").textContent = r.badge; $("#result-title").textContent = r.title; $("#result-text").textContent = r.text;
  $("#rider-again").hidden = !r.again;
}

getStore().then((store) => {
  const watch = (id) => { if (stop) stop(); stop = store.onRiderStatus(id, (status) => showResult(status || "missing")); };
  const saved = getId();
  if (saved) watch(saved); else showForm();

  $("#r-photo").addEventListener("change", async (e) => {
    const err = $("#rider-error"); err.hidden = true;
    const file = e.target.files && e.target.files[0];
    photoData = ""; $("#r-preview").hidden = true;
    if (!file) return;
    try {
      photoData = await shrink(file);
      $("#r-preview").src = photoData; $("#r-preview").hidden = false;
      $("#r-photo-btn").textContent = "Change photo";
    } catch (ex) {
      err.textContent = "This file is not a photo we can use. Please choose another one."; err.hidden = false;
    }
  });

  $("#rider-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#rider-error"); err.hidden = true;
    const data = {
      name: cleanName($("#r-name").value),
      matric: $("#r-matric").value.trim().toUpperCase(),
      phone: $("#r-phone").value.replace(/[\s-]/g, ""),
      photo: photoData
    };
    const problem = validateRider(data);
    if (problem) { err.textContent = problem; err.hidden = false; return; }
    const btn = $("#rider-btn"); btn.disabled = true; btn.textContent = "Sending…";
    try {
      const id = await store.submitRiderRequest(data);
      setId(id); watch(id);
    } catch (ex) {
      err.textContent = "Couldn't send your request. Check your connection and try again."; err.hidden = false;
    } finally { btn.disabled = false; btn.textContent = "Send for verification"; }
  });

  $("#rider-again").addEventListener("click", () => {
    setId(null); photoData = "";
    $("#rider-form").reset(); $("#r-preview").hidden = true; $("#r-photo-btn").textContent = "Take or choose a photo";
    showForm();
  });
});
