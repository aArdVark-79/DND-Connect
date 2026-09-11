import { supabase } from '../config/supabase.js';
import { escapeHtml } from '../utils/html.js';
import {
  KNOWN_SYSTEMS, getListings, setListings, getActiveRole, setActiveRole, setBoardRenderer,
} from '../state/appState.js';
import { buildAllyActionEl } from './allyActions.js';

// ============ WAX SEAL BADGES ============
// Small icon "seals" replace the old plain-text tags on each card.
// Colors: system = oxblood, format = forest, experience = gold, location = oxblood.
const SEAL_ICONS = {
  system: '<path d="M4 20h16M6 20V9l6-5 6 5v11M9 20v-6h6v6"/>',
  online: '<rect x="3" y="4" width="18" height="12" rx="1"/><path d="M8 20h8M12 16v4"/>',
  inPerson: '<path d="M4 21v-4a4 4 0 014-4h8a4 4 0 014 4v4M8 9a4 4 0 108 0 4 4 0 00-8 0z"/>',
  formatFallback: '<circle cx="12" cy="12" r="8"/>',
  expNew: '<path d="M6 17l6-5 6 5M4 19h16"/>',
  expSome: '<path d="M4 19h16M6 19l6-4 6 4M8 15l4-3 4 3"/>',
  expVeteran: '<path d="M6 15l3-9 3 9M18 15l-3-9-3 9M4 19h16"/>',
  location: '<path d="M12 21s-7-5.5-7-11a7 7 0 0114 0c0 5.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.3"/>',
};

function seal(colorClass, iconInner, label) {
  const strokeColor = colorClass === 'c-gold' ? 'var(--ink)' : 'var(--parchment)';
  return `<div class="seal ${colorClass}"><svg viewBox="0 0 24 24" fill="none" stroke="${strokeColor}" stroke-width="2">${iconInner}</svg><span class="tip">${escapeHtml(label)}</span></div>`;
}
function systemSeals(systems) {
  return systems.map(s => seal('c-oxblood', SEAL_ICONS.system, s)).join('');
}
function formatSeals(formats) {
  return formats.map(f => {
    const icon = f === 'Online' ? SEAL_ICONS.online : f === 'In-person' ? SEAL_ICONS.inPerson : SEAL_ICONS.formatFallback;
    return seal('c-forest', icon, f);
  }).join('');
}
function expSeal(exp) {
  const icon = exp === 'Veteran' ? SEAL_ICONS.expVeteran : exp === 'Some experience' ? SEAL_ICONS.expSome : SEAL_ICONS.expNew;
  return seal('c-gold', icon, exp);
}
function locationSeal(location) {
  return location ? seal('c-oxblood', SEAL_ICONS.location, location) : '';
}

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
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <p class="card-role ${l.role === 'player' ? 'player' : ''}">${l.role === 'dm' ? 'Game Master' : 'Player'}</p>
      <p class="card-name">${escapeHtml(l.name)}</p>
      <div class="seals-row">
        ${systemSeals(l.systems || [])}
        ${formatSeals(l.formats || [])}
        ${expSeal(l.exp)}
        ${locationSeal(l.location)}
      </div>
      ${l.bio ? `<p class="card-bio">${escapeHtml(l.bio)}</p>` : ''}
    `;
    const banner = document.createElement('div');
    banner.className = 'ally-banner';
    const scheduleSpan = document.createElement('span');
    scheduleSpan.textContent = l.schedule || 'Schedule flexible';
    banner.appendChild(scheduleSpan);
    banner.appendChild(buildAllyActionEl(l.id));
    card.appendChild(banner);
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
