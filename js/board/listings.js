import { supabase } from '../config/supabase.js';
import { escapeHtml } from '../utils/html.js';
import {
  KNOWN_SYSTEMS, getListings, setListings, getActiveRole, setActiveRole, setBoardRenderer,
} from '../state/appState.js';
import { buildAllyActionEl } from './allyActions.js';

// ============ BOARD: filters, sorting, rendering ============
const grid = document.getElementById('grid');
const countLine = document.getElementById('countLine');
const emptyMsg = document.getElementById('emptyMsg');
const roleToggle = document.getElementById('roleToggle');
const systemFilter = document.getElementById('systemFilter');
const formatFilter = document.getElementById('formatFilter');
const expFilter = document.getElementById('expFilter');
const sortOrder = document.getElementById('sortOrder');

export async function loadListings() {
  const { data, error } = await supabase
    .from('listings')
    .select('id, role, name, systems, formats, location, exp, schedule, bio, created_at')
    .eq('status', 'approved')
    .eq('active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Could not load listings:', error);
    return;
  }
  setListings(data);
  render();
}

export function render() {
  const listings = getListings();
  const activeRole = getActiveRole();
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

roleToggle.addEventListener('click', (e) => {
  if (e.target.tagName !== 'BUTTON') return;
  [...roleToggle.children].forEach(b => b.classList.remove('active'));
  e.target.classList.add('active');
  setActiveRole(e.target.dataset.role);
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

setBoardRenderer(render);
