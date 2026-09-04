// ============ Shared application state ============
export const KNOWN_SYSTEMS = ['D&D 5e', 'Pathfinder 2e', 'Call of Cthulhu', 'Blades in the Dark'];

// ---- Board state ----
// listing ID (the one requested) -> { requestId, status: 'pending' | 'accepted' }
// Only reflects requests sent during this browser session — same limitation
// the old interest tracking had.
export const myAllyState = new Map();

let listings = [];
export function getListings() { return listings; }
export function setListings(data) { listings = data; }

let activeRole = 'all';
export function getActiveRole() { return activeRole; }
export function setActiveRole(role) { activeRole = role; }

// Cached once verified within this session, so repeat clicks don't re-prompt
let visitorCode = null;
let visitorAuthValue = null;
export function getVisitorCode() { return visitorCode; }
export function getVisitorAuthValue() { return visitorAuthValue; }
export function setVisitorIdentity(code, authValue) {
  visitorCode = code;
  visitorAuthValue = authValue;
}
export function clearVisitorIdentity() {
  visitorCode = null;
  visitorAuthValue = null;
}

// ---- Book (The Book UI) state ----
export const book = {
  tab: 'post',
  code: null,
  authValue: null,
  authType: null,
  myListings: null,   // cached rows from get_listings_by_code, null = not fetched yet
  fetchError: null,
  postStage: 'auth',  // 'auth' -> 'newcode' -> 'details'
};

export function resetBookState() {
  book.code = null;
  book.authValue = null;
  book.authType = null;
  book.myListings = null;
  book.fetchError = null;
  book.postStage = 'auth';
}

// ---- Cross-module registries ----
// These exist purely to avoid circular imports between modules that need to
// call back into each other:
//  - allyActions needs to re-render the board after a request/cancel, without
//    importing board/listings.js (which imports allyActions for buildAllyActionEl).
//  - auth/identity needs to refresh whichever book tab is open on sign-out,
//    without importing book/book.js (which imports identity for signOutIdentity).
//  - book/book.js needs to call whichever tab's render function on tab switch,
//    without importing every tab module (each tab module imports book.js instead).
let boardRenderer = null;
export function setBoardRenderer(fn) { boardRenderer = fn; }
export function triggerBoardRender() { if (boardRenderer) boardRenderer(); }

const tabRenderers = {};
export function registerTabRenderer(name, fn) { tabRenderers[name] = fn; }
export function getTabRenderer(name) { return tabRenderers[name]; }

let tabRefresher = null;
export function setTabRefresher(fn) { tabRefresher = fn; }
export function triggerTabRefresh() { if (tabRefresher) tabRefresher(); }
