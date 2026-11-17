# Andik's Channel – Sprint 1 MVP (G07 Dev Squad)

A PWA for Andik Cafe (Kolej 9 UTM). Sprint 1 covers US01–US05:

| Story | What it does | Where |
|---|---|---|
| US01 | Staff add food and update stock (+ / −, sold out at 0, no empty or negative stock) | `staff.html` |
| US02 | Students see today's food and how many are left, last updated time, empty message | `index.html` |
| US03 | Staff set Open / Prayer break (with back time) / Closed | `staff.html` |
| US04 | Students see opening hours and live status | `index.html` |
| US05 | Staff login, wrong password error, stays logged in, staff page blocked without login | `login.html` |
| US10 (early) | Student registers as a rider with a matric card photo, staff approve or reject (added early after lecturer and owner feedback) | `riders.html`, `staff.html` |
| US06 (early) | Customer creates an account (name, phone, email, password), logs in and sees the saved details (added early after owner feedback) | `account.html` |
| Owner request | Staff add a photo and description to each food; students tap a food to see them | `staff.html`, `index.html` |
| US07 (early, pick-up) | Logged-in customer adds food to a cart and reserves it for pick-up; staff accept (stock goes down), reject, then mark collected or not collected (stock comes back); customer can cancel while waiting | `cart.html`, `account.html`, `staff.html` |

## 1. Try it now (demo mode)
Demo mode works without Firebase. Data is saved only on that device.

1. Open a terminal in this folder and run: `python -m http.server 8000`
2. Open http://localhost:8000 in Chrome.
3. Staff login: any email, password `andik123`.

## 2. Go live with Firebase (free plan, about 15 minutes)
1. Go to https://console.firebase.google.com → **Add project** → name it `andiks-channel` (Google Analytics not needed).
2. **Build → Authentication → Get started → Email/Password → Enable.**
3. **Authentication → Users → Add user** for each staff account (for example the owner and cafe staff). There is no public sign up, so only these accounts can log in.
4. **Build → Firestore Database → Create database →** choose region `asia-southeast1` (Singapore) → start in **production mode**.
5. **Project settings (gear) → Your apps → Web (`</>`)** → register the app → copy the `firebaseConfig` values into `js/firebase-config.js`. The demo banner disappears once `apiKey` is filled in.
6. Install the Firebase tools once: `npm install -g firebase-tools`, then `firebase login`.
7. In this folder: `firebase use --add` (pick your project), then `firebase deploy`.
   This uploads the site **and** the security rules in `firestore.rules` (anyone can read, only logged-in staff can write).
8. Your live link is `https://<project-id>.web.app`. Share it in the cafe Telegram channel and put it on a QR poster.

## Staff accounts (important)
Customers can now create accounts, so an account is staff **only** if it has a document in the `staff` collection.
To make an account staff:
1. Firebase console → **Authentication → Users** → add the user, then copy its **User UID**.
2. **Firestore → Start collection** → collection ID `staff` → **Document ID = the User UID** → add field `role` (string) = `staff`.
3. Authentication → Settings → User actions → **Enable create (sign-up)** must be ticked so customers can register.

## 3. Test checklist (for Nabiha)
- [ ] Student page opens without login and shows today's food with stock left
- [ ] Item with stock 0 shows **Sold out**
- [ ] No food added today → "Menu not updated yet today"
- [ ] Staff page without login goes to the login page
- [ ] Wrong password shows an error and no access
- [ ] After refresh, staff stays logged in until Log out
- [ ] Empty or negative stock is not saved and shows an error
- [ ] Open / Prayer break (with back time) / Closed shows on the student page
- [ ] No status set today → only opening hours are shown (a status only counts for the day it was set)
- [ ] Rider form: missing name, matric, phone or photo shows an error and nothing is sent
- [ ] Rider request shows on the staff page, photo opens big, Approve / Reject shows on the rider page
- [ ] Customer: create account, log out, log in again → saved name and phone are shown
- [ ] Customer account cannot open the staff page or log in on the staff login
- [ ] Staff add a photo and description → students see them on the card and in the details
- [ ] Logged-in customer: staff login link is hidden; Log in and Sign up are separate buttons when logged out
- [ ] Add to cart (cannot add more than the stock), reserve, staff accept → stock goes down
- [ ] Customer cancels while waiting; staff "Not collected" adds the stock back
- [ ] Works on two phones (Android + iPhone), and "Install app" / Add to Home Screen works

## Files
```
index.html        student home (US02, US04)
cart.html         cart and reservation (pick-up)
account.html      customer sign up, login and saved details (US06)
riders.html       rider registration and result (US10)
login.html        staff login (US05)
staff.html        staff dashboard (US01, US03)
css/style.css     design
js/store.js       data layer: Firebase or demo mode
js/firebase-config.js  your Firebase keys + cafe details
manifest.webmanifest, sw.js, icons/   PWA install + offline
firestore.rules   database security rules
firebase.json     hosting config
```
