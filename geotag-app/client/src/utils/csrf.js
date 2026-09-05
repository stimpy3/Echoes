import axios from "axios";

/*
Security fix (audit finding BE-002 — CSRF). The server hands this value back exactly
once, in the JSON body of a successful signup/login/google-auth response (never in a
cookie — a cookie set by the API's origin can't be read by this frontend's JS anyway,
since they're different origins). It's stored here and attached to every mutating
request automatically via one global axios interceptor, registered once at app startup
(see main.jsx) — no individual page or component needs to know this exists.

localStorage, not memory-only: this value alone is useless to an attacker (it does
nothing without the httpOnly auth cookie, which no script — same-origin XSS aside, a
different threat model — can read or forge), so persisting it across a page refresh is
a plain usability win, not a security trade-off.
*/
const STORAGE_KEY = "echoes_csrf_token";

export function setCsrfToken(token) {
  if (token) localStorage.setItem(STORAGE_KEY, token);
}

export function getCsrfToken() {
  return localStorage.getItem(STORAGE_KEY);
}

export function clearCsrfToken() {
  localStorage.removeItem(STORAGE_KEY);
}

// Call once, at app startup (see main.jsx). Registering on the default axios instance
// applies to every `axios.get/post/...` call across the app, since every file imports
// the same shared instance — this is the "one place" the CSRF header gets attached,
// not something each of the ~30 files making API calls needs to remember to do.
export function installCsrfInterceptor() {
  axios.interceptors.request.use((config) => {
    const method = (config.method || "get").toUpperCase();
    if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
      const token = getCsrfToken();
      if (token) {
        config.headers = config.headers || {};
        config.headers["X-CSRF-Token"] = token;
      }
    }
    return config;
  });
}
