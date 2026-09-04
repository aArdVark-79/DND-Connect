import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

  const SUPABASE_URL = 'https://hmweboxsztxkgtgnkbvz.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhtd2Vib3hzenR4a2d0Z25rYnZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc3NzkwOTksImV4cCI6MjEwMzM1NTA5OX0.l6jQ7KQJ82vahll6F-5chFFDGsmC1cdTkUOcr327KLk';

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const loginBox = document.getElementById('loginBox');
  const adminPanel = document.getElementById('adminPanel');
  const loginError = document.getElementById('loginError');
  const pendingList = document.getElementById('pendingList');

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

  const statusText = document.getElementById('statusText');
  const maintenanceToggle = document.getElementById('maintenanceToggle');

  async function showAdmin() {
    loginBox.style.display = 'none';
    adminPanel.style.display = 'block';
    await loadPending();
    await refreshStatus();
  }

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
  });

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  supabase.auth.getSession().then(({ data }) => {
    if (data.session) showAdmin();
  });