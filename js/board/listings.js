// The public board — loading, filtering, sorting, and rendering listings —
// plus the ally-request flow (verify ID -> confirm -> send) that's
// triggered from a card's "Request ally" button.
//
// These two things live in one file on purpose. render() needs to know
// each card's ally-request state to draw the right button, and sending or
// cancelling a request needs to re-run render() afterwards to update that
// button. Splitting them into two files would mean each one importing
// from the other — a circular import — for no real gain, since they're
// really one feature (the board and what you can do from it).

import { supabase } from './supabaseClient.js';
import { escapeHtml, KNOWN_SYSTEMS } from './utils.js';
import { visitor, book, saveIdentity } from './session.js';

let listings = [];
// listing ID (the one requested) -> { requestId, status: 'pending' | 'accepted' }
// Only reflects requests sent during this browser session — same limitation
// the old interest tracking had.
let myAllyState = new Map();

let grid, countLine, emptyMsg, roleToggle, systemFilter, formatFilter, expFilter, sortOrder;
let filterToggleBtn, filtersPanel;
let activeRole = 'all';

let interestAuthOverlay, interestAuthNote, interestCodeFieldWrap, interestCodeInput;
let interestAuthFieldWrap, interestAuthLabel, interestAuthInput, interestConfirmWrap, interestAuthContinueBtn;

let interestPendingTargetId = null;
let interestStage = 'code'; // 'code' -> 'auth' -> 'confirm'
let interestPendingCode = null;
let interestPendingAuthType = null;
let interestPendingAuthValue = null;

export async function loadListings() {
  const { data, error } = await supabase
    .from('listings')
    .select('id, role, name, systems, formats, location, exp, schedule, bio, created_at')
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Could not load listings:', error);
    return;
  }
  listings = data;
  render();
}

// ============ WAX SEAL BADGES ============
// One icon per fact about the listing (system, format, experience,
// location) instead of a row of text tags. Each is a small stamped-seal
// circle; the label only shows on hover via the CSS :hover rule on
// .seal .tip in style.css — this just builds the markup + tooltip text.

const SEAL_ICON_SYSTEM = '<path d="M4 20h16M6 20V9l6-5 6 5v11M9 20v-6h6v6"/>';
const SEAL_ICON_ONLINE = '<rect x="3" y="4" width="18" height="12" rx="1"/><path d="M8 20h8M12 16v4"/>';
const SEAL_ICON_IN_PERSON = '<path d="M4 21v-4a4 4 0 014-4h8a4 4 0 014 4v4M8 9a4 4 0 108 0 4 4 0 00-8 0z"/>';
const SEAL_ICON_LOCATION = '<path d="M12 21s-7-5.5-7-11a7 7 0 0114 0c0 5.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.3"/>';
// Chevron count signals experience tier: 1 = New, 2 = Some experience, 3 = Veteran.
const SEAL_ICON_EXP = {
  'New': '<path d="M6 15l6-6 6 6"/>',
  'Some experience': '<path d="M6 17l6-6 6 6"/><path d="M6 11l6-6 6 6"/>',
  'Veteran': '<path d="M6 19l6-6 6 6"/><path d="M6 13l6-6 6 6"/><path d="M6 7l6-6 6 6"/>',
};

function sealHtml(colorClass, iconPaths, label) {
  return `
    <div class="seal ${colorClass}">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="2">${iconPaths}</svg>
      <span class="tip">${escapeHtml(label)}</span>
    </div>
  `;
}

function buildSealsRow(l) {
  const seals = [];

  (l.systems || []).forEach(s => seals.push(sealHtml('c-oxblood', SEAL_ICON_SYSTEM, s)));
  (l.formats || []).forEach(f => {
    const icon = f === 'Online' ? SEAL_ICON_ONLINE : SEAL_ICON_IN_PERSON;
    seals.push(sealHtml('c-forest', icon, f));
  });
  if (l.exp) {
    seals.push(sealHtml('c-gold', SEAL_ICON_EXP[l.exp] || SEAL_ICON_EXP['New'], l.exp));
  }
  if (l.location) {
    seals.push(sealHtml('c-oxblood', SEAL_ICON_LOCATION, l.location));
  }

  return `<div class="seals-row">${seals.join('')}</div>`;
}

function render() {
  const sys = systemFilter.value;
  const fmt = formatFilter.value;
  const exp = expFilter.value;

  let filtered = listings.filter(l => {
    if (activeRole !== 'all' && l.role !== activeRole) return false;

    const systemsArr = l.systems || [];
    if (sys === 'Other') {
      if (systemsArr.every(s => KNOWN_SYSTEMS.includes(s))) return false;
    } else if (sys && !systemsArr.includes(sys)) {
      return false;
    }

    const formatsArr = l.formats || [];
    if (fmt && !formatsArr.includes(fmt)) return false;

    if (exp && l.exp !== exp) return false;
    return true;
  });

  if (sortOrder.value === 'alpha') {
    filtered = filtered.slice().sort((a, b) => a.name.localeCompare(b.name));
  } else {
    filtered = filtered.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  countLine.textContent = filtered.length + (filtered.length === 1 ? ' listing on the board' : ' listings on the board');
  grid.innerHTML = '';
  emptyMsg.style.display = filtered.length ? 'none' : 'block';

  filtered.forEach(l => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <p class="card-role ${l.role === 'player' ? 'player' : ''}">${l.role === 'dm' ? 'Game Master' : 'Player'}</p>
      <p class="card-name">${escapeHtml(l.name)}</p>
      ${buildSealsRow(l)}
      <div class="card-expand">
        ${l.bio ? `<p class="card-bio">${escapeHtml(l.bio)}</p>` : ''}
      </div>
    `;
    card.appendChild(buildAllyActionEl(l.id));
    grid.appendChild(card);
  });
}

function buildAllyActionEl(listingId) {
  const state = myAllyState.get(listingId);
  const wrap = document.createElement('div');
  if (!state) {
    wrap.innerHTML = `<button class="interest-btn request-btn" data-listing-id="${listingId}">⚔ Request ally</button>`;
  } else if (state.status === 'pending') {
    wrap.innerHTML = `
      <p class="card-line">Ally request sent — pending</p>
      <button class="interest-btn cancel-request-btn" data-request-id="${state.requestId}" data-listing-id="${listingId}">Cancel request</button>
    `;
  } else {
    wrap.innerHTML = `<p class="card-line">✓ You're allies — see the Allies page in the book</p>`;
  }
  return wrap;
}

async function sendAllyRequest(targetId, code, authValue) {
  const { data, error } = await supabase.rpc('request_ally', {
    p_code: code,
    p_auth_value: authValue,
    p_target_listing_id: targetId,
  });

  if (error) {
    alert(error.message);
    return false;
  }

  myAllyState.set(targetId, { requestId: data, status: 'pending' });
  render();
  return true;
}

export function initBoard() {
  grid = document.getElementById('grid');
  countLine = document.getElementById('countLine');
  emptyMsg = document.getElementById('emptyMsg');
  roleToggle = document.getElementById('roleToggle');
  systemFilter = document.getElementById('systemFilter');
  formatFilter = document.getElementById('formatFilter');
  expFilter = document.getElementById('expFilter');
  sortOrder = document.getElementById('sortOrder');

  roleToggle.addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') return;
    [...roleToggle.children].forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    activeRole = e.target.dataset.role;
    render();
  });

  [systemFilter, formatFilter, expFilter, sortOrder].forEach(el => el.addEventListener('change', render));

  filterToggleBtn = document.getElementById('filterToggleBtn');
  filtersPanel = document.getElementById('filtersPanel');
  filterToggleBtn.addEventListener('click', () => {
    const isOpen = filtersPanel.classList.toggle('open');
    filterToggleBtn.classList.toggle('active', isOpen);
    filterToggleBtn.textContent = isOpen ? 'Filters ▴' : 'Filters ▾';
  });

  initAllyRequestFlow();
}

function initAllyRequestFlow() {
  interestAuthOverlay = document.getElementById('interestAuthOverlay');
  interestAuthNote = document.getElementById('interestAuthNote');
  interestCodeFieldWrap = document.getElementById('interestCodeFieldWrap');
  interestCodeInput = document.getElementById('interestCodeInput');
  interestAuthFieldWrap = document.getElementById('interestAuthFieldWrap');
  interestAuthLabel = document.getElementById('interestAuthLabel');
  interestAuthInput = document.getElementById('interestAuthInput');
  interestConfirmWrap = document.getElementById('interestConfirmWrap');
  interestAuthContinueBtn = document.getElementById('interestAuthContinue');

  document.addEventListener('click', async (e) => {
    const cancelBtn = e.target.closest('.cancel-request-btn');
    if (cancelBtn) {
      if (!visitor.code || !visitor.authValue) { alert('Please verify your ID again to cancel this request.'); return; }
      const requestId = cancelBtn.dataset.requestId;
      const listingId = cancelBtn.dataset.listingId;
      cancelBtn.disabled = true;
      const { error } = await supabase.rpc('cancel_ally_request', {
        p_code: visitor.code, p_auth_value: visitor.authValue, p_request_id: requestId,
      });
      if (error) { alert(error.message); cancelBtn.disabled = false; return; }
      myAllyState.delete(listingId);
      render();
      return;
    }

    const btn = e.target.closest('.request-btn');
    if (!btn) return;
    const targetId = btn.dataset.listingId;

    if (visitor.code && visitor.authValue) {
      await sendAllyRequest(targetId, visitor.code, visitor.authValue);
      return;
    }

    interestPendingTargetId = targetId;
    interestStage = 'code';
    interestCodeInput.value = '';
    interestAuthInput.value = '';
    interestCodeFieldWrap.style.display = 'block';
    interestAuthFieldWrap.style.display = 'none';
    interestConfirmWrap.style.display = 'none';
    interestAuthContinueBtn.textContent = 'Continue';
    interestAuthNote.textContent = "Enter your ID to continue — we'll ask for your PIN or security answer next, then a final confirmation before anything is sent.";
    interestAuthOverlay.classList.add('open');
  });

  document.getElementById('interestAuthCancel').addEventListener('click', () => interestAuthOverlay.classList.remove('open'));
  interestAuthOverlay.addEventListener('click', (e) => { if (e.target === interestAuthOverlay) interestAuthOverlay.classList.remove('open'); });

  interestAuthContinueBtn.addEventListener('click', async () => {
    if (interestStage === 'code') {
      const code = interestCodeInput.value.trim().toUpperCase();
      if (!code) { alert('Please enter your ID.'); return; }

      const { data, error } = await supabase.rpc('get_profile_auth_info', { p_code: code });
      if (error || !data || !data.length) {
        alert('No ID found matching that.');
        return;
      }

      interestPendingCode = code;
      interestPendingAuthType = data[0].auth_type;
      interestCodeFieldWrap.style.display = 'none';
      interestAuthFieldWrap.style.display = 'block';
      interestAuthLabel.textContent = interestPendingAuthType === 'pin' ? 'Enter your PIN' : (data[0].question || 'Enter your answer');
      interestAuthInput.value = '';
      interestAuthNote.textContent = 'Almost there — verify it\'s you.';
      interestStage = 'auth';
      return;
    }

    if (interestStage === 'auth') {
      const authValue = interestAuthInput.value.trim();
      if (!authValue) { alert('Please enter your ' + (interestPendingAuthType === 'pin' ? 'PIN' : 'answer') + '.'); return; }
      interestPendingAuthValue = authValue;
      interestAuthFieldWrap.style.display = 'none';
      interestConfirmWrap.style.display = 'block';
      interestAuthNote.textContent = '';
      interestAuthContinueBtn.textContent = 'Send request';
      interestStage = 'confirm';
      return;
    }

    // stage === 'confirm'
    const ok = await sendAllyRequest(interestPendingTargetId, interestPendingCode, interestPendingAuthValue);
    if (ok) {
      visitor.code = interestPendingCode;
      visitor.authValue = interestPendingAuthValue;
      if (!book.code) {
        book.code = interestPendingCode;
        book.authValue = interestPendingAuthValue;
        book.authType = interestPendingAuthType;
      }
      saveIdentity(interestPendingCode, interestPendingAuthValue, interestPendingAuthType);
      interestAuthContinueBtn.textContent = 'Continue';
      interestAuthOverlay.classList.remove('open');
    }
  });
}
