import { supabase } from '../config/supabase.js';
import { escapeHtml } from '../utils/html.js';
import { looksLikeAddress } from '../utils/validation.js';
import { book, setVisitorIdentity, registerTabRenderer } from '../state/appState.js';
import { saveIdentity } from '../auth/identity.js';
import { showInterstitial, showLeaves, setBookLabel, collectSystems, pageLeft, pageRight } from './book.js';

// ============ POST A LISTING TAB ============
export function renderPostTab() {
  setBookLabel((book.code && book.postStage === 'details') ? ('✦ Posting as ' + book.code + ' ✦') : '✦ The Quest Board ✦');
  if (book.postStage === 'auth') { renderPostAuthSetup(); return; }
  if (book.postStage === 'newcode') { renderPostNewCode(); return; }
  renderPostDetails();
}

function renderPostAuthSetup() {
  showInterstitial(`
    <h2>Secure your ID</h2>
    <p class="page-sub" style="text-align:center;">Choose how you'll verify it's really you later, in case someone else guesses your ID.</p>
    <div class="checkbox-group" style="margin-bottom:14px; justify-content:center;">
      <label class="checkbox-pill"><input type="radio" name="authChoice" value="pin" checked> PIN</label>
      <label class="checkbox-pill"><input type="radio" name="authChoice" value="question"> Security question</label>
    </div>
    <div class="field" id="authPinWrap">
      <label>Choose a PIN</label>
      <input type="text" id="authPinInput" placeholder="e.g. 4821" inputmode="numeric">
    </div>
    <div class="field" id="authQuestionWrap" style="display:none;">
      <label>Write your own security question</label>
      <input type="text" id="authQuestionInput" placeholder="e.g. What was my first character's name?">
      <label style="margin-top:10px;">Your answer</label>
      <input type="text" id="authAnswerInput" placeholder="Answer (not case sensitive)">
    </div>
    <div class="modal-actions">
      <button type="button" class="btn-submit" id="continueStepAuth" style="flex:1;">Create my ID</button>
    </div>
  `);

  document.querySelectorAll('input[name="authChoice"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const isPin = document.querySelector('input[name="authChoice"]:checked').value === 'pin';
      document.getElementById('authPinWrap').style.display = isPin ? 'block' : 'none';
      document.getElementById('authQuestionWrap').style.display = isPin ? 'none' : 'block';
    });
  });

  document.getElementById('continueStepAuth').addEventListener('click', async () => {
    const authType = document.querySelector('input[name="authChoice"]:checked').value;
    const btn = document.getElementById('continueStepAuth');

    let rpcArgs = { p_auth_type: authType, p_pin: null, p_question: null, p_answer: null };
    let authValueToKeep = null;

    if (authType === 'pin') {
      const pin = document.getElementById('authPinInput').value.trim();
      if (!pin) { alert('Please choose a PIN.'); return; }
      rpcArgs.p_pin = pin;
      authValueToKeep = pin;
    } else {
      const q = document.getElementById('authQuestionInput').value.trim();
      const a = document.getElementById('authAnswerInput').value.trim();
      if (!q || !a) { alert('Please provide both a question and an answer.'); return; }
      rpcArgs.p_question = q;
      rpcArgs.p_answer = a;
      authValueToKeep = a;
    }

    btn.disabled = true;
    btn.textContent = 'Creating...';
    const { data, error } = await supabase.rpc('create_profile', rpcArgs);
    btn.disabled = false;
    btn.textContent = 'Create my ID';

    if (error) {
      alert('Could not create your ID: ' + error.message);
      return;
    }

    book.code = data;
    book.authValue = authValueToKeep;
    book.authType = authType;
    book.postStage = 'newcode';
    setVisitorIdentity(data, authValueToKeep);
    saveIdentity(data, authValueToKeep, authType);
    renderPostTab();
  });
}

function renderPostNewCode() {
  showInterstitial(`
    <h2>Your new ID</h2>
    <p class="page-sub" style="text-align:center;">Save this somewhere safe, along with your PIN or answer — both are needed to find or edit your listings later.</p>
    <div class="code-display">${escapeHtml(book.code)}</div>
    <div class="modal-actions">
      <button type="button" class="btn-submit" id="continueFromNewCode" style="flex:1;">I've saved it — continue</button>
    </div>
  `);
  document.getElementById('continueFromNewCode').addEventListener('click', () => {
    book.postStage = 'details';
    renderPostTab();
  });
}

function roleFormHTML(prefix, roleLabel) {
  return `
    <span class="page-role-flag"><span class="dot"></span>${roleLabel}</span>
    <h2>${roleLabel === 'Game Master' ? "I'm running a table" : "I'm looking for a table"}</h2>
    <p class="page-sub">Reviewed before it appears on the board — usually within a day or two.</p>
    <div class="field"><label>Name / handle</label><input type="text" id="${prefix}_name" required></div>
    <div class="field">
      <label>Game system(s) — select all that apply</label>
      <div class="checkbox-group" id="${prefix}_systems_group">
        <label class="checkbox-pill"><input type="checkbox" value="D&D 5e"> D&D 5e</label>
        <label class="checkbox-pill"><input type="checkbox" value="Pathfinder 2e"> Pathfinder 2e</label>
        <label class="checkbox-pill"><input type="checkbox" value="Call of Cthulhu"> Call of Cthulhu</label>
        <label class="checkbox-pill"><input type="checkbox" value="Blades in the Dark"> Blades in the Dark</label>
        <label class="checkbox-pill"><input type="checkbox" id="${prefix}_system_other_check"> Other</label>
      </div>
    </div>
    <div class="field" id="${prefix}_system_other_wrap" style="display:none;">
      <label>Name the other system(s)</label>
      <input type="text" id="${prefix}_system_other" placeholder="e.g. Kids on Bikes, Mothership" disabled>
      <p class="hint">Separate multiple with commas.</p>
    </div>
    <div class="field">
      <label>Format — select all that apply</label>
      <div class="checkbox-group">
        <label class="checkbox-pill"><input type="checkbox" value="Online" class="${prefix}_format_check"> Online</label>
        <label class="checkbox-pill"><input type="checkbox" value="In-person" class="${prefix}_format_check"> In-person</label>
      </div>
    </div>
    <div class="field">
      <label>Rough location</label>
      <input type="text" id="${prefix}_location" placeholder="e.g. Seattle, WA or 'Online only'">
      <p class="hint">City, region, or "Online only" — please don't include a street address.</p>
    </div>
    <div class="field">
      <label>Experience level</label>
      <select id="${prefix}_exp"><option>New</option><option>Some experience</option><option>Veteran</option></select>
    </div>
    <div class="field"><label>Schedule</label><input type="text" id="${prefix}_schedule" placeholder="Weeknights, Sunday afternoons..."></div>
    <div class="field"><label>Short bio</label><textarea id="${prefix}_bio" placeholder="Tell people a bit about your table or what you're looking for."></textarea></div>
    <div class="field">
      <label>How can people reach you? (optional)</label>
      <input type="text" id="${prefix}_contact" placeholder="Discord: yourname, or an email address">
      <p class="hint">Never shown publicly. Only used if you and someone else both choose to become allies and separately share contact.</p>
    </div>
    <button type="button" class="quill-btn" id="${prefix}_submit">Sign this page →</button>
  `;
}

function bindPostForm(role, prefix, container) {
  const otherCheck = container.querySelector(`#${prefix}_system_other_check`);
  const otherWrap = container.querySelector(`#${prefix}_system_other_wrap`);
  const otherInput = container.querySelector(`#${prefix}_system_other`);
  otherCheck.addEventListener('change', () => {
    if (otherCheck.checked) {
      otherWrap.style.display = 'block';
      otherInput.disabled = false;
    } else {
      otherWrap.style.display = 'none';
      otherInput.disabled = true;
      otherInput.value = '';
    }
  });

  container.querySelector(`#${prefix}_submit`).addEventListener('click', async () => {
    const systemsGroup = container.querySelector(`#${prefix}_systems_group`);
    const systemsChosen = collectSystems(systemsGroup, otherCheck, otherInput);
    if (!systemsChosen.length) { alert('Please select at least one game system.'); return; }
    if (otherCheck.checked && !otherInput.value.trim()) { alert('Please name the other system(s), or uncheck "Other".'); return; }

    const formatsChosen = [...container.querySelectorAll(`.${prefix}_format_check:checked`)].map(c => c.value);
    if (!formatsChosen.length) { alert('Please select at least one format (Online and/or In-person).'); return; }

    const locationVal = container.querySelector(`#${prefix}_location`).value.trim();
    if (looksLikeAddress(locationVal)) {
      alert('That location looks like it might include a street address. Please enter just a city, neighborhood, or region instead.');
      return;
    }

    const nameVal = container.querySelector(`#${prefix}_name`).value.trim();
    const contactVal = container.querySelector(`#${prefix}_contact`).value.trim();
    if (!nameVal) { alert('Please enter a name or handle.'); return; }

    const btn = container.querySelector(`#${prefix}_submit`);
    btn.disabled = true;
    btn.textContent = 'Submitting...';

    const { error } = await supabase.rpc('submit_listing_with_code', {
      p_code: book.code,
      p_auth_value: book.authValue,
      p_role: role,
      p_name: nameVal,
      p_systems: systemsChosen,
      p_formats: formatsChosen,
      p_location: locationVal,
      p_exp: container.querySelector(`#${prefix}_exp`).value,
      p_schedule: container.querySelector(`#${prefix}_schedule`).value,
      p_bio: container.querySelector(`#${prefix}_bio`).value,
      p_contact: contactVal,
    });

    if (error) {
      btn.disabled = false;
      btn.textContent = 'Sign this page →';
      alert(error.message);
      console.error(error);
      return;
    }

    book.myListings = null; // stale now, refetch next time submissions/interests is opened
    const label = role === 'dm' ? 'Game Master' : 'Player';
    container.innerHTML = `
      <span class="page-role-flag"><span class="dot"></span>${label}</span>
      <h2>Signed and sent</h2>
      <p class="page-sub">Pending review — usually within a day or two. Check "My submissions" with ID ${escapeHtml(book.code)} anytime.</p>
    `;
  });
}

function renderPostDetails() {
  showLeaves();
  pageLeft.innerHTML = roleFormHTML('pf', 'Player');
  pageRight.innerHTML = roleFormHTML('gf', 'Game Master');
  bindPostForm('player', 'pf', pageLeft);
  bindPostForm('dm', 'gf', pageRight);
}

registerTabRenderer('post', renderPostTab);
