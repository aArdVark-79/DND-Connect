```js
// Board: loading listings, filtering, sorting, and rendering the cards.
import { supabase } from '../config/supabase.js';
import { escapeHtml } from '../utils/html.js';
import {
  KNOWN_SYSTEMS,
  getListings,
  setListings,
  getActiveRole,
  setActiveRole,
  setBoardRenderer,
} from '../state/appState.js';
import { buildAllyActionEl } from './allyActions.js';

let grid;
let countLine;
let emptyMsg;
let roleToggle;
let systemFilterGroup;
let formatFilterGroup;
let expFilterGroup;
let locationFilter;
let sortOrder;
let filterToggleBtn;
let filtersPanel;

export async function loadListings() {
  const { data, error } = await supabase
    .from('listings')
    .select(
      'id, role, name, systems, formats, location, exp, schedule, bio, created_at'
    )
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Could not load listings:', error);
    return;
  }

  console.log('Board loaded listings:', data);

  setListings(data || []);
  render();
}

export function render() {
  // Make sure the board HTML exists before trying to render.
  if (
    !grid ||
    !countLine ||
    !emptyMsg ||
    !roleToggle ||
    !systemFilterGroup ||
    !formatFilterGroup ||
    !expFilterGroup ||
    !locationFilter ||
    !sortOrder
  ) {
    console.error('Board elements are missing from the page.');
    return;
  }

  const listings = getListings();
  const activeRole = getActiveRole();

  const selectedSystems = [
    ...systemFilterGroup.querySelectorAll('input:checked'),
  ].map(input => input.value);

  const selectedFormats = [
    ...formatFilterGroup.querySelectorAll('input:checked'),
  ].map(input => input.value);

  const selectedExperience = [
    ...expFilterGroup.querySelectorAll('input:checked'),
  ].map(input => input.value);

  const locationSearch = locationFilter.value.trim().toLowerCase();

  let filtered = listings.filter(listing => {
    // Role filter
    if (
      activeRole !== 'all' &&
      listing.role !== activeRole
    ) {
      return false;
    }

    // Location filter
    if (
      locationSearch &&
      !(listing.location || '').toLowerCase().includes(locationSearch)
    ) {
      return false;
    }

    // System filter
    const systems = Array.isArray(listing.systems)
      ? listing.systems
      : [];

    if (selectedSystems.length) {
      const matchesSystem = selectedSystems.some(selected => {
        if (selected === 'Other') {
          return systems.some(
            system => !KNOWN_SYSTEMS.includes(system)
          );
        }

        return systems.includes(selected);
      });

      if (!matchesSystem) {
        return false;
      }
    }

    // Format filter
    const formats = Array.isArray(listing.formats)
      ? listing.formats
      : [];

    if (
      selectedFormats.length &&
      !selectedFormats.some(format => formats.includes(format))
    ) {
      return false;
    }

    // Experience filter
    if (
      selectedExperience.length &&
      !selectedExperience.includes(listing.exp)
    ) {
      return false;
    }

    return true;
  });

  // Sorting
  if (sortOrder.value === 'alpha') {
    filtered = filtered
      .slice()
      .sort((a, b) =>
        (a.name || '').localeCompare(b.name || '')
      );
  } else {
    filtered = filtered
      .slice()
      .sort(
        (a, b) =>
          new Date(b.created_at) - new Date(a.created_at)
      );
  }

  // Update count
  countLine.textContent =
    filtered.length +
    (filtered.length === 1
      ? ' listing on the board'
      : ' listings on the board');

  // Clear existing cards
  grid.innerHTML = '';

  // Show/hide empty message
  emptyMsg.style.display =
    filtered.length ? 'none' : 'block';

  // Render cards
  filtered.forEach(listing => {
    const systemsText =
      (Array.isArray(listing.systems)
        ? listing.systems
        : []
      ).join(', ') || 'Any system';

    const formatsText =
      (Array.isArray(listing.formats)
        ? listing.formats
        : []
      ).join(' / ') || 'Format flexible';

    const card = document.createElement('div');
    card.className = 'card';

    card.innerHTML = `
      <p class="card-role ${
        listing.role === 'player' ? 'player' : ''
      }">
        ${
          listing.role === 'dm'
            ? 'Game Master'
            : 'Player'
        }
      </p>

      <p class="card-name">
        ${escapeHtml(listing.name || 'Unnamed listing')}
      </p>

      <p class="card-line">
        <strong>${escapeHtml(systemsText)}</strong>
        ·
        ${escapeHtml(formatsText)}
      </p>

      <p class="card-line">
        ${escapeHtml(listing.exp || 'Experience flexible')}
        ·
        ${escapeHtml(
          listing.schedule || 'Schedule flexible'
        )}
      </p>

      ${
        listing.location
          ? `<p class="card-line">
              📍 ${escapeHtml(listing.location)}
            </p>`
          : ''
      }

      <div class="tags">
        ${
          (Array.isArray(listing.systems)
            ? listing.systems
            : []
          )
            .map(
              system =>
                `<span class="tag">${escapeHtml(system)}</span>`
            )
            .join('')
        }

        ${
          (Array.isArray(listing.formats)
            ? listing.formats
            : []
          )
            .map(
              format =>
                `<span class="tag">${escapeHtml(format)}</span>`
            )
            .join('')
        }

        ${
          listing.exp
            ? `<span class="tag">${escapeHtml(
                listing.exp
              )}</span>`
            : ''
        }
      </div>

      ${
        listing.bio
          ? `<p class="card-bio">
              ${escapeHtml(listing.bio)}
            </p>`
          : ''
      }
    `;

    card.appendChild(
      buildAllyActionEl(listing.id)
    );

    grid.appendChild(card);
  });
}

export function initBoard() {
  grid = document.getElementById('grid');
  countLine = document.getElementById('countLine');
  emptyMsg = document.getElementById('emptyMsg');
  roleToggle = document.getElementById('roleToggle');

  systemFilterGroup =
    document.getElementById('systemFilterGroup');

  formatFilterGroup =
    document.getElementById('formatFilterGroup');

  expFilterGroup =
    document.getElementById('expFilterGroup');

  locationFilter =
    document.getElementById('locationFilter');

  sortOrder =
    document.getElementById('sortOrder');

  filterToggleBtn =
    document.getElementById('filterToggleBtn');

  filtersPanel =
    document.getElementById('filtersPanel');

  // Make render available to other modules.
  setBoardRenderer(render);

  // Role buttons
  roleToggle.addEventListener('click', event => {
    if (event.target.tagName !== 'BUTTON') {
      return;
    }

    [...roleToggle.children].forEach(button => {
      button.classList.remove('active');
    });

    event.target.classList.add('active');

    setActiveRole(
      event.target.dataset.role
    );

    render();
  });

  // Checkbox filters
  [
    systemFilterGroup,
    formatFilterGroup,
    expFilterGroup,
  ].forEach(group => {
    group.addEventListener('change', render);
  });

  // Location search
  locationFilter.addEventListener(
    'input',
    render
  );

  // Sorting
  sortOrder.addEventListener(
    'change',
    render
  );

  // Open/close filters
  filterToggleBtn.addEventListener(
    'click',
    () => {
      const isOpen =
        filtersPanel.classList.toggle('open');

      filterToggleBtn.classList.toggle(
        'active',
        isOpen
      );

      filterToggleBtn.textContent =
        isOpen
          ? 'Filters ▴'
          : 'Filters ▾';
    }
  );
}
```
