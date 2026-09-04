// ID/session storage: keeps the visitor's verified ID + PIN/answer in
// sessionStorage so "verify once" survives a page reload but clears
// itself the moment the tab/browser is closed.
import { state, resetBookState, triggerTabRefresh } from '../state/appState.js';

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
    state.book.code = saved.code;
    state.book.authValue = saved.authValue;
    state.book.authType = saved.authType || null;
    state.visitorCode = saved.code;
    state.visitorAuthValue = saved.authValue;
  } catch (e) { /* ignore corrupt/blocked storage */ }
}

export function signOutIdentity() {
  clearIdentity();
  resetBookState();
  state.visitorCode = null;
  state.visitorAuthValue = null;
  triggerTabRefresh(); // equivalent to the original's switchTab(book.tab)
}
