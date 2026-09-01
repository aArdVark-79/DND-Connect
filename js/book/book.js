// The Book: shared chrome used by every tab (post / submissions /
// interests / allies) -- opening/closing, page transitions, bookmark
// navigation, and small rendering helpers (showLeaves/showInterstitial).
//
// This module deliberately never imports post.js/submissions.js/
// interests.js/allies.js directly. Each of those registers its own render
// function into the tab registry (state/appState.js) during its own
// init*() call; switchTab() only ever talks to that registry. That keeps
// this module and the four tab modules from needing to import each other,
// even though conceptually they depend on one another both ways.
import { state, resetBookState, getTabRenderer, setTabRefresher } from '../state/appState.js';
import { signOutIdentity } from '../auth/identity.js';
import { escapeHtml } from '../utils/html.js';

let bookOverlay, bookLabel, pageLeft, pageRight, pageInterstitial, interstitialInner, bookmarkBtns;

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

export function getPageLeft() { return pageLeft; }
export function getPageRight() { return pageRight; }

function setActiveBookmark(tab) {
  bookmarkBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
}

export function setBookLabel(text) {
  if (state.book.code) {
    bookLabel.innerHTML = escapeHtml(text) +
      ' <button type="button" id="switchIdBtn" style="background:none;border:none;text-decoration:underline;cursor:pointer;font:inherit;color:inherit;padding:0;margin-left:6px;">switch ID</button>';
    const btn = document.getElementById('switchIdBtn');
    if (btn) btn.addEventListener('click', (e) => { e.stopPropagation(); signOutIdentity(); });
  } else {
    bookLabel.textContent = text;
  }
}

export function switchTab(tab) {
  state.book.tab = tab;
  setActiveBookmark(tab);
  const fn = getTabRenderer(tab);
  if (fn) fn();
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
  state.book.postStage = 'details';
  bookOverlay.classList.add('open');
  switchTab('post');
}

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

// Shared by book/post.js and book/submissions.js: reads every checked
// system checkbox plus (if the "Other" box is checked) the comma-separated
// write-in field, and returns the combined list.
export function collectSystems(scopeEl, otherCheckEl, otherInputEl) {
  const checked = [...scopeEl.querySelectorAll('input[type="checkbox"][value]:checked')].map(c => c.value);
  if (otherCheckEl.checked && otherInputEl.value.trim()) {
    otherInputEl.value.split(',').map(s => s.trim()).filter(Boolean).forEach(s => checked.push(s));
  }
  return checked;
}

export function initBook() {
  bookOverlay = document.getElementById('bookOverlay');
  bookLabel = document.getElementById('bookLabel');
  pageLeft = document.getElementById('pageLeft');
  pageRight = document.getElementById('pageRight');
  pageInterstitial = document.getElementById('pageInterstitial');
  interstitialInner = document.getElementById('interstitialInner');
  bookmarkBtns = document.querySelectorAll('#bookmarks .bookmark');

  setTabRefresher(() => switchTab(state.book.tab));

  bookmarkBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('active')) return;
      transitionToTab(btn.dataset.tab);
    });
  });

  document.getElementById('closeBook').addEventListener('click', closeBook);
  bookOverlay.addEventListener('click', (e) => { if (e.target === bookOverlay) closeBook(); });
  document.getElementById('openPostFlow').addEventListener('click', () => openBook('post', { fresh: true }));
  document.getElementById('openMyListings').addEventListener('click', () => openBook('submissions', { fresh: !state.book.code }));
}
