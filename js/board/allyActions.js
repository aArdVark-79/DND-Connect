// Request ally / cancel request, and the ID+PIN(or question)+confirm
// authentication flow that gates sending a request. Also builds the small
// per-card status element (Request ally / pending+cancel / already allies)
// that board/listings.js drops into each card.
import { supabase } from '../config/supabase.js';
import { state, triggerBoardRender } from '../state/appState.js';
import { saveIdentity } from '../auth/identity.js';

let interestAuthOverlay, interestAuthNote, interestCodeFieldWrap, interestCodeInput;
let interestAuthFieldWrap, interestAuthLabel, interestAuthInput, interestConfirmWrap, interestAuthContinueBtn;

let interestPendingTargetId = null;
let interestStage = 'code'; // 'code' -> 'auth' -> 'confirm'
let interestPendingCode = null;
let interestPendingAuthType = null;
let interestPendingAuthValue = null;

export function buildAllyActionEl(listingId) {
  const requestState = state.myAllyState.get(listingId);
  const wrap = document.createElement('div');
  if (!requestState) {
    wrap.innerHTML = `<button class="interest-btn request-btn" data-listing-id="${listingId}">⚔ Request ally</button>`;
  } else if (requestState.status === 'pending') {
    wrap.innerHTML = `
      <p class="card-line">Ally request sent — pending</p>
      <button class="interest-btn cancel-request-btn" data-request-id="${requestState.requestId}" data-listing-id="${listingId}">Cancel request</button>
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

  state.myAllyState.set(targetId, { requestId: data, status: 'pending' });
  triggerBoardRender();
  return true;
}

export function initAllyActions() {
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
      if (!state.visitorCode || !state.visitorAuthValue) { alert('Please verify your ID again to cancel this request.'); return; }
      const requestId = cancelBtn.dataset.requestId;
      const listingId = cancelBtn.dataset.listingId;
      cancelBtn.disabled = true;
      const { error } = await supabase.rpc('cancel_ally_request', {
        p_code: state.visitorCode, p_auth_value: state.visitorAuthValue, p_request_id: requestId,
      });
      if (error) { alert(error.message); cancelBtn.disabled = false; return; }
      state.myAllyState.delete(listingId);
      triggerBoardRender();
      return;
    }

    const btn = e.target.closest('.request-btn');
    if (!btn) return;
    const targetId = btn.dataset.listingId;

    if (state.visitorCode && state.visitorAuthValue) {
      await sendAllyRequest(targetId, state.visitorCode, state.visitorAuthValue);
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
      state.visitorCode = interestPendingCode;
      state.visitorAuthValue = interestPendingAuthValue;
      if (!state.book.code) {
        state.book.code = interestPendingCode;
        state.book.authValue = interestPendingAuthValue;
        state.book.authType = interestPendingAuthType;
      }
      saveIdentity(interestPendingCode, interestPendingAuthValue, interestPendingAuthType);
      interestAuthContinueBtn.textContent = 'Continue';
      interestAuthOverlay.classList.remove('open');
    }
  });
}
