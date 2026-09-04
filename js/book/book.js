import { escapeHtml } from '../utils/html.js';
import { book, resetBookState, getTabRenderer, setTabRefresher } from '../state/appState.js';
import { signOutIdentity } from '../auth/identity.js';

// ============ THE BOOK: shared chrome ============
const bookOverlay = document.getElementById('bookOverlay');
const bookLabel = document.getElementById('bookLabel');
export const pageLeft = document.getElementById('pageLeft');
export const pageRight = document.getElementById('pageRight');
const pageInterstitial = document.getElementById('pageInterstitial');
const interstitialInner = document.getElementById('interstitialInner');
const bookmarkBtns = document.querySelectorAll('#bookmarks .bookmark');

export function setBookLabel(text) {
  if (book.code) {
    bookLabel.innerHTML = escapeHtml(text) +
      ' <button type="button" id="switchIdBtn" style="background:none;border:none;text-decoration:underline;cursor:pointer;font:inherit;color:inherit;padding:0;margin-left:6px;">switch ID</button>';
    const btn = document.getElementById('switchIdBtn');
    if (btn) btn.addEventListener('click', (e) => { e.stopPropagation(); signOutIdentity(); });
  } else {
    bookLabel.textContent = text;
  }
}

export function showLeaves() {
  pageInterstitial.style.display = 'none';
  pageLeft.style.display = 'block';
  pageRight.style.display = 'block';
}
export function showInterstitial(html) {
  pageLeft.style.display = 'none';
  pageRight.style.display = 'none';
  pageInterstitial.style.display = 'block';
  interstitialInner.innerHTML = html;
}

function setActiveBookmark(tab) {
  bookmarkBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
}

// Tabs (post/submissions/interests/allies) register their render function via
// registerTabRenderer instead of being imported here directly — this keeps
// book.js from needing to import every tab module (which each import book.js).
export function switchTab(tab) {
  book.tab = tab;
  setActiveBookmark(tab);
  const renderer = getTabRenderer(tab);
  if (renderer) renderer();
}

export function openBook(tab, opts) {
  opts = opts || {};
  if (opts.fresh) resetBookState();
  bookOverlay.classList.add('open');
  switchTab(tab);
}
export function closeBook() {
  bookOverlay.classList.remove('open');
}
export function openPostForRole(role) {
  book.postStage = 'details';
  bookOverlay.classList.add('open');
  switchTab('post');
}

bookmarkBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.classList.contains('active')) return;
    transitionToTab(btn.dataset.tab);
  });
});

function transitionToTab(tab) {
  pageLeft.classList.add('leaving');
  pageRight.classList.add('leaving');
  pageInterstitial.classList.add('leaving');
  setTimeout(() => {
    switchTab(tab);
    pageLeft.classList.remove('leaving');
    pageRight.classList.remove('leaving');
    pageInterstitial.classList.remove('leaving');
  }, 180);
}
document.getElementById('closeBook').addEventListener('click', closeBook);
bookOverlay.addEventListener('click', (e) => { if (e.target === bookOverlay) closeBook(); });
document.getElementById('openPostFlow').addEventListener('click', () => openBook('post', { fresh: true }));
document.getElementById('openMyListings').addEventListener('click', () => openBook('submissions', { fresh: !book.code }));

export function collectSystems(scopeEl, otherCheckEl, otherInputEl) {
  const checked = [...scopeEl.querySelectorAll('input[type="checkbox"][value]:checked')].map(c => c.value);
  if (otherCheckEl.checked && otherInputEl.value.trim()) {
    otherInputEl.value.split(',').map(s => s.trim()).filter(Boolean).forEach(s => checked.push(s));
  }
  return checked;
}

// Lets auth/identity.js refresh whichever tab is open on sign-out, without
// identity.js importing book.js (which imports identity.js for signOutIdentity).
setTabRefresher(() => switchTab(book.tab));
