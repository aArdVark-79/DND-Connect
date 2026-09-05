// Board: loading listings, filtering, sorting, and rendering the cards.
import { supabase } from '../config/supabase.js';
import { escapeHtml } from '../utils/html.js';
import {
  KNOWN_SYSTEMS, getListings, setListings, getActiveRole, setActiveRole, setBoardRenderer,
} from '../state/appState.js';
import { buildAllyActionEl } from './allyActions.js';

let grid, countLine, emptyMsg, roleToggle, systemFilterGroup, formatFilterGroup, expFilterGroup, sortOrder;
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

export function render() {
  const listings = getListings();
  const activeRole = getActiveRole();
  const sys = [...systemFilterGroup.querySelectorAll('input:checked')].map(i => i.value);
const fmt = [...formatFilterGroup.querySelectorAll('input:checked')].map(i => i.value);
const exp = [...expFilterGroup.querySelectorAll('input:checked')].map(i => i.value);

  let filtered = listings.filter(l => {
    if (activeRole !== 'all' && l.role !== activeRole) return false;

    const systemsArr = l.systems || [];
   if (sys.length) {
  const matchesSystem = sys.some(selected =>
    selected === 'Other'
      ? systemsArr.some(s => !KNOWN_SYSTEMS.includes(s))
      : systemsArr.includes(selected)
  );

  if (!matchesSystem) return false;
}

    const formatsArr = l.formats || [];
   if (fmt.length && !fmt.some(f => formatsArr.includes(f))) return false;

if (exp.length && !exp.includes(l.exp)) return false;
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

export function initBoard() {
  grid = document.getElementById('grid');
  countLine = document.getElementById('countLine');
  emptyMsg = document.getElementById('emptyMsg');
  roleToggle = document.getElementById('roleToggle');
  systemFilterGroup = document.getElementById('systemFilterGroup');
  formatFilterGroup = document.getElementById('formatFilterGroup');
  expFilterGroup = document.getElementById('expFilterGroup');
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

[systemFilterGroup, formatFilterGroup, expFilterGroup].forEach(group => {
  group.addEventListener('change', render);
});

sortOrder.addEventListener('change', render);
  
  filterToggleBtn.addEventListener('click', () => {
    const isOpen = filtersPanel.classList.toggle('open');
    filterToggleBtn.classList.toggle('active', isOpen);
    filterToggleBtn.textContent = isOpen ? 'Filters ▴' : 'Filters ▾';
  });
}
