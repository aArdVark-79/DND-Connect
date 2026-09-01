// Single source of truth for shared, cross-module application state.
//
// This module also hosts three tiny "registry" indirections used purely to
// avoid circular imports between modules that would otherwise need to call
// back into each other (see the refactor notes for the full explanation):
//   - board renderer  (allyActions.js -> listings.js, without importing it)
//   - tab renderers    (book.js -> post/submissions/interests/allies.js)
//   - tab refresher     (identity.js -> book.js, without importing it)
// None of these change any user-visible behavior; they only change how the
// modules reach each other internally.

export const KNOWN_SYSTEMS = ['D&D 5e', 'Pathfinder 2e', 'Call of Cthulhu', 'Blades in the Dark'];

export const state = {
  // ---- board ----
  listings: [],
  activeRole: 'all',

  // listing ID (the one requested) -> { requestId, status: 'pending' | 'accepted' }
  // Only reflects requests sent during this browser session -- same
  // limitation the old interest tracking had.
  myAllyState: new Map(),

  // Cached once verified within this session, so repeat clicks don't re-prompt
  visitorCode: null,
  visitorAuthValue: null,

  // ---- the book ----
  book: {
    tab: 'post',
    code: null,
    authValue: null,
    authType: null,
    myListings: null,  // cached rows from get_listings_by_code, null = not fetched yet
    fetchError: null,
    postStage: 'auth', // 'auth' -> 'newcode' -> 'details'
  },
};

export function resetBookState() {
  state.book.code = null;
  state.book.authValue = null;
  state.book.authType = null;
  state.book.myListings = null;
  state.book.fetchError = null;
  state.book.postStage = 'auth';
}

// ---- board render indirection (breaks listings.js <-> allyActions.js cycle) ----
let boardRenderer = null;
export function setBoardRenderer(fn) { boardRenderer = fn; }
export function triggerBoardRender() { if (boardRenderer) boardRenderer(); }

// ---- book tab registry (breaks book.js <-> post/submissions/interests/allies.js cycle) ----
const tabRenderers = {};
export function registerTabRenderer(name, fn) { tabRenderers[name] = fn; }
export function getTabRenderer(name) { return tabRenderers[name]; }

// ---- tab refresh indirection (breaks identity.js <-> book.js cycle) ----
let tabRefresher = null;
export function setTabRefresher(fn) { tabRefresher = fn; }
export function triggerTabRefresh() { if (tabRefresher) tabRefresher(); }
