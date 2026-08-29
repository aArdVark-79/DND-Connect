import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

  const SUPABASE_URL = 'https://hmweboxsztxkgtgnkbvz.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhtd2Vib3hzenR4a2d0Z25rYnZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NzkwOTksImV4cCI6MjEwMzM1NTA5OX0.l6jQ7KQJ82vahll6F-5chFFDGsmC1cdTkUOcr327KLk';

  window.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);



  // ============ Shared helpers ============
  const KNOWN_SYSTEMS = ['D&D 5e', 'Pathfinder 2e', 'Call of Cthulhu', 'Blades in the Dark'];

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }
  function escapeAttr(str) {
    return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }

  // Best-effort check for street addresses in the location field. Not
  // perfect (no pattern match can be), so this is a safety net alongside
  // manual review, not a guarantee -- it flags common address shapes
  // (house number + street word, PO boxes, zip codes) for the person to
  // fix before submitting.
  function looksLikeAddress(text) {
    if (!text) return false;
    const t = text.trim();
    const streetWord = /\b(street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|way|place|pl|terrace|circle|cir|highway|hwy|parkway|pkwy|suite|ste|apt|apartment|unit)\b/i;
    const hasNumber = /\d/.test(t);
    const hasZip = /\b\d{5}(-\d{4})?\b/.test(t);
    const hasPOBox = /\bp\.?\s*o\.?\s*box\b/i.test(t);
    return hasPOBox || hasZip || (hasNumber && streetWord.test(t));
  }

  // ============ BOARD: filters, sorting, rendering ============
  let listings = [];
  // listing ID (the one requested) -> { requestId, status: 'pending' | 'accepted' }
  // Only reflects requests sent during this browser session — same limitation
  // the old interest tracking had.
  let myAllyState = new Map();

  // Cached once verified within this session, so repeat clicks don't re-prompt
  let visitorCode = null;
  let visitorAuthValue = null;

  const grid = document.getElementById('grid');
  const countLine = document.getElementById('countLine');
  const emptyMsg = document.getElementById('emptyMsg');
  const roleToggle = document.getElementById('roleToggle');
  const systemFilter = document.getElementById('systemFilter');
  const formatFilter = document.getElementById('formatFilter');
  const expFilter = document.getElementById('expFilter');
  const sortOrder = document.getElementById('sortOrder');

  let activeRole = 'all';

  async function loadListings() {
    const { data, error } = await window.supabase
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
      const systemsText = (l.systems || []).join(', ') || 'Any system';
      const formatsText = (l.formats || []).join(' / ') || 'Format flexible';
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <p class="card-role ${l.role === 'player' ? 'player' : ''}">${l.role === 'dm' ? 'Game Master' : 'Player'}</p>
        <p class="card-name">${escapeHtml(l.name)}</p>
        <p class="card-line"><strong>${escapeHtml(systemsText)}</strong> · ${escapeHtml(formatsText)}</p>
        <p class="card-line">${escapeHtml(l.exp)} · ${escapeHtml(l.schedule || 'Schedule flexible')}</p>
        ${l.location ? `<p class="card-line">📍 ${escapeHtml(l.location)}</p>` : ''}
        <div class="tags">
          ${(l.systems || []).map(s => `<span class="tag">${escapeHtml(s)}</span>`).join('')}
          ${(l.formats || []).map(f => `<span class="tag">${escapeHtml(f)}</span>`).join('')}
          <span class="tag">${escapeHtml(l.exp)}</span>
        </div>
        ${l.bio ? `<p class="card-bio">${escapeHtml(l.bio)}</p>` : ''}
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

  roleToggle.addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') return;
    [...roleToggle.children].forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    activeRole = e.target.dataset.role;
    render();
  });

  [systemFilter, formatFilter, expFilter, sortOrder].forEach(el => el.addEventListener('change', render));

  const filterToggleBtn = document.getElementById('filterToggleBtn');
  const filtersPanel = document.getElementById('filtersPanel');
  filterToggleBtn.addEventListener('click', () => {
    const isOpen = filtersPanel.classList.toggle('open');
    filterToggleBtn.classList.toggle('active', isOpen);
    filterToggleBtn.textContent = isOpen ? 'Filters ▴' : 'Filters ▾';
  });

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
      if (!visitorCode || !visitorAuthValue) { alert('Please verify your ID again to cancel this request.'); return; }
      const requestId = cancelBtn.dataset.requestId;
      const listingId = cancelBtn.dataset.listingId;
      cancelBtn.disabled = true;
      const { error } = await window.supabase.rpc('cancel_ally_request', {
        p_code: visitorCode, p_auth_value: visitorAuthValue, p_request_id: requestId,
      });
      if (error) { alert(error.message); cancelBtn.disabled = false; return; }
      myAllyState.delete(listingId);
      render();
      return;
    }

    const btn = e.target.closest('.request-btn');
    if (!btn) return;
    const targetId = btn.dataset.listingId;

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

      const { data, error } = await window.supabase.rpc('get_profile_auth_info', { p_code: code });
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
      visitorCode = interestPendingCode;
      visitorAuthValue = interestPendingAuthValue;
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
    const { data, error } = await window.supabase.rpc('request_ally', {
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
  // ============ THE BOOK: shared state + chrome ============
  const bookOverlay = document.getElementById('bookOverlay');
  const bookLabel = document.getElementById('bookLabel');
  const pageLeft = document.getElementById('pageLeft');
  const pageRight = document.getElementById('pageRight');
  const pageInterstitial = document.getElementById('pageInterstitial');
  const interstitialInner = document.getElementById('interstitialInner');
  const bookmarkBtns = document.querySelectorAll('#bookmarks .bookmark');

  const book = {
    tab: 'post',
    code: null,
    authValue: null,
    authType: null,
    myListings: null,   // cached rows from get_listings_by_code, null = not fetched yet
    fetchError: null,
    postStage: 'auth',  // 'auth' -> 'newcode' -> 'details'
  };

  function resetBookState() {
    book.code = null;
    book.authValue = null;
    book.authType = null;
    book.myListings = null;
    book.fetchError = null;
    book.postStage = 'auth';
  }

  // ============ REMEMBER VERIFICATION FOR THIS VISIT ============
  // Kept in sessionStorage: survives a page reload, but clears itself the
  // moment the tab/browser is closed, so "verify once" only lasts for as
  // long as the person is actually on the site.
  const IDENTITY_KEY = 'questboard_identity_v1';

  function saveIdentity(code, authValue, authType) {
    try {
      sessionStorage.setItem(IDENTITY_KEY, JSON.stringify({ code, authValue, authType }));
    } catch (e) { /* storage blocked (private mode etc) — just skip remembering */ }
  }

  function clearIdentity() {
    try { sessionStorage.removeItem(IDENTITY_KEY); } catch (e) {}
  }

  function restoreIdentity() {
    try {
      const raw = sessionStorage.getItem(IDENTITY_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (!saved || !saved.code || !saved.authValue) return;
      book.code = saved.code;
      book.authValue = saved.authValue;
      book.authType = saved.authType || null;
      visitorCode = saved.code;
      visitorAuthValue = saved.authValue;
    } catch (e) { /* ignore corrupt/blocked storage */ }
  }

  function signOutIdentity() {
    clearIdentity();
    resetBookState();
    visitorCode = null;
    visitorAuthValue = null;
    switchTab(book.tab);
  }

  function setBookLabel(text) {
    if (book.code) {
      bookLabel.innerHTML = escapeHtml(text) +
        ' <button type="button" id="switchIdBtn" style="background:none;border:none;text-decoration:underline;cursor:pointer;font:inherit;color:inherit;padding:0;margin-left:6px;">switch ID</button>';
      const btn = document.getElementById('switchIdBtn');
      if (btn) btn.addEventListener('click', (e) => { e.stopPropagation(); signOutIdentity(); });
    } else {
      bookLabel.textContent = text;
    }
  }

  restoreIdentity();

  function showLeaves() {
    pageInterstitial.style.display = 'none';
    pageLeft.style.display = 'block';
    pageRight.style.display = 'block';
  }
  function showInterstitial(html) {
    pageLeft.style.display = 'none';
    pageRight.style.display = 'none';
    pageInterstitial.style.display = 'block';
    interstitialInner.innerHTML = html;
  }

  function setActiveBookmark(tab) {
    bookmarkBtns.forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  }

  function switchTab(tab) {
    book.tab = tab;
    setActiveBookmark(tab);
    if (tab === 'post') renderPostTab();
    else if (tab === 'submissions') renderSubmissionsTab();
    else if (tab === 'interests') renderInterestsTab();
    else renderAlliesTab();
  }

  function openBook(tab, opts) {
    opts = opts || {};
    if (opts.fresh) resetBookState();
    bookOverlay.classList.add('open');
    switchTab(tab);
  }
  function closeBook() {
    bookOverlay.classList.remove('open');
  }
  function openPostForRole(role) {
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

  function collectSystems(scopeEl, otherCheckEl, otherInputEl) {
    const checked = [...scopeEl.querySelectorAll('input[type="checkbox"][value]:checked')].map(c => c.value);
    if (otherCheckEl.checked && otherInputEl.value.trim()) {
      otherInputEl.value.split(',').map(s => s.trim()).filter(Boolean).forEach(s => checked.push(s));
    }
    return checked;
  }

  // ============ POST A LISTING TAB ============
  function renderPostTab() {
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
      const { data, error } = await window.supabase.rpc('create_profile', rpcArgs);
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
      visitorCode = data;
      visitorAuthValue = authValueToKeep;
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

      const { error } = await window.supabase.rpc('submit_listing_with_code', {
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

  // ============ MY SUBMISSIONS + INTERESTS: shared verify gate ============
  function renderVerifyGate() {
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

      const { data, error } = await window.supabase.rpc('get_profile_auth_info', { p_code: code });
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
      const { data, error } = await window.supabase.rpc('get_listings_by_code', { p_code: pendingCode, p_auth_value: authValue });
      if (error) {
        renderVerifyGate();
        document.getElementById('gateMsg').innerHTML = `<p class="empty" style="padding:14px 0;">${escapeHtml(error.message)}</p>`;
        return;
      }

      book.code = pendingCode;
      book.authValue = authValue;
      book.authType = pendingAuthType;
      book.myListings = data || [];
      book.fetchError = null;
      book.postStage = 'details';
      visitorCode = pendingCode;
      visitorAuthValue = authValue;
      saveIdentity(pendingCode, authValue, pendingAuthType);
      switchTab(book.tab);
    });
  }

  async function fetchMyListings() {
    const { data, error } = await window.supabase.rpc('get_listings_by_code', {
      p_code: book.code, p_auth_value: book.authValue,
    });
    if (error) {
      book.myListings = [];
      book.fetchError = error.message;
    } else {
      book.myListings = data || [];
      book.fetchError = null;
    }
  }

  // ============ MY SUBMISSIONS TAB ============
  function renderSubmissionsTab() {
    setBookLabel(book.code ? ('✦ ID ' + book.code + ' ✦') : '✦ The Quest Board ✦');
    if (!book.code) { renderVerifyGate(); return; }
    if (book.myListings === null) {
      showInterstitial('<h2>Loading…</h2>');
      fetchMyListings().then(() => renderSubmissionsTab());
      return;
    }
    if (book.fetchError) {
      showInterstitial(`<h2>Something went wrong</h2><p class="page-sub" style="text-align:center;">${escapeHtml(book.fetchError)}</p>`);
      return;
    }
    showLeaves();
    renderSubmissionsLeaf('player', pageLeft);
    renderSubmissionsLeaf('dm', pageRight);
  }

  function renderSubmissionsLeaf(role, container) {
    const label = role === 'dm' ? 'Game Master' : 'Player';
    const item = book.myListings.find(r => r.role === role);
    container.innerHTML = `
      <span class="page-role-flag"><span class="dot"></span>${label}</span>
      <h2>${role === 'dm' ? 'Your GM listing' : 'Your player listing'}</h2>
    `;
    if (item) {
      container.appendChild(buildEditCard(book.code, book.authValue, item));
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

      const { data, error } = await window.supabase.rpc('update_my_listing', {
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
      const idx = book.myListings.findIndex(r => r.id === updated.id);
      if (idx !== -1) book.myListings[idx] = updated;

      if (updated.status === 'pending') {
        alert('Saved! Since you changed a written field, this listing is back in the review queue.');
      } else {
        alert('Saved! No review needed since only selections were changed.');
      }
      card.replaceWith(buildEditCard(code, authValue, updated));
    });

    return card;
  }

  // ============ INTERESTS TAB ============
  function renderInterestsTab() {
    setBookLabel(book.code ? ('✦ ID ' + book.code + ' ✦') : '✦ The Quest Board ✦');
    if (!book.code) { renderVerifyGate(); return; }
    if (book.myListings === null) {
      showInterstitial('<h2>Loading…</h2>');
      fetchMyListings().then(() => renderInterestsTab());
      return;
    }
    if (book.fetchError) {
      showInterstitial(`<h2>Something went wrong</h2><p class="page-sub" style="text-align:center;">${escapeHtml(book.fetchError)}</p>`);
      return;
    }
    showLeaves();
    renderInterestsLeaf('player', pageLeft);
    renderInterestsLeaf('dm', pageRight);
  }

  function renderInterestsLeaf(role, container) {
    const label = role === 'dm' ? 'Game Master' : 'Player';
    const item = book.myListings.find(r => r.role === role);
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
    loadRequestsReceived(book.code, book.authValue, item.id, receivedList);

    const sentHeading = document.createElement('p');
    sentHeading.className = 'interest-subheading';
    sentHeading.textContent = 'Requests sent';
    container.appendChild(sentHeading);
    const sentList = document.createElement('div');
    sentList.innerHTML = '<p class="empty" style="padding:10px 0; font-size:14px;">Loading...</p>';
    container.appendChild(sentList);
    loadRequestsSent(book.code, book.authValue, item.id, sentList);
  }

  // Shared read-only card for a request/ally row. contactField is optional —
  // pass it only where contact might legitimately be shown (the Allies tab).
  function renderRequestCard(item, roleField, nameField, systemsField, formatsField, locationField, expField, scheduleField, bioField) {
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
    const { data, error } = await window.supabase.rpc('get_requests_received', {
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
      const { error } = await window.supabase.rpc(fn, { p_code: code, p_auth_value: authValue, p_request_id: requestId });
      if (error) { alert(error.message); btn.disabled = false; return; }
      loadRequestsReceived(code, authValue, listingId, container);
    };
  }

  async function loadRequestsSent(code, authValue, listingId, container) {
    const { data, error } = await window.supabase.rpc('get_requests_sent', {
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
      const { error } = await window.supabase.rpc('cancel_ally_request', {
        p_code: code, p_auth_value: authValue, p_request_id: btn.dataset.requestId,
      });
      if (error) { alert(error.message); btn.disabled = false; return; }
      loadRequestsSent(code, authValue, listingId, container);
    };
  }

  // ============ ALLIES TAB ============
  function renderAlliesTab() {
    setBookLabel(book.code ? ('✦ ID ' + book.code + ' ✦') : '✦ The Quest Board ✦');
    if (!book.code) { renderVerifyGate(); return; }
    if (book.myListings === null) {
      showInterstitial('<h2>Loading…</h2>');
      fetchMyListings().then(() => renderAlliesTab());
      return;
    }
    if (book.fetchError) {
      showInterstitial(`<h2>Something went wrong</h2><p class="page-sub" style="text-align:center;">${escapeHtml(book.fetchError)}</p>`);
      return;
    }
    showLeaves();
    renderAlliesLeaf('player', pageLeft);
    renderAlliesLeaf('dm', pageRight);
  }

  function renderAlliesLeaf(role, container) {
    const label = role === 'dm' ? 'Game Master' : 'Player';
    const item = book.myListings.find(r => r.role === role);
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
    loadAllies(book.code, book.authValue, item.id, list);
  }

  async function loadAllies(code, authValue, listingId, container) {
    const { data, error } = await window.supabase.rpc('get_my_allies', {
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
        const { error: shareError } = await window.supabase.rpc('set_contact_shared', {
          p_code: code, p_auth_value: authValue, p_request_id: item.request_id, p_shared: !item.my_shared,
        });
        if (shareError) { alert(shareError.message); shareBtn.disabled = false; return; }
        loadAllies(code, authValue, listingId, container);
      });
      card.appendChild(shareBtn);

      container.appendChild(card);
    });
  }

  // ============ LIVE UPDATES: refresh the board without a reload ============
  // Listens for any change to the listings table (e.g. admin approves/
  // rejects a submission, or someone edits their own listing back into
  // review) and quietly re-fetches the board. Requires Realtime to be
  // turned on for the "listings" table in the Supabase dashboard
  // (Database → Replication) — this code alone can't enable that.
  let realtimeSubscribed = false;
  let listingsRefreshTimer = null;
  function subscribeToListingChanges() {
    if (realtimeSubscribed) return;
    realtimeSubscribed = true;
    window.supabase
      .channel('public:listings-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'listings' }, () => {
        clearTimeout(listingsRefreshTimer);
        listingsRefreshTimer = setTimeout(loadListings, 400);
      })
      .subscribe();
  }

  // ============ DICE ROLL ============
  // Rolls a d20 and gives the page a subtle, temporary color wash based on
  // the result -- purely cosmetic, no game mechanics attached to it.
  const ROLL_FLAVOR = {
    1: 'Critical failure...', 2: 'Ouch.', 3: 'Rough one.', 4: 'Not great.', 5: 'Meh.',
    6: 'Could be worse.', 7: 'Shrug.', 8: 'Middling.', 9: 'Passable.', 10: 'Even odds.',
    11: 'Decent.', 12: 'Solid.', 13: 'Pretty good.', 14: 'Nice roll!', 15: 'Great roll!',
    16: 'Excellent!', 17: 'Fantastic!', 18: 'Superb!', 19: 'Almost perfect!', 20: 'CRITICAL HIT!',
  };

  function hexToRgb(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  function lerp(a, b, t) { return Math.round(a + (b - a) * t); }
  function mixHex(hexA, hexB, t) {
    const a = hexToRgb(hexA), b = hexToRgb(hexB);
    return `rgb(${lerp(a.r, b.r, t)}, ${lerp(a.g, b.g, t)}, ${lerp(a.b, b.b, t)})`;
  }
  // 1 -> oxblood, 10/11 -> gold, 20 -> forest, blended lightly with the
  // base parchment so the page stays readable, not fully re-colored.
  function colorForRoll(n) {
    const oxblood = '#6b2737', gold = '#c99a3f', forest = '#2c4a3b', parchment = '#e5d8b4';
    let accent;
    if (n <= 10) accent = mixHex(oxblood, gold, (n - 1) / 9);
    else accent = mixHex(gold, forest, (n - 11) / 9);
    return mixHex(parchment, accent.startsWith('rgb') ? rgbToHex(accent) : accent, 0.22);
  }
  function rgbToHex(rgbStr) {
    const [r, g, b] = rgbStr.match(/\d+/g).map(Number);
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  const d20Btn = document.getElementById('d20Btn');
  const d20FaceText = document.getElementById('d20FaceText');
  const d20Result = document.getElementById('d20Result');
  const d20RollNum = document.getElementById('d20RollNum');
  const d20RollLabel = document.getElementById('d20RollLabel');
  let rolling = false;

  d20Btn.addEventListener('click', () => {
    if (rolling) return;
    rolling = true;
    d20Btn.classList.add('rolling');
    d20Result.classList.remove('show');

    let ticks = 0;
    const flicker = setInterval(() => {
      d20FaceText.textContent = String(1 + Math.floor(Math.random() * 20));
      ticks++;
      if (ticks > 8) clearInterval(flicker);
    }, 60);

    setTimeout(() => {
      clearInterval(flicker);
      const roll = 1 + Math.floor(Math.random() * 20);
      d20FaceText.textContent = String(roll);
      d20Btn.classList.remove('rolling');
      rolling = false;

      d20RollNum.textContent = roll;
      d20RollLabel.textContent = ROLL_FLAVOR[roll];
      d20RollNum.style.color = colorForRoll(roll).startsWith('rgb') ? rgbToHex(colorForRoll(roll)) : colorForRoll(roll);
      d20Result.classList.add('show');

      document.body.style.backgroundColor = colorForRoll(roll);
    }, 620);
  });

  // ============ MAINTENANCE MODE CHECK ============
  function showRealSite() {
    document.getElementById('maintenanceScreen').style.display = 'none';
    document.getElementById('siteContent').style.display = 'block';
    loadListings();
    subscribeToListingChanges();
  }
  function showMaintenanceScreen() {
    document.getElementById('maintenanceScreen').style.display = 'flex';
    document.getElementById('siteContent').style.display = 'none';
  }

  let decided = false;
  const safetyTimer = setTimeout(() => {
    if (!decided) {
      decided = true;
      console.warn('Maintenance check timed out - staying closed by default.');
      showMaintenanceScreen();
    }
  }, 4000);

  (async () => {
    try {
      const { data, error } = await window.supabase
        .from('site_settings')
        .select('maintenance')
        .eq('id', 1)
        .single();

      if (decided) return;
      clearTimeout(safetyTimer);
      decided = true;

      if (error) {
        console.error('Could not read maintenance setting:', error.message, error.code);
        showMaintenanceScreen();
        return;
      }

      if (data.maintenance) {
        showMaintenanceScreen();
      } else {
        showRealSite();
      }
    } catch (err) {
      console.error('Unexpected exception checking maintenance status:', err.message);
      if (decided) return;
      clearTimeout(safetyTimer);
      decided = true;
      showMaintenanceScreen();
    }
  })();
