// Allies tab: your accepted allies, and sharing/unsharing contact info
// with each of them.
import { supabase } from '../config/supabase.js';
import { escapeHtml } from '../utils/html.js';
import { state, registerTabRenderer } from '../state/appState.js';
import { showInterstitial, showLeaves, setBookLabel, getPageLeft, getPageRight } from './book.js';
import { renderVerifyGate, fetchMyListings } from './verify.js';
import { renderRequestCard } from './interests.js';

export function renderAlliesTab() {
  setBookLabel(state.book.code ? ('✦ ID ' + state.book.code + ' ✦') : '✦ The Quest Board ✦');
  if (!state.book.code) { renderVerifyGate(); return; }
  if (state.book.myListings === null) {
    showInterstitial('<h2>Loading…</h2>');
    fetchMyListings().then(() => renderAlliesTab());
    return;
  }
  if (state.book.fetchError) {
    showInterstitial(`<h2>Something went wrong</h2><p class="page-sub" style="text-align:center;">${escapeHtml(state.book.fetchError)}</p>`);
    return;
  }
  showLeaves();
  renderAlliesLeaf('player', getPageLeft());
  renderAlliesLeaf('dm', getPageRight());
}

function renderAlliesLeaf(role, container) {
  const label = role === 'dm' ? 'Game Master' : 'Player';
  const item = state.book.myListings.find(r => r.role === role);
  container.innerHTML = `
    <span class="page-role-flag"><span class="dot"></span>${label}</span>
    <h2>Allies, as ${role === 'dm' ? 'a GM' : 'a player'}</h2>
    <p class="page-sub">Contact only shows once you've both chosen to share it — and either of you can unshare at any time.</p>
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
  const list = document.createElement('div');
  list.innerHTML = '<p class="empty" style="padding:10px 0; font-size:14px;">Loading...</p>';
  container.appendChild(list);
  loadAllies(state.book.code, state.book.authValue, item.id, list);
}

async function loadAllies(code, authValue, listingId, container) {
  const { data, error } = await supabase.rpc('get_my_allies', {
    p_code: code, p_auth_value: authValue, p_listing_id: listingId,
  });
  if (error) {
    container.innerHTML = `<p class="empty" style="padding:10px 0; font-size:14px;">${escapeHtml(error.message)}</p>`;
    return;
  }
  if (!data || !data.length) {
    container.innerHTML = '<p class="empty" style="padding:10px 0; font-size:14px;">No allies yet.</p>';
    return;
  }
  container.innerHTML = '';
  data.forEach(item => {
    const card = renderRequestCard(
      item, 'ally_role', 'ally_name', 'ally_systems', 'ally_formats',
      'ally_location', 'ally_exp', 'ally_schedule', 'ally_bio'
    );

    const contactP = document.createElement('p');
    contactP.className = 'card-bio';
    if (item.ally_contact) {
      contactP.innerHTML = `<strong>Contact:</strong> ${escapeHtml(item.ally_contact)}`;
    } else if (item.my_shared) {
      contactP.textContent = 'Contact hidden — waiting for them to share theirs.';
    } else {
      contactP.textContent = 'Contact hidden — share yours to see theirs.';
    }
    card.appendChild(contactP);

    const shareBtn = document.createElement('button');
    shareBtn.type = 'button';
    shareBtn.className = 'quill-btn';
    shareBtn.style.marginTop = '10px';
    shareBtn.textContent = item.my_shared ? 'Unshare my contact' : 'Share my contact';
    shareBtn.addEventListener('click', async () => {
      shareBtn.disabled = true;
      const { error: shareError } = await supabase.rpc('set_contact_shared', {
        p_code: code, p_auth_value: authValue, p_request_id: item.request_id, p_shared: !item.my_shared,
      });
      if (shareError) { alert(shareError.message); shareBtn.disabled = false; return; }
      loadAllies(code, authValue, listingId, container);
    });
    card.appendChild(shareBtn);

    container.appendChild(card);
  });
}

export function initAllies() {
  registerTabRenderer('allies', renderAlliesTab);
}
