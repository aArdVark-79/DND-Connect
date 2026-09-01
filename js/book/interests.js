// Requests tab: requests received (accept/decline) and requests sent
// (cancel). Also exports renderRequestCard, the shared read-only card
// used both here and by book/allies.js.
import { supabase } from '../config/supabase.js';
import { escapeHtml } from '../utils/html.js';
import { state, registerTabRenderer } from '../state/appState.js';
import { showInterstitial, showLeaves, setBookLabel, getPageLeft, getPageRight } from './book.js';
import { renderVerifyGate, fetchMyListings } from './verify.js';

export function renderInterestsTab() {
  setBookLabel(state.book.code ? ('✦ ID ' + state.book.code + ' ✦') : '✦ The Quest Board ✦');
  if (!state.book.code) { renderVerifyGate(); return; }
  if (state.book.myListings === null) {
    showInterstitial('<h2>Loading…</h2>');
    fetchMyListings().then(() => renderInterestsTab());
    return;
  }
  if (state.book.fetchError) {
    showInterstitial(`<h2>Something went wrong</h2><p class="page-sub" style="text-align:center;">${escapeHtml(state.book.fetchError)}</p>`);
    return;
  }
  showLeaves();
  renderInterestsLeaf('player', getPageLeft());
  renderInterestsLeaf('dm', getPageRight());
}

function renderInterestsLeaf(role, container) {
  const label = role === 'dm' ? 'Game Master' : 'Player';
  const item = state.book.myListings.find(r => r.role === role);
  container.innerHTML = `
    <span class="page-role-flag"><span class="dot"></span>${label}</span>
    <h2>Requests, as ${role === 'dm' ? 'a GM' : 'a player'}</h2>
    <p class="page-sub">Accepting just means you'll both show up on each other's Allies page — contact still isn't shared until you separately choose to.</p>
  `;
  if (!item) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.style.padding = '10px 0';
    p.style.fontSize = '14px';
    p.textContent = `You don't have a ${label} listing yet, so there's nothing to show here.`;
    container.appendChild(p);
    return;
  }

  const receivedHeading = document.createElement('p');
  receivedHeading.className = 'interest-subheading';
  receivedHeading.textContent = 'Requests received';
  container.appendChild(receivedHeading);
  const receivedList = document.createElement('div');
  receivedList.innerHTML = '<p class="empty" style="padding:10px 0; font-size:14px;">Loading...</p>';
  container.appendChild(receivedList);
  loadRequestsReceived(state.book.code, state.book.authValue, item.id, receivedList);

  const sentHeading = document.createElement('p');
  sentHeading.className = 'interest-subheading';
  sentHeading.textContent = 'Requests sent';
  container.appendChild(sentHeading);
  const sentList = document.createElement('div');
  sentList.innerHTML = '<p class="empty" style="padding:10px 0; font-size:14px;">Loading...</p>';
  container.appendChild(sentList);
  loadRequestsSent(state.book.code, state.book.authValue, item.id, sentList);
}

// Shared read-only card for a request/ally row. bioField is optional --
// pass it only where a bio might legitimately be shown.
export function renderRequestCard(item, roleField, nameField, systemsField, formatsField, locationField, expField, scheduleField, bioField) {
  const systemsText = (item[systemsField] || []).join(', ') || 'Any system';
  const formatsText = (item[formatsField] || []).join(' / ') || 'Format flexible';
  const div = document.createElement('div');
  div.className = 'interest-read-card';
  div.innerHTML = `
    <p class="card-role ${item[roleField] === 'player' ? 'player' : ''}">${item[roleField] === 'dm' ? 'Game Master' : 'Player'}</p>
    <p class="card-name">${escapeHtml(item[nameField])}</p>
    <p class="card-line"><strong>${escapeHtml(systemsText)}</strong> · ${escapeHtml(formatsText)}</p>
    <p class="card-line">${escapeHtml(item[expField])} · ${escapeHtml(item[scheduleField] || 'Schedule flexible')}</p>
    ${item[locationField] ? `<p class="card-line">📍 ${escapeHtml(item[locationField])}</p>` : ''}
    ${bioField && item[bioField] ? `<p class="card-bio">${escapeHtml(item[bioField])}</p>` : ''}
  `;
  return div;
}

async function loadRequestsReceived(code, authValue, listingId, container) {
  const { data, error } = await supabase.rpc('get_requests_received', {
    p_code: code, p_auth_value: authValue, p_listing_id: listingId,
  });
  if (error) {
    container.innerHTML = `<p class="empty" style="padding:10px 0; font-size:14px;">${escapeHtml(error.message)}</p>`;
    return;
  }
  if (!data || !data.length) {
    container.innerHTML = '<p class="empty" style="padding:10px 0; font-size:14px;">No requests yet.</p>';
    return;
  }
  container.innerHTML = '';
  data.forEach(item => {
    const card = renderRequestCard(
      item, 'sender_role', 'sender_name', 'sender_systems', 'sender_formats',
      'sender_location', 'sender_exp', 'sender_schedule', 'sender_bio'
    );
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex; gap:8px; margin-top:8px;';
    actions.innerHTML = `
      <button type="button" class="quill-btn" data-action="accept" data-request-id="${item.request_id}" style="width:auto; flex:1; margin-top:0;">Accept</button>
      <button type="button" class="quill-btn" data-action="decline" data-request-id="${item.request_id}" style="width:auto; flex:1; margin-top:0; background:transparent; color:var(--oxblood); border-color:var(--oxblood);">Decline</button>
    `;
    card.appendChild(actions);
    container.appendChild(card);
  });
  container.onclick = async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const requestId = btn.dataset.requestId;
    const fn = btn.dataset.action === 'accept' ? 'accept_ally_request' : 'decline_ally_request';
    btn.disabled = true;
    const { error } = await supabase.rpc(fn, { p_code: code, p_auth_value: authValue, p_request_id: requestId });
    if (error) { alert(error.message); btn.disabled = false; return; }
    loadRequestsReceived(code, authValue, listingId, container);
  };
}

async function loadRequestsSent(code, authValue, listingId, container) {
  const { data, error } = await supabase.rpc('get_requests_sent', {
    p_code: code, p_auth_value: authValue, p_listing_id: listingId,
  });
  if (error) {
    container.innerHTML = `<p class="empty" style="padding:10px 0; font-size:14px;">${escapeHtml(error.message)}</p>`;
    return;
  }
  if (!data || !data.length) {
    container.innerHTML = '<p class="empty" style="padding:10px 0; font-size:14px;">You haven\'t sent any requests yet.</p>';
    return;
  }
  container.innerHTML = '';
  data.forEach(item => {
    const card = renderRequestCard(
      item, 'target_role', 'target_name', 'target_systems', 'target_formats',
      'target_location', 'target_exp', 'target_schedule', null
    );
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'quill-btn';
    cancelBtn.dataset.requestId = item.request_id;
    cancelBtn.style.cssText = 'background:transparent; color:var(--oxblood); border-color:var(--oxblood);';
    cancelBtn.textContent = 'Cancel request';
    card.appendChild(cancelBtn);
    container.appendChild(card);
  });
  container.onclick = async (e) => {
    const btn = e.target.closest('button[data-request-id]');
    if (!btn) return;
    btn.disabled = true;
    const { error } = await supabase.rpc('cancel_ally_request', {
      p_code: code, p_auth_value: authValue, p_request_id: btn.dataset.requestId,
    });
    if (error) { alert(error.message); btn.disabled = false; return; }
    loadRequestsSent(code, authValue, listingId, container);
  };
}

export function initInterests() {
  registerTabRenderer('interests', renderInterestsTab);
}
