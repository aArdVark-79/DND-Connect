import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://hmweboxsztxkgtgnkbvz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhtd2Vib3hzenR4a2d0Z25rYnZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NzkwOTksImV4cCI6MjEwMzM1NTA5OX0.l6jQ7KQJ82vahll6F-5chFFDGsmC1cdTkUOcr327KLk';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
function escapeAttr(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

const KNOWN_SYSTEMS = ['D&D 5e', 'Pathfinder 2e', 'Call of Cthulhu', 'Blades in the Dark'];

const loginBox = document.getElementById('loginBox');
const adminPanel = document.getElementById('adminPanel');
const loginError = document.getElementById('loginError');

document.getElementById('loginBtn').addEventListener('click', async () => {
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    loginError.style.display = 'block';
    return;
  }
  loginError.style.display = 'none';
  showAdmin();
});

document.getElementById('signOutBtn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  location.reload();
});

async function showAdmin() {
  loginBox.style.display = 'none';
  adminPanel.style.display = 'block';
  initTabs();
  await refreshStatus();
  await loadOverview();
  await loadPending();
}

// ============ TABS ============
const TAB_LOADERS = {
  overview: loadOverview,
  pending: loadPending,
  all: loadAllListings,
  reports: loadReports,
  settings: () => refreshStatus(),
};

function initTabs() {
  document.getElementById('adminTabs').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-tab]');
    if (!btn) return;
    switchToTab(btn.dataset.tab);
  });

  document.getElementById('allListingsSearch').addEventListener('input', () => renderAllListings());
}

function switchToTab(tab) {
  document.querySelectorAll('#adminTabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
  document.getElementById('tab-' + tab).style.display = 'block';
  const loader = TAB_LOADERS[tab];
  if (loader) loader();
}

// ============ OVERVIEW ============
async function loadOverview() {
  const statsGrid = document.getElementById('statsGrid');
  const overviewFlag = document.getElementById('overviewFlag');
  statsGrid.innerHTML = '<p class="empty" style="padding:10px 0;">Loading...</p>';

  const [live, pending, openReports, allies] = await Promise.all([
    supabase.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
    supabase.from('listings').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('reports').select('id', { count: 'exact', head: true }).eq('status', 'open'),
    supabase.from('interests').select('id', { count: 'exact', head: true }).eq('status', 'accepted'),
  ]);

  const liveCount = live.count ?? '—';
  const pendingCount = pending.count ?? '—';
  const reportsCount = openReports.count ?? '—';
  const alliesCount = allies.count ?? '—';

  statsGrid.innerHTML = `
    <div class="stat-card"><p class="stat-label">Live listings</p><p class="stat-value">${liveCount}</p></div>
    <div class="stat-card"><p class="stat-label">Pending review</p><p class="stat-value">${pendingCount}</p></div>
    <div class="stat-card"><p class="stat-label">Open reports</p><p class="stat-value">${reportsCount}</p></div>
    <div class="stat-card"><p class="stat-label">Allies formed</p><p class="stat-value">${alliesCount}</p></div>
  `;

  const flags = [];
  if (typeof pending.count === 'number' && pending.count > 0) {
    flags.push(`${pending.count} listing${pending.count === 1 ? '' : 's'} waiting on review`);
  }
  if (typeof openReports.count === 'number' && openReports.count > 0) {
    flags.push(`${openReports.count} report${openReports.count === 1 ? '' : 's'} need${openReports.count === 1 ? 's' : ''} a look`);
  }
  if (flags.length) {
    overviewFlag.textContent = flags.join(' · ');
    overviewFlag.style.display = 'block';
  } else {
    overviewFlag.style.display = 'none';
  }
}

// ============ PENDING TAB (unchanged behavior from before) ============
const pendingList = document.getElementById('pendingList');

// Only the fields someone actually typed themselves -- location, schedule,
// bio, contact. Selections like role/system/format/experience are left out
// since they're not written content that needs a human read-through.
const WRITTEN_FIELDS = [
  { key: 'location', label: 'Location' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'contact', label: 'Contact' },
  { key: 'bio', label: 'Bio' },
];

async function loadPending() {
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    pendingList.innerHTML = `<p class="empty">Could not load pending listings: ${error.message}</p>`;
    return;
  }

  if (!data.length) {
    pendingList.innerHTML = '<p class="empty">Nothing waiting for review right now.</p>';
    return;
  }

  pendingList.innerHTML = '';
  data.forEach(item => {
    const card = document.createElement('div');
    card.className = 'pending-card';

    const fieldsHtml = WRITTEN_FIELDS
      .filter(f => item[f.key] && item[f.key].trim())
      .map(f => `
        <div class="pending-field">
          <p class="pending-field-label">${f.label}</p>
          <p class="pending-field-value">${escapeHtml(item[f.key])}</p>
        </div>
      `).join('');

    card.innerHTML = `
      <p class="pending-name">${escapeHtml(item.name)}</p>
      ${fieldsHtml || '<p class="pending-field-value" style="font-style:italic; color:var(--ink-soft);">No written details provided.</p>'}
      <div class="actions">
        <button class="btn-approve" data-id="${item.id}" data-action="approve">Approve</button>
        <button class="btn-reject" data-id="${item.id}" data-action="reject">Reject</button>
      </div>
    `;
    pendingList.appendChild(card);
  });
}

pendingList.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;
  btn.closest('.pending-card').style.opacity = '0.5';

  if (action === 'approve') {
    await supabase.from('listings').update({ status: 'approved' }).eq('id', id);
  } else {
    await supabase.from('listings').delete().eq('id', id);
  }
  await loadPending();
  await loadOverview();
});

// ============ ALL LISTINGS TAB ============
let allListingsCache = [];

async function loadAllListings() {
  const list = document.getElementById('allListingsList');
  list.innerHTML = '<p class="empty" style="padding:10px 0;">Loading...</p>';

  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    list.innerHTML = `<p class="empty">Could not load listings: ${error.message}</p>`;
    return;
  }

  allListingsCache = data || [];
  renderAllListings();
}

function renderAllListings() {
  const list = document.getElementById('allListingsList');
  const search = document.getElementById('allListingsSearch').value.trim().toLowerCase();

  let filtered = allListingsCache;
  if (search) {
    filtered = allListingsCache.filter(item => {
      const haystack = [
        item.name, item.id, item.location,
        ...(item.systems || []),
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(search);
    });
  }

  if (!filtered.length) {
    list.innerHTML = '<p class="empty" style="padding:20px 0;">No listings match.</p>';
    return;
  }

  list.innerHTML = '';
  filtered.forEach(item => {
    list.appendChild(buildListingRow(item));
  });
}

function buildListingRow(item) {
  const row = document.createElement('div');
  row.className = 'listing-row';
  const roleLabel = item.role === 'dm' ? 'Game Master' : 'Player';
  const systemsText = (item.systems || []).join(', ') || 'Any system';
  row.innerHTML = `
    <div class="listing-row-info">
      <strong>${escapeHtml(item.name)}</strong> · ${roleLabel} · ${escapeHtml(systemsText)}
      <span class="status-tag ${item.status}">${item.status}</span>
    </div>
    <div class="listing-row-actions">
      <button type="button" data-action="edit">Edit</button>
      <button type="button" class="remove-btn" data-action="remove">Remove</button>
    </div>
  `;
  row.querySelector('[data-action="edit"]').addEventListener('click', () => {
    row.replaceWith(buildListingEditCard(item));
  });
  row.querySelector('[data-action="remove"]').addEventListener('click', async () => {
    const ok = confirm(`Remove ${item.name}'s ${roleLabel} listing? This also removes any ally requests or connections tied to it. This can't be undone.`);
    if (!ok) return;
    const { error } = await supabase.from('listings').delete().eq('id', item.id);
    if (error) { alert('Could not remove: ' + error.message); return; }
    allListingsCache = allListingsCache.filter(l => l.id !== item.id);
    renderAllListings();
    loadOverview();
  });
  return row;
}

function buildListingEditCard(item) {
  const card = document.createElement('div');
  card.className = 'edit-listing-card';
  const uid = item.id.replace(/-/g, '_');
  const itemSystems = item.systems || [];
  const customSystems = itemSystems.filter(s => !KNOWN_SYSTEMS.includes(s));

  card.innerHTML = `
    <div class="field"><label>Name</label><input type="text" id="a_name_${uid}" value="${escapeAttr(item.name)}"></div>
    <div class="field">
      <label>Status</label>
      <select id="a_status_${uid}">
        <option value="pending" ${item.status === 'pending' ? 'selected' : ''}>Pending</option>
        <option value="approved" ${item.status === 'approved' ? 'selected' : ''}>Approved</option>
      </select>
    </div>
    <div class="field"><label>Location</label><input type="text" id="a_location_${uid}" value="${escapeAttr(item.location || '')}"></div>
    <div class="field"><label>Schedule</label><input type="text" id="a_schedule_${uid}" value="${escapeAttr(item.schedule || '')}"></div>
    <div class="field"><label>Bio</label><textarea id="a_bio_${uid}">${escapeHtml(item.bio || '')}</textarea></div>
    <div class="field"><label>Contact (private)</label><input type="text" id="a_contact_${uid}" value="${escapeAttr(item.contact || '')}"></div>
    <div class="field"><label>Systems (comma separated — includes any not in the standard list)</label><input type="text" id="a_systems_${uid}" value="${escapeAttr(itemSystems.join(', '))}"></div>
    <div class="modal-actions">
      <button type="button" class="btn-cancel" data-action="cancel">Cancel</button>
      <button type="button" class="btn-submit" data-action="save">Save</button>
    </div>
  `;

  card.querySelector('[data-action="cancel"]').addEventListener('click', () => {
    card.replaceWith(buildListingRow(item));
  });

  card.querySelector('[data-action="save"]').addEventListener('click', async () => {
    const saveBtn = card.querySelector('[data-action="save"]');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    const updates = {
      name: card.querySelector(`#a_name_${uid}`).value.trim(),
      status: card.querySelector(`#a_status_${uid}`).value,
      location: card.querySelector(`#a_location_${uid}`).value.trim(),
      schedule: card.querySelector(`#a_schedule_${uid}`).value.trim(),
      bio: card.querySelector(`#a_bio_${uid}`).value,
      contact: card.querySelector(`#a_contact_${uid}`).value.trim(),
      systems: card.querySelector(`#a_systems_${uid}`).value.split(',').map(s => s.trim()).filter(Boolean),
    };

    const { data, error } = await supabase.from('listings').update(updates).eq('id', item.id).select().single();

    saveBtn.disabled = false;
    saveBtn.textContent = 'Save';

    if (error) {
      alert('Could not save: ' + error.message);
      return;
    }

    const idx = allListingsCache.findIndex(l => l.id === item.id);
    if (idx !== -1) allListingsCache[idx] = data;
    card.replaceWith(buildListingRow(data));
    loadOverview();
  });

  return card;
}

// ============ REPORTS TAB ============
async function loadReports() {
  const list = document.getElementById('reportsList');
  list.innerHTML = '<p class="empty" style="padding:10px 0;">Loading...</p>';

  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: true });

  if (error) {
    list.innerHTML = `<p class="empty">Could not load reports: ${error.message}</p>`;
    return;
  }

  if (!data.length) {
    list.innerHTML = '<p class="empty">Nothing open right now.</p>';
    return;
  }

  list.innerHTML = '';
  data.forEach(item => {
    const card = document.createElement('div');
    card.className = 'report-card';
    const typeLabel = item.report_type === 'listing' ? 'Reported listing' : 'General question';
    const idPart = item.listing_id ? ` · ID ${escapeHtml(item.listing_id)}` : '';
    card.innerHTML = `
      <p class="report-meta">${typeLabel}${idPart}</p>
      <p class="report-message">${escapeHtml(item.message)}</p>
      ${item.contact_for_followup ? `<p class="report-contact">Reply to: ${escapeHtml(item.contact_for_followup)}</p>` : ''}
      <div class="actions">
        ${item.listing_id ? `<button type="button" data-action="view" style="background:transparent; border:1px solid var(--ink);">View listing</button>` : ''}
        <button type="button" class="btn-approve" data-action="resolve">Mark resolved</button>
      </div>
    `;
    const viewBtn = card.querySelector('[data-action="view"]');
    if (viewBtn) {
      viewBtn.addEventListener('click', () => {
        switchToTab('all');
        const searchInput = document.getElementById('allListingsSearch');
        searchInput.value = item.listing_id;
        renderAllListings();
      });
    }
    card.querySelector('[data-action="resolve"]').addEventListener('click', async (e) => {
      e.target.disabled = true;
      const { error: resolveError } = await supabase.from('reports').update({ status: 'resolved' }).eq('id', item.id);
      if (resolveError) { alert('Could not resolve: ' + resolveError.message); e.target.disabled = false; return; }
      card.remove();
      loadOverview();
      if (!document.getElementById('reportsList').children.length) {
        document.getElementById('reportsList').innerHTML = '<p class="empty">Nothing open right now.</p>';
      }
    });
    list.appendChild(card);
  });
}

// ============ SETTINGS TAB: maintenance toggle (unchanged behavior) ============
const statusText = document.getElementById('statusText');
const maintenanceToggle = document.getElementById('maintenanceToggle');

async function refreshStatus() {
  const { data, error } = await supabase
    .from('site_settings')
    .select('maintenance')
    .eq('id', 1)
    .single();

  if (error) {
    statusText.textContent = 'Could not load status';
    return;
  }

  if (data.maintenance) {
    statusText.textContent = 'Site is CLOSED to visitors';
    maintenanceToggle.textContent = 'Open the site';
    maintenanceToggle.style.background = 'var(--forest)';
    maintenanceToggle.style.color = 'var(--parchment)';
  } else {
    statusText.textContent = 'Site is LIVE to visitors';
    maintenanceToggle.textContent = 'Close for testing';
    maintenanceToggle.style.background = 'var(--card-bg)';
    maintenanceToggle.style.color = 'var(--oxblood)';
  }
}

maintenanceToggle.addEventListener('click', async () => {
  maintenanceToggle.disabled = true;

  const { data, error: readError } = await supabase
    .from('site_settings')
    .select('maintenance')
    .eq('id', 1)
    .single();

  if (readError) {
    alert('Could not read current status: ' + readError.message);
    maintenanceToggle.disabled = false;
    return;
  }

  const { error: updateError } = await supabase
    .from('site_settings')
    .update({ maintenance: !data.maintenance })
    .eq('id', 1);

  if (updateError) {
    alert('Could not update: ' + updateError.message);
  }

  await refreshStatus();
  maintenanceToggle.disabled = false;
});

supabase.auth.getSession().then(({ data }) => {
  if (data.session) showAdmin();
});
