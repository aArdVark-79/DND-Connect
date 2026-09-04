import { book, resetBookState, setVisitorIdentity, clearVisitorIdentity, triggerTabRefresh } from '../state/appState.js';

// ============ REMEMBER VERIFICATION FOR THIS VISIT ============
// Kept in sessionStorage: survives a page reload, but clears itself the
// moment the tab/browser is closed, so "verify once" only lasts for as
// long as the person is actually on the site.
const IDENTITY_KEY = 'questboard_identity_v1';

export function saveIdentity(code, authValue, authType) {
  try {
    sessionStorage.setItem(IDENTITY_KEY, JSON.stringify({ code, authValue, authType }));
  } catch (e) { /* storage blocked (private mode etc) — just skip remembering */ }
}

export function clearIdentity() {
  try { sessionStorage.removeItem(IDENTITY_KEY); } catch (e) {}
}

export function restoreIdentity() {
  try {
    const raw = sessionStorage.getItem(IDENTITY_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (!saved || !saved.code || !saved.authValue) return;
    book.code = saved.code;
    book.authValue = saved.authValue;
    book.authType = saved.authType || null;
    setVisitorIdentity(saved.code, saved.authValue);
  } catch (e) { /* ignore corrupt/blocked storage */ }
}

export function signOutIdentity() {
  clearIdentity();
  resetBookState();
  clearVisitorIdentity();
  triggerTabRefresh();
}
