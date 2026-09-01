// The shared verify gate used by My Submissions, Requests, and Allies
// whenever no ID has been verified yet this session -- and the
// fetchMyListings() helper that all three of those tabs use afterward to
// load (and cache) the visitor's own listings.
import { supabase } from '../config/supabase.js';
import { escapeHtml } from '../utils/html.js';
import { state } from '../state/appState.js';
import { saveIdentity } from '../auth/identity.js';
import { showInterstitial, switchTab } from './book.js';

export function renderVerifyGate() {
  showInterstitial(`
    <h2>Find your listings</h2>
    <p class="page-sub" style="text-align:center;">Enter your ID to see what you've posted.</p>
    <div class="field"><label>Your ID</label><input type="text" id="gateCodeInput" placeholder="e.g. 482XYZ" maxlength="6" style="text-transform:uppercase;"></div>
    <div class="modal-actions"><button type="button" class="btn-submit" id="gateFindBtn" style="flex:1;">Find my listings</button></div>
    <div id="gateAuthWrap" style="display:none; margin-top:16px;">
      <div class="field">
        <label id="gateAuthLabel">Enter your PIN</label>
        <input type="text" id="gateAuthInput">
        <p class="auth-explainer">This confirms it's really you, so only you can view or edit these listings — even if someone else knows your ID.</p>
      </div>
      <div class="modal-actions"><button type="button" class="btn-submit" id="gateVerifyBtn" style="flex:1;">Verify</button></div>
    </div>
    <div id="gateMsg"></div>
  `);

  const gateCodeInput = document.getElementById('gateCodeInput');
  const gateAuthWrap = document.getElementById('gateAuthWrap');
  const gateAuthLabel = document.getElementById('gateAuthLabel');
  const gateAuthInput = document.getElementById('gateAuthInput');
  const gateMsg = document.getElementById('gateMsg');
  let pendingCode = null;
  let pendingAuthType = null;

  document.getElementById('gateFindBtn').addEventListener('click', async () => {
    const code = gateCodeInput.value.trim().toUpperCase();
    if (!code) { alert('Please enter your ID.'); return; }
    gateMsg.innerHTML = '';
    gateAuthWrap.style.display = 'none';

    const { data, error } = await supabase.rpc('get_profile_auth_info', { p_code: code });
    if (error || !data || !data.length) {
      gateMsg.innerHTML = '<p class="empty" style="padding:14px 0;">No ID found matching that. Double check it, or post your first listing.</p>';
      return;
    }
    pendingCode = code;
    pendingAuthType = data[0].auth_type;
    gateAuthLabel.textContent = pendingAuthType === 'pin' ? 'Enter your PIN' : (data[0].question || 'Enter your answer');
    gateAuthInput.value = '';
    gateAuthWrap.style.display = 'block';
  });

  document.getElementById('gateVerifyBtn').addEventListener('click', async () => {
    const authValue = gateAuthInput.value.trim();
    if (!authValue) { alert('Please enter your ' + (pendingAuthType === 'pin' ? 'PIN' : 'answer') + '.'); return; }

    showInterstitial('<h2>Verifying…</h2>');
    const { data, error } = await supabase.rpc('get_listings_by_code', { p_code: pendingCode, p_auth_value: authValue });
    if (error) {
      renderVerifyGate();
      document.getElementById('gateMsg').innerHTML = `<p class="empty" style="padding:14px 0;">${escapeHtml(error.message)}</p>`;
      return;
    }

    state.book.code = pendingCode;
    state.book.authValue = authValue;
    state.book.authType = pendingAuthType;
    state.book.myListings = data || [];
    state.book.fetchError = null;
    state.book.postStage = 'details';
    state.visitorCode = pendingCode;
    state.visitorAuthValue = authValue;
    saveIdentity(pendingCode, authValue, pendingAuthType);
    switchTab(state.book.tab);
  });
}

export async function fetchMyListings() {
  const { data, error } = await supabase.rpc('get_listings_by_code', {
    p_code: state.book.code, p_auth_value: state.book.authValue,
  });
  if (error) {
    state.book.myListings = [];
    state.book.fetchError = error.message;
  } else {
    state.book.myListings = data || [];
    state.book.fetchError = null;
  }
}
