// My Submissions tab: viewing and editing your own Player/GM listings.
import { supabase } from '../config/supabase.js';
import { escapeHtml, escapeAttr } from '../utils/html.js';
import { looksLikeAddress } from '../utils/validation.js';
import { state, KNOWN_SYSTEMS, registerTabRenderer } from '../state/appState.js';
import { showInterstitial, showLeaves, setBookLabel, collectSystems, openPostForRole, getPageLeft, getPageRight } from './book.js';
import { renderVerifyGate, fetchMyListings } from './verify.js';

export function renderSubmissionsTab() {
  setBookLabel(state.book.code ? ('✦ ID ' + state.book.code + ' ✦') : '✦ The Quest Board ✦');
  if (!state.book.code) { renderVerifyGate(); return; }
  if (state.book.myListings === null) {
    showInterstitial('<h2>Loading…</h2>');
    fetchMyListings().then(() => renderSubmissionsTab());
    return;
  }
  if (state.book.fetchError) {
    showInterstitial(`<h2>Something went wrong</h2><p class="page-sub" style="text-align:center;">${escapeHtml(state.book.fetchError)}</p>`);
    return;
  }
  showLeaves();
  renderSubmissionsLeaf('player', getPageLeft());
  renderSubmissionsLeaf('dm', getPageRight());
}

function renderSubmissionsLeaf(role, container) {
  const label = role === 'dm' ? 'Game Master' : 'Player';
  const item = state.book.myListings.find(r => r.role === role);
  container.innerHTML = `
    <span class="page-role-flag"><span class="dot"></span>${label}</span>
    <h2>${role === 'dm' ? 'Your GM listing' : 'Your player listing'}</h2>
  `;
  if (item) {
    container.appendChild(buildEditCard(state.book.code, state.book.authValue, item));
  } else {
    const prompt = document.createElement('div');
    prompt.className = 'missing-role-prompt';
    prompt.innerHTML = `<p>You don't have a ${label} listing under this ID yet.</p>`;
    const btn = document.createElement('button');
    btn.className = 'add-btn';
    btn.textContent = `+ Add a ${label} listing`;
    btn.addEventListener('click', () => openPostForRole(role));
    prompt.appendChild(btn);
    container.appendChild(prompt);
  }
}

function buildEditCard(code, authValue, item) {
  const uid = item.id.replace(/-/g, '_');
  const card = document.createElement('div');
  card.className = 'edit-card';

  const itemSystems = item.systems || [];
  const itemFormats = item.formats || [];
  const customSystems = itemSystems.filter(s => !KNOWN_SYSTEMS.includes(s));
  const hasCustom = customSystems.length > 0;

  card.innerHTML = `
    <span class="status-pill ${item.status}">${item.status === 'approved' ? 'Live on the board' : 'Pending review'}</span>

    <div class="field">
      <label>Name / handle</label>
      <input type="text" id="e_name_${uid}" value="${escapeAttr(item.name)}">
    </div>

    <div class="field">
      <label>Game system(s) — select all that apply</label>
      <div class="checkbox-group" id="e_systems_group_${uid}">
        ${KNOWN_SYSTEMS.map(s => `<label class="checkbox-pill"><input type="checkbox" value="${s}" ${itemSystems.includes(s) ? 'checked' : ''}> ${s}</label>`).join('')}
        <label class="checkbox-pill"><input type="checkbox" id="e_system_other_check_${uid}" ${hasCustom ? 'checked' : ''}> Other</label>
      </div>
    </div>
    <div class="field" id="e_system_other_wrap_${uid}" style="display:${hasCustom ? 'block' : 'none'};">
      <label>Name the other system(s)</label>
      <input type="text" id="e_system_other_${uid}" value="${escapeAttr(customSystems.join(', '))}" ${hasCustom ? '' : 'disabled'}>
      <p class="hint">Separate multiple with commas.</p>
    </div>

    <div class="field">
      <label>Format — select all that apply</label>
      <div class="checkbox-group">
        <label class="checkbox-pill"><input type="checkbox" value="Online" class="e_format_check_${uid}" ${itemFormats.includes('Online') ? 'checked' : ''}> Online</label>
        <label class="checkbox-pill"><input type="checkbox" value="In-person" class="e_format_check_${uid}" ${itemFormats.includes('In-person') ? 'checked' : ''}> In-person</label>
      </div>
    </div>

    <div class="field">
      <label>Rough location</label>
      <input type="text" id="e_location_${uid}" value="${escapeAttr(item.location || '')}" placeholder="e.g. Seattle, WA or 'Online only'">
      <p class="hint">City, region, or "Online only" — please don't include a street address.</p>
    </div>

    <div class="field">
      <label>Experience level</label>
      <select id="e_exp_${uid}">
        <option ${item.exp === 'New' ? 'selected' : ''}>New</option>
        <option ${item.exp === 'Some experience' ? 'selected' : ''}>Some experience</option>
        <option ${item.exp === 'Veteran' ? 'selected' : ''}>Veteran</option>
      </select>
    </div>
    <div class="field">
      <label>Schedule</label>
      <input type="text" id="e_schedule_${uid}" value="${escapeAttr(item.schedule || '')}">
    </div>
    <div class="field">
      <label>Short bio</label>
      <textarea id="e_bio_${uid}">${escapeHtml(item.bio || '')}</textarea>
    </div>
    <div class="field">
      <label>How can people reach you?</label>
      <input type="text" id="e_contact_${uid}" value="${escapeAttr(item.contact || '')}">
    </div>
    <p class="auth-explainer" style="text-align:left; margin-top: 4px;">Editing your name, location, schedule, contact, or bio will send this listing back for review. Changing your systems, format, or experience level won't.</p>
    <div class="modal-actions">
      <button type="button" class="btn-cancel" data-action="cancel">Cancel</button>
      <button type="button" class="btn-submit" data-action="save">Save</button>
    </div>
  `;

  const otherCheck = card.querySelector(`#e_system_other_check_${uid}`);
  const otherWrap = card.querySelector(`#e_system_other_wrap_${uid}`);
  const otherInput = card.querySelector(`#e_system_other_${uid}`);
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

  card.querySelector('[data-action="cancel"]').addEventListener('click', () => {
    card.replaceWith(buildEditCard(code, authValue, item));
  });

  card.querySelector('[data-action="save"]').addEventListener('click', async () => {
    const systemsGroup = card.querySelector(`#e_systems_group_${uid}`);
    const systemsChosen = collectSystems(systemsGroup, otherCheck, otherInput);
    if (!systemsChosen.length) { alert('Please select at least one game system.'); return; }
    if (otherCheck.checked && !otherInput.value.trim()) { alert('Please name the other system(s), or uncheck "Other".'); return; }

    const formatsChosen = [...card.querySelectorAll(`.e_format_check_${uid}:checked`)].map(c => c.value);
    if (!formatsChosen.length) { alert('Please select at least one format.'); return; }

    const locationVal = card.querySelector(`#e_location_${uid}`).value.trim();
    if (looksLikeAddress(locationVal)) {
      alert('That location looks like it might include a street address. Please enter just a city, neighborhood, or region instead.');
      return;
    }

    const saveBtn = card.querySelector('[data-action="save"]');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    const { data, error } = await supabase.rpc('update_my_listing', {
      p_code: code,
      p_auth_value: authValue,
      p_id: item.id,
      p_name: card.querySelector(`#e_name_${uid}`).value,
      p_systems: systemsChosen,
      p_formats: formatsChosen,
      p_location: locationVal,
      p_exp: card.querySelector(`#e_exp_${uid}`).value,
      p_schedule: card.querySelector(`#e_schedule_${uid}`).value,
      p_bio: card.querySelector(`#e_bio_${uid}`).value,
      p_contact: card.querySelector(`#e_contact_${uid}`).value,
    });

    saveBtn.disabled = false;
    saveBtn.textContent = 'Save';

    if (error) {
      alert('Could not save: ' + error.message);
      return;
    }

    const updated = Array.isArray(data) ? data[0] : data;
    const idx = state.book.myListings.findIndex(r => r.id === updated.id);
    if (idx !== -1) state.book.myListings[idx] = updated;

    if (updated.status === 'pending') {
      alert('Saved! Since you changed a written field, this listing is back in the review queue.');
    } else {
      alert('Saved! No review needed since only selections were changed.');
    }
    card.replaceWith(buildEditCard(code, authValue, updated));
  });

  return card;
}

export function initSubmissions() {
  registerTabRenderer('submissions', renderSubmissionsTab);
}
