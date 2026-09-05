
// Board: loading listings, filtering, sorting, and rendering the cards.
import { supabase } from '../config/supabase.js';
import { escapeHtml } from '../utils/html.js';
import {
  KNOWN_SYSTEMS, getListings, setListings, getActiveRole, setActiveRole, setBoardRenderer,
} from '../state/appState.js';
import { buildAllyActionEl } from './allyActions.js';

let grid, countLine, emptyMsg, roleToggle, systemFilter, formatFilter, expFilter, sortOrder;
let filterToggleBtn, filtersPanel;

export async function loadListings() {
  const { data, error } = await supabase
    .from('listings')
    .select('id, role, name, systems, formats, location, exp, schedule, bio, created_at')
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Could not load listings:', error);
    return;
  }
  setListings(data);
  render();
}

// ============ WAX SEAL BADGES ============
// One icon per fact about the listing (system, format, experience,
// location) instead of a row of text tags. Each is a small stamped-seal
// circle; the label only shows on hover via the .seal .tip CSS rule in
// style.css — this just builds the markup + tooltip text.

const SEAL_ICON_SYSTEM = '<path d="M4 20h16M6 20V9l6-5 6 5v11M9 20v-6h6v6"/>';
const SEAL_ICON_ONLINE = '<rect x="3" y="4" width="18" height="12" rx="1"/><path d="M8 20h8M12 16v4"/>';
const SEAL_ICON_IN_PERSON = '<path d="M4 21v-4a4 4 0 014-4h8a4 4 0 014 4v4M8 9a4 4 0 108 0 4 4 0 00-8 0z"/>';
const SEAL_ICON_LOCATION = '<path d="M12 21s-7-5.5-7-11a7 7 0 0114 0c0 5.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.3"/>';
// Chevron count signals experience tier: 1 = New, 2 = Some experience, 3 = Veteran.
const SEAL_ICON_EXP = {
  'New': '<path d="M6 15l6-6 6 6"/>',
  'Some experience': '<path d="M6 17l6-6 6 6"/><path d="M6 11l6-6 6 6"/>',
  'Veteran': '<path d="M6 19l6-6 6 6"/><path d="M6 13l6-6 6 6"/><path d="M6 7l6-6 6 6"/>',
};

function sealHtml(colorClass, iconPaths, label) {
  return `
    <div class="seal ${colorClass}">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="2">${iconPaths}</svg>
      <span class="tip">${escapeHtml(label)}</span>
    </div>
  `;
}

function buildSealsRow(l) {
  const seals = [];

  (l.systems || []).forEach(s => seals.push(sealHtml('c-oxblood', SEAL_ICON_SYSTEM, s)));
  (l.formats || []).forEach(f => {
    const icon = f === 'Online' ? SEAL_ICON_ONLINE : SEAL_ICON_IN_PERSON;
    seals.push(sealHtml('c-forest', icon, f));
  });
  if (l.exp) {
    seals.push(sealHtml('c-gold', SEAL_ICON_EXP[l.exp] || SEAL_ICON_EXP['New'], l.exp));
  }
  if (l.location) {
    seals.push(sealHtml('c-oxblood', SEAL_ICON_LOCATION, l.location));
  }

  return `<div class="seals-row">${seals.join('')}</div>`;
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
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <p class="card-role ${l.role === 'player' ? 'player' : ''}">${l.role === 'dm' ? 'Game Master' : 'Player'}</p>
      <p class="card-name">${escapeHtml(l.name)}</p>
      ${buildSealsRow(l)}
      <div class="card-expand">
        ${l.bio ? `<p class="card-bio">${escapeHtml(l.bio)}</p>` : ''}
      </div>
    `;
    card.appendChild(buildAllyActionEl(l.id));
    grid.appendChild(card);
  });
}

export function initBoard() {
  grid = document.getElementById('grid');
  countLine = document.getElementById('countLine');
  emptyMsg = document.getElementById('emptyMsg');
  roleToggle = document.getElementById('roleToggle');
  systemFilter = document.getElementById('systemFilter');
  formatFilter = document.getElementById('formatFilter');
  expFilter = document.getElementById('expFilter');
  sortOrder = document.getElementById('sortOrder');
  filterToggleBtn = document.getElementById('filterToggleBtn');
  filtersPanel = document.getElementById('filtersPanel');

  setBoardRenderer(render);

  roleToggle.addEventListener('click', (e) => {
    if (e.target.tagName !== 'BUTTON') return;
    [...roleToggle.children].forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    setActiveRole(e.target.dataset.role);
    render();
  });

  [systemFilter, formatFilter, expFilter, sortOrder].forEach(el => el.addEventListener('change', render));

  filterToggleBtn.addEventListener('click', () => {
    const isOpen = filtersPanel.classList.toggle('open');
    filterToggleBtn.classList.toggle('active', isOpen);
    filterToggleBtn.textContent = isOpen ? 'Filters ▴' : 'Filters ▾';
  });
}
