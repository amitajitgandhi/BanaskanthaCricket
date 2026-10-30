function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

const CATEGORY_ORDER = { 'Platinum+': 0, Platinum: 1, Gold: 2, Silver: 3 };
let originalPlayers = [];
let sortKey = 'full_name';
let sortDirection = 'asc';

const PLAYER_SORTERS = {
  index: (p) => p.__originalIndex,
  form_number: (p) => String(p.form_number || '').toLocaleLowerCase(),
  full_name: (p) => String(p.full_name || '').toLocaleLowerCase(),
  category: (p) => CATEGORY_ORDER[p.category] ?? 99,
  mobile_masked: (p) => String(p.mobile_masked || '').toLocaleLowerCase(),
  cricheroes_link: (p) => String(p.cricheroes_link || '').toLocaleLowerCase(),
  jersey: (p) => `${p.jersey_name || ''} ${p.jersey_number || ''}`.toLocaleLowerCase(),
  jersey_size: (p) => String(p.jersey_size || '').toLocaleLowerCase(),
};

function sortPlayers(key) {
  if (sortKey === key) {
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey = key;
    sortDirection = 'asc';
  }

  const sorter = PLAYER_SORTERS[key];
  const sorted = [...originalPlayers].sort((a, b) => {
    const aValue = sorter(a);
    const bValue = sorter(b);
    let comparison;
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      comparison = aValue - bValue;
    } else {
      comparison = String(aValue).localeCompare(String(bValue), undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  renderPlayers(sorted);
}

function renderPlayers(players) {
  const holder = document.getElementById('playersHolder');
  const columns = [
    { key: 'index', label: '#', aria: 'Sort by row number' },
    { key: 'form_number', label: 'Form Number', aria: 'Sort by form number' },
    { key: 'full_name', label: 'Name', aria: 'Sort by player name' },
    { key: 'category', label: 'Category', aria: 'Sort by category' },
    { key: 'mobile_masked', label: 'Mobile', aria: 'Sort by mobile' },
    { key: 'cricheroes_link', label: 'Cric Heroes', aria: 'Sort by Cric Heroes link' },
    { key: 'jersey', label: 'Jersey', aria: 'Sort by jersey name and number' },
    { key: 'jersey_size', label: 'Size', aria: 'Sort by jersey size' },
  ];

  const categoryOrder = {
  'Platinum+': 1,
  'Platinum': 2,
  'Gold': 3,
  'Silver': 4,
};

const sortedPlayers = [...players].sort((a, b) => {
  const categoryA = categoryOrder[a.category] ?? 99;
  const categoryB = categoryOrder[b.category] ?? 99;

  if (categoryA !== categoryB) {
    return categoryA - categoryB;
  }

  return (a.full_name || '').localeCompare(
    b.full_name || '',
    undefined,
    { sensitivity: 'base' }
  );
});

const rows = sortedPlayers
  .map(
    (p, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(p.form_number || '—')}</td>
        <td>${escapeHtml(p.full_name)}</td>
        <td>${escapeHtml(p.category || '—')}</td>
        <td>${p.mobile_masked ? escapeHtml(p.mobile_masked) : '—'}</td>
        <td>${p.cricheroes_link
          ? `<a href="${escapeHtml(p.cricheroes_link)}" target="_blank" rel="noopener">Profile</a>`
          : '—'}</td>
        <td>${escapeHtml(p.jersey_name)} #${escapeHtml(p.jersey_number)}</td>
        <td>${escapeHtml(p.jersey_size)}</td>
      </tr>
    `
  )
  .join('');

  const headers = columns.map((col) => {
    const active = sortKey === col.key;
    const arrow = active ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : ' ↕';
    return `<th scope="col" aria-sort="${active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}"><button type="button" class="players-sort-btn" data-sort-key="${col.key}" aria-label="${col.aria}">${col.label}<span class="players-sort-indicator" aria-hidden="true">${arrow}</span></button></th>`;
  }).join('');

  holder.innerHTML = `
    <table class="data-table players-sortable-table">
      <thead><tr>${headers}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  holder.querySelectorAll('[data-sort-key]').forEach((button) => {
    button.addEventListener('click', () => sortPlayers(button.dataset.sortKey));
  });
}

async function loadPlayers() {
  const holder = document.getElementById('playersHolder');
  try {
    const res = await fetch('/api/players');
    if (!res.ok) throw new Error('Failed to load players');
    const players = await res.json();

    document.getElementById('playerCount').textContent = players.length ? `(${players.length})` : '';

    if (!players.length) {
      holder.innerHTML = '<div class="empty-state">No players confirmed yet — check back soon.</div>';
      return;
    }

    originalPlayers = players.map((p, index) => ({ ...p, __originalIndex: index }));
    sortKey = 'full_name';
    sortDirection = 'asc';
    renderPlayers([...originalPlayers].sort((a, b) =>
      String(a.full_name || '').localeCompare(String(b.full_name || ''), undefined, { sensitivity: 'base' })
    ));
  } catch (err) {
    holder.innerHTML = '<div class="empty-state">Could not load players — please refresh.</div>';
  }
}

document.addEventListener('DOMContentLoaded', loadPlayers);
