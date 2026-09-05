import { supabase } from '../config/supabase.js';
import {
  myAllyState, getVisitorCode, getVisitorAuthValue, setVisitorIdentity, book, triggerBoardRender,
} from '../state/appState.js';
import { saveIdentity } from '../auth/identity.js';

export function buildAllyActionEl(listingId) {
  const state = myAllyState.get(listingId);
  const wrap = document.createElement('div');
  if (!state) {
    wrap.innerHTML = `<button class="interest-btn request-btn" data-listing-id="${listingId}">⚔ Request ally</button>`;
  } else if (state.status === 'pending') {
    wrap.innerHTML = `
      <p class="card-line">Your message has been delivered by courier. We'll let you know if they accept your invitation.</p>
      <button class="interest-btn cancel-request-btn" data-request-id="${state.requestId}" data-listing-id="${listingId}">Cancel request</button>
    `;
  } else {
    wrap.innerHTML = `<p class="card-line">✓ Alliance forged! You can now exchange contact details and continue your adventure beyond the board.</p>`;
  }
  return wrap;
}

// ============ INTEREST TOGGLE ============
const interestAuthOverlay = document.getElementById('interestAuthOverlay');
const interestAuthNote = document.getElementById('interestAuthNote');
const interestCodeFieldWrap = document.getElementById('interestCodeFieldWrap');
const interestCodeInput = document.getElementById('interestCodeInput');
const interestAuthFieldWrap = document.getElementById('interestAuthFieldWrap');
const interestAuthLabel = document.getElementById('interestAuthLabel');
const interestAuthInput = document.getElementById('interestAuthInput');
const interestConfirmWrap = document.getElementById('interestConfirmWrap');
const interestAuthContinueBtn = document.getElementById('interestAuthContinue');

let interestPendingTargetId = null;
let interestStage = 'code'; // 'code' -> 'auth' -> 'confirm'
let interestPendingCode = null;
let interestPendingAuthType = null;
let interestPendingAuthValue = null;

document.addEventListener('click', async (e) => {
  const cancelBtn = e.target.closest('.cancel-request-btn');
  if (cancelBtn) {
    const visitorCode = getVisitorCode();
    const visitorAuthValue = getVisitorAuthValue();
    if (!visitorCode || !visitorAuthValue) { alert('Please verify your ID again to cancel this request.'); return; }
    const requestId = cancelBtn.dataset.requestId;
    const listingId = cancelBtn.dataset.listingId;
    cancelBtn.disabled = true;
    const { error } = await supabase.rpc('cancel_ally_request', {
      p_code: visitorCode, p_auth_value: visitorAuthValue, p_request_id: requestId,
    });
    if (error) { alert(error.message); cancelBtn.disabled = false; return; }
    myAllyState.delete(listingId);
    triggerBoardRender();
    return;
  }

  const btn = e.target.closest('.request-btn');
  if (!btn) return;
  const targetId = btn.dataset.listingId;

  const visitorCode = getVisitorCode();
  const visitorAuthValue = getVisitorAuthValue();
  if (visitorCode && visitorAuthValue) {
    await sendAllyRequest(targetId, visitorCode, visitorAuthValue);
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

document.getElementById('interestAuthContinue').addEventListener('click', async () => {
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
    setVisitorIdentity(interestPendingCode, interestPendingAuthValue);
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
  triggerBoardRender();
  return true;
}
