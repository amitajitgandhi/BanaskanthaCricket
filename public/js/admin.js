let authToken = null;
let allEntries = [];

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function fmtDate(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

function authHeaders(extra) {
  return Object.assign({ Authorization: 'Bearer ' + authToken }, extra || {});
}

function showLogin(message) {
  document.getElementById('loginView').hidden = false;
  document.getElementById('dashboardView').hidden = true;
  if (message) {
    const el = document.getElementById('loginMsg');
    el.textContent = message;
    el.className = 'msg error';
  }
}

function showDashboard() {
  document.getElementById('loginView').hidden = true;
  document.getElementById('dashboardView').hidden = false;
}

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('loginUser').value;
  const password = document.getElementById('loginPass').value;

  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const result = await res.json();

  if (!res.ok) {
    showLogin(result.error || 'Login failed.');
    return;
  }

  authToken = result.token;
  sessionStorage.setItem('sbkym_admin_token', authToken);
  showDashboard();
  initDashboard();
}

function handleLogout() {
  authToken = null;
  sessionStorage.removeItem('sbkym_admin_token');
  showLogin();
}

// ---------- registrations ----------

function renderStats(entries) {
  const total = entries.length;
  const confirmed = entries.filter((e) => e.status === 'Approved').length;
  const pending = total - confirmed;
  const fees = entries.filter((e) => e.status === 'Approved').reduce((sum, e) => sum + (Number(e.fee_paid) || 0), 0);

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statVerified').textContent = confirmed;
  document.getElementById('statPending').textContent = pending;
  document.getElementById('statFees').textContent = '₹' + fees.toLocaleString('en-IN');

  const paidOnline = entries.filter((e) => e.payment_collection_status === 'Paid Online').length;
  const paidCashAmit = entries.filter((e) => e.payment_collection_status === 'Paid Cash to Amit').length;
  const paidCashBhavesh = entries.filter((e) => e.payment_collection_status === 'Paid Cash to Bhavesh').length;
  // Anything not one of the three "paid" buckets above counts as payment-pending --
  // covers an explicit 'Pending' value as well as rows from before this column existed.
  const paymentPending = total - paidOnline - paidCashAmit - paidCashBhavesh;

  document.getElementById('statPaidOnline').textContent = paidOnline;
  document.getElementById('statPaidCashAmit').textContent = paidCashAmit;
  document.getElementById('statPaidCashBhavesh').textContent = paidCashBhavesh;
  document.getElementById('statPaymentPending').textContent = paymentPending;
}

// ---------- Confirmations table: sortable + copyable columns ----------

let confirmSortKey = 'created_at';
let confirmSortDir = 'desc';

function compareValues(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

function copyColumnToClipboard(text, th) {
  const originalHtml = th.innerHTML;
  const flash = (label) => {
    th.innerHTML = label;
    setTimeout(() => { th.innerHTML = originalHtml; }, 1200);
  };
  const onDone = (ok) => flash(ok ? 'Copied ✓' : 'Copy failed');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => onDone(true)).catch(() => onDone(false));
  } else {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      onDone(true);
    } catch (err) {
      onDone(false);
    }
  }
}

const CONFIRM_COLUMNS = [
  { key: 'created_at', label: 'Registered',
    getValue: (e) => new Date(e.created_at).getTime() || 0,
    getText: (e) => fmtDate(e.created_at),
    renderCell: (e) => escapeHtml(fmtDate(e.created_at)) },
  { key: 'form_number', label: 'Form Number', getValue: (e) => e.form_number || '', getText: (e) => e.form_number || '', renderCell: (e) => escapeHtml(e.form_number) },
  { key: 'full_name', label: 'Name',
    getValue: (e) => (e.full_name || '').toLowerCase(),
    getText: (e) => e.full_name || '',
    renderCell: (e) => escapeHtml(e.full_name) },
  { key: 'status', label: 'Status',
    getValue: (e) => e.status || '',
    getText: (e) => e.status || 'Pending',
    renderCell: (e) => `
          <select class="status-select ${e.status === 'Approved' ? 'pill-green' : 'pill-gold'}" data-id="${e.id}" style="background:transparent; border:1px solid var(--border); border-radius:8px; padding:4px 8px; font-family:var(--font-ui); font-size:.72rem; font-weight:700; color:${e.status === 'Approved' ? '#86efac' : 'var(--gold)'};">
            <option value="Pending" ${e.status !== 'Approved' ? 'selected' : ''}>Pending</option>
            <option value="Approved" ${e.status === 'Approved' ? 'selected' : ''}>Approved</option>
          </select>` },
  { key: 'category', label: 'Category',
    getValue: (e) => e.category || '',
    getText: (e) => e.category || '',
    renderCell: (e) => `
          <select class="category-select" data-id="${e.id}" aria-label="Category for ${escapeHtml(e.full_name || 'registration')}" style="background:transparent; border:1px solid var(--border); border-radius:8px; padding:4px 8px; font-family:var(--font-ui); font-size:.72rem; font-weight:700; color:${e.category ? 'var(--gold)' : 'var(--muted)'};">
            <option value="" ${!e.category ? 'selected' : ''}>— Select —</option>
            <option value="Platinum+" ${e.category === 'Platinum+' ? 'selected' : ''}>Platinum+</option>
            <option value="Platinum" ${e.category === 'Platinum' ? 'selected' : ''}>Platinum</option>
            <option value="Gold" ${e.category === 'Gold' ? 'selected' : ''}>Gold</option>
            <option value="Silver" ${e.category === 'Silver' ? 'selected' : ''}>Silver</option>
          </select>` },
  { key: 'payment_collection_status', label: 'Payment',
    getValue: (e) => e.payment_collection_status || 'Pending',
    getText: (e) => e.payment_collection_status || 'Pending',
    renderCell: (e) => `
          <select class="payment-select ${(e.payment_collection_status || 'Pending') === 'Pending' ? 'pill-gold' : 'pill-green'}" data-id="${e.id}" style="background:transparent; border:1px solid var(--border); border-radius:8px; padding:4px 8px; font-family:var(--font-ui); font-size:.72rem; font-weight:700; color:${(e.payment_collection_status || 'Pending') === 'Pending' ? 'var(--gold)' : '#86efac'};">
            <option value="Pending" ${(e.payment_collection_status || 'Pending') === 'Pending' ? 'selected' : ''}>Pending</option>
            <option value="Paid Online" ${e.payment_collection_status === 'Paid Online' ? 'selected' : ''}>Paid Online</option>
            <option value="Paid Cash to Amit" ${e.payment_collection_status === 'Paid Cash to Amit' ? 'selected' : ''}>Paid Cash to Amit</option>
            <option value="Paid Cash to Bhavesh" ${e.payment_collection_status === 'Paid Cash to Bhavesh' ? 'selected' : ''}>Paid Cash to Bhavesh</option>
          </select>` },
  { key: 'gotra', label: 'Gotra', getValue: (e) => e.gotra || '', getText: (e) => e.gotra || '', renderCell: (e) => escapeHtml(e.gotra) },
  { key: 'mobile_number', label: 'Mobile',
    getValue: (e) => e.mobile_number || '', getText: (e) => e.mobile_number || '',
    renderCell: (e) => escapeHtml(e.mobile_number) },
  { key: 'dob', label: 'DOB',
    getValue: (e) => e.dob || '', getText: (e) => e.dob || '',
    renderCell: (e) => escapeHtml(e.dob) },
  { key: 'skillset', label: 'Skillset',
    getValue: (e) => e.skillset || '', getText: (e) => e.skillset || '',
    renderCell: (e) => escapeHtml(e.skillset) },
  { key: 'bowling_arm', label: 'Bowling Arm',
    getValue: (e) => e.bowling_arm || '', getText: (e) => e.bowling_arm || '',
    renderCell: (e) => escapeHtml(e.bowling_arm) },
  { key: 'batting_style', label: 'Batting Style',
    getValue: (e) => e.batting_style || '', getText: (e) => e.batting_style || '',
    renderCell: (e) => escapeHtml(e.batting_style) },
  { key: 'jersey_number', label: 'Jersey',
    getValue: (e) => Number(e.jersey_number) || 0,
    getText: (e) => `${e.jersey_name || ''} #${e.jersey_number || ''} (${e.jersey_size || ''})`,
    renderCell: (e) => `${escapeHtml(e.jersey_name)} #${escapeHtml(e.jersey_number)} (${escapeHtml(e.jersey_size)})` },
  { key: 'cricheroes_link', label: 'Cric Heroes',
    getValue: (e) => e.cricheroes_link || '', getText: (e) => e.cricheroes_link || '',
    renderCell: (e) => e.cricheroes_link ? `<a href="${escapeHtml(e.cricheroes_link)}" target="_blank" rel="noopener">Link</a>` : '—' },
  { key: 'payment_id', label: 'Payment ID',
    getValue: (e) => e.payment_id || '', getText: (e) => e.payment_id || '',
    renderCell: (e) => e.payment_id ? escapeHtml(e.payment_id) : '—' },
  { key: 'payment_id_auto_detected', label: 'OCR',
    getValue: (e) => (e.payment_id_auto_detected === true ? 2 : e.payment_id_auto_detected === false ? 1 : 0),
    getText: (e) => (e.payment_id_auto_detected === true ? 'Auto' : e.payment_id_auto_detected === false ? 'Manual' : 'N/A'),
    renderCell: (e) => (e.payment_id_auto_detected === true ? '✓ Auto' : e.payment_id_auto_detected === false ? '✍️ Manual' : '—') },
  { key: 'qr_label', label: 'QR',
    getValue: (e) => e.qr_label || '', getText: (e) => e.qr_label || '',
    renderCell: (e) => e.qr_label ? escapeHtml(e.qr_label) : '—' },
  { key: 'fee_paid', label: 'Fee',
    getValue: (e) => Number(e.fee_paid) || 0, getText: (e) => String(e.fee_paid ?? ''),
    renderCell: (e) => '₹' + e.fee_paid },
  { key: 'photo_path', label: 'Photo',
    getValue: (e) => (e.photo_path ? 1 : 0), getText: (e) => (e.photo_path ? 'Yes' : 'No'),
    renderCell: (e) => (e.photo_path ? `<button class="btn small view-photo" data-id="${e.id}">View</button>` : '—') },
  { key: 'screenshot_path', label: 'Screenshot',
    getValue: (e) => (e.screenshot_path ? 1 : 0), getText: (e) => (e.screenshot_path ? 'Yes' : 'No'),
    renderCell: (e) => (e.screenshot_path ? `<button class="btn small view-screenshot" data-id="${e.id}">View</button>` : '—') },
];

// Which Confirmations-table columns the admin has chosen to hide, persisted
// per-browser (localStorage) so the chosen view survives a page refresh.
// Independent of the CSV export's own column selector below -- hiding a
// column on-screen doesn't affect what gets exported, and vice versa.
const CONFIRM_HIDDEN_COLS_KEY = 'sbkymConfirmHiddenColumns';

function loadHiddenColumns() {
  try {
    const raw = localStorage.getItem(CONFIRM_HIDDEN_COLS_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch (err) {
    // localStorage unavailable (private browsing, etc.) -- fall back to
    // showing every column rather than failing to render the table.
  }
  return new Set();
}

function saveHiddenColumns() {
  try {
    localStorage.setItem(CONFIRM_HIDDEN_COLS_KEY, JSON.stringify(Array.from(hiddenColumns)));
  } catch (err) {
    // Nothing to persist to -- the choice just won't survive a refresh.
  }
}

let hiddenColumns = loadHiddenColumns();

function renderColumnsMenu() {
  const menu = document.getElementById('columnsMenu');
  if (!menu) return;

  menu.innerHTML = `
    <div class="export-columns-grid">
      ${CONFIRM_COLUMNS.map((c) => `
        <label><input type="checkbox" class="col-toggle" data-key="${c.key}" ${hiddenColumns.has(c.key) ? '' : 'checked'} /> ${escapeHtml(c.label)}</label>
      `).join('')}
    </div>
    <div class="col-picker-actions">
      <button type="button" class="btn small" id="colShowAll">Show all</button>
      <button type="button" class="btn small" id="colHideAll">Hide all</button>
    </div>
  `;

  menu.querySelectorAll('.col-toggle').forEach((cb) => {
    cb.addEventListener('change', () => {
      if (cb.checked) hiddenColumns.delete(cb.dataset.key);
      else hiddenColumns.add(cb.dataset.key);
      saveHiddenColumns();
      applyFilter();
    });
  });
  menu.querySelector('#colShowAll').addEventListener('click', () => {
    hiddenColumns.clear();
    saveHiddenColumns();
    renderColumnsMenu();
    applyFilter();
  });
  menu.querySelector('#colHideAll').addEventListener('click', () => {
    // Keep Name visible -- hiding every column (including it) would leave
    // an all-but-empty-looking table with no way to tell rows apart.
    CONFIRM_COLUMNS.forEach((c) => { if (c.key !== 'full_name') hiddenColumns.add(c.key); });
    saveHiddenColumns();
    renderColumnsMenu();
    applyFilter();
  });
}

function renderTable(entries) {
  const holder = document.getElementById('tableHolder');
  document.getElementById('countLabel').textContent = `${entries.length} shown`;

  if (!entries.length) {
    holder.innerHTML = '<div class="empty-state">No registrations match.</div>';
    return;
  }

  const sortCol = CONFIRM_COLUMNS.find((c) => c.key === confirmSortKey) || CONFIRM_COLUMNS[0];
  const sorted = entries.slice().sort((a, b) => {
    const cmp = compareValues(sortCol.getValue(a), sortCol.getValue(b));
    return confirmSortDir === 'asc' ? cmp : -cmp;
  });

  const visibleColumns = CONFIRM_COLUMNS.filter((c) => !hiddenColumns.has(c.key));

  const rows = sorted
    .map((e) => `
      <tr>
        ${visibleColumns.map((c) => `<td>${c.renderCell(e)}</td>`).join('')}
        <td class="row-actions">
          <button class="btn small edit-reg" data-id="${e.id}">Edit</button>
          <button class="btn small danger delete-reg" data-id="${e.id}">Delete</button>
        </td>
      </tr>
    `)
    .join('');

  const theadCells = visibleColumns.map((c) => {
    const active = c.key === confirmSortKey;
    const arrow = active ? (confirmSortDir === 'asc' ? ' ▲' : ' ▼') : '';
    return `<th class="sortable-th${active ? ' sorted' : ''}" data-key="${c.key}" title="Click to sort — right-click to copy this column">${escapeHtml(c.label)}${arrow}</th>`;
  }).join('');

  holder.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>${theadCells}<th>Actions</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  holder.querySelectorAll('.sortable-th').forEach((th) => {
    th.addEventListener('click', () => {
      const key = th.dataset.key;
      if (confirmSortKey === key) {
        confirmSortDir = confirmSortDir === 'asc' ? 'desc' : 'asc';
      } else {
        confirmSortKey = key;
        confirmSortDir = 'asc';
      }
      renderTable(entries);
    });

    th.addEventListener('contextmenu', (ev) => {
      ev.preventDefault();
      const col = CONFIRM_COLUMNS.find((c) => c.key === th.dataset.key);
      if (!col) return;
      const text = sorted.map((e) => col.getText(e)).join('\n');
      copyColumnToClipboard(text, th);
    });
  });

  holder.querySelectorAll('.status-select').forEach((sel) => {
    sel.addEventListener('change', async () => {
      const id = sel.dataset.id;
      await fetch(`/api/admin/registrations/${id}/status`, {
        method: 'PATCH',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ status: sel.value }),
      });
      await loadRegistrations();
    });
  });

  holder.querySelectorAll('.category-select').forEach((sel) => {
    sel.addEventListener('change', async () => {
      const id = sel.dataset.id;
      const previousValue = allEntries.find((e) => String(e.id) === String(id))?.category || '';
      sel.disabled = true;
      try {
        const res = await fetch(`/api/admin/registrations/${id}/status`, {
          method: 'PATCH',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ category: sel.value || null }),
        });
        if (res.status === 401) return handleLogout();
        if (!res.ok) {
          const result = await res.json().catch(() => ({}));
          alert(result.error || 'Could not update category.');
          sel.value = previousValue;
          return;
        }
        const result = await res.json().catch(() => ({}));
        const entry = allEntries.find((e) => String(e.id) === String(id));
        if (entry) entry.category = result.category ?? (sel.value || null);
        applyFilter();
      } catch (err) {
        alert('Could not update category — please try again.');
        sel.value = previousValue;
      } finally {
        sel.disabled = false;
      }
    });
  });

  holder.querySelectorAll('.payment-select').forEach((sel) => {
    sel.addEventListener('change', async () => {
      const id = sel.dataset.id;
      await fetch(`/api/admin/registrations/${id}/status`, {
        method: 'PATCH',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ paymentCollectionStatus: sel.value }),
      });
      await loadRegistrations();
    });
  });

  holder.querySelectorAll('.view-screenshot').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const res = await fetch(`/api/admin/registrations/${btn.dataset.id}/screenshot`, { headers: authHeaders() });
      const result = await res.json();
      if (res.ok && result.url) {
        window.open(result.url, '_blank', 'noopener');
      } else {
        alert(result.error || 'Could not load screenshot.');
      }
    });
  });

  holder.querySelectorAll('.view-photo').forEach((btn) => {
    btn.addEventListener('click', () => {
      const entry = allEntries.find((e) => String(e.id) === String(btn.dataset.id));
      if (entry && entry.photo_path) {
        fetch(`/api/admin/registrations/${entry.id}/photo`, { headers: authHeaders() }).then((res) => res.json()).then((result) => { if (result.url) window.open(result.url, '_blank', 'noopener'); else alert(result.error || 'Could not load photo.'); }).catch(() => alert('Could not load photo.'));
      } else {
        alert('No photo on file.');
      }
    });
  });

  holder.querySelectorAll('.edit-reg').forEach((btn) => {
    btn.addEventListener('click', () => {
      const entry = allEntries.find((e) => String(e.id) === String(btn.dataset.id));
      if (entry) openEditModal(entry);
    });
  });

  holder.querySelectorAll('.delete-reg').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const entry = allEntries.find((e) => String(e.id) === String(btn.dataset.id));
      const name = entry ? entry.full_name : 'this registration';
      if (!confirm(`Delete ${name}'s registration? This permanently removes their entry, photo and screenshot, and cannot be undone.`)) return;
      btn.disabled = true;
      try {
        const res = await fetch(`/api/admin/registrations/${btn.dataset.id}/status`, {
          method: 'DELETE',
          headers: authHeaders(),
        });
        if (res.status === 401) return handleLogout();
        if (!res.ok) {
          const result = await res.json().catch(() => ({}));
          alert(result.error || 'Could not delete registration.');
          btn.disabled = false;
          return;
        }
        await loadRegistrations();
      } catch (err) {
        alert('Could not delete registration — please try again.');
        btn.disabled = false;
      }
    });
  });
}

// ---------- edit registration modal ----------

function openEditModal(entry) {
  document.getElementById('editRegId').value = entry.id;
  document.getElementById('editFullName').value = entry.full_name || '';
  document.getElementById('editMobileNumber').value = entry.mobile_number || '';
  document.getElementById('editDob').value = entry.dob || '';
  document.getElementById('editSkillset').value = entry.skillset || '';
  document.getElementById('editBowlingArm').value = entry.bowling_arm || '';
  document.getElementById('editBattingStyle').value = entry.batting_style || '';
  document.getElementById('editJerseyName').value = entry.jersey_name || '';
  document.getElementById('editJerseyNumber').value = entry.jersey_number || '';
  document.getElementById('editJerseySize').value = entry.jersey_size || '';
  document.getElementById('editCricheroesLink').value = entry.cricheroes_link || '';
  document.getElementById('editPaymentId').value = entry.payment_id || '';
  document.getElementById('editQrLabel').value = entry.qr_label || '';
  document.getElementById('editRegMsg').textContent = '';
  document.getElementById('editRegMsg').className = 'msg';
  document.getElementById('editRegModal').hidden = false;
}

function closeEditModal() {
  document.getElementById('editRegModal').hidden = true;
}

async function handleSaveEdit() {
  const id = document.getElementById('editRegId').value;
  const btn = document.getElementById('saveEditBtn');
  const msg = document.getElementById('editRegMsg');

  const payload = {
    fullName: document.getElementById('editFullName').value,
    mobileNumber: document.getElementById('editMobileNumber').value,
    dob: document.getElementById('editDob').value,
    skillset: document.getElementById('editSkillset').value,
    bowlingArm: document.getElementById('editBowlingArm').value,
    battingStyle: document.getElementById('editBattingStyle').value,
    jerseyName: document.getElementById('editJerseyName').value,
    jerseyNumber: document.getElementById('editJerseyNumber').value,
    jerseySize: document.getElementById('editJerseySize').value,
    cricheroesLink: document.getElementById('editCricheroesLink').value,
    paymentId: document.getElementById('editPaymentId').value,
    qrLabel: document.getElementById('editQrLabel').value,
  };

  btn.disabled = true;
  msg.textContent = 'Saving…';
  msg.className = 'msg';
  try {
    const res = await fetch(`/api/admin/registrations/${id}/status`, {
      method: 'PATCH',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
    });
    if (res.status === 401) return handleLogout();
    if (!res.ok) {
      const result = await res.json().catch(() => ({}));
      msg.textContent = result.error || 'Could not save changes.';
      msg.className = 'msg error';
      return;
    }
    closeEditModal();
    await loadRegistrations();
  } catch (err) {
    msg.textContent = 'Could not save changes — please try again.';
    msg.className = 'msg error';
  } finally {
    btn.disabled = false;
  }
}

function applyFilter() {
  const q = document.getElementById('searchBox').value.trim().toLowerCase();
  const paymentFilter = document.getElementById('paymentFilter').value;

  let filtered = allEntries;
  if (paymentFilter !== 'all') {
    filtered = filtered.filter((e) => (e.payment_collection_status || 'Pending') === paymentFilter);
  }
  if (q) {
    filtered = filtered.filter((e) =>
      [e.full_name, e.mobile_number, e.payment_id, e.jersey_name, e.qr_label].some((f) => String(f || '').toLowerCase().includes(q))
    );
  }
  renderTable(filtered);
}

async function loadRegistrations() {
  const btn = document.getElementById('refreshConfirmBtn');
  if (btn) { btn.disabled = true; btn.textContent = '↻ Refreshing…'; }
  try {
    const res = await fetch('/api/admin/registrations', { headers: authHeaders() });
    if (res.status === 401) return handleLogout();
    allEntries = await res.json();
    renderStats(allEntries);
    applyFilter();
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '↻ Refresh'; }
  }
}

// Export happens entirely client-side from the registrations already
// loaded into allEntries — no server round trip, so adding/removing
// columns or filters here never needs an API change.
const EXPORT_COLUMNS = [
  { key: 'created_at', label: 'Registered' },
  { key: 'full_name', label: 'Name' },
  { key: 'mobile_number', label: 'Mobile' },
  { key: 'dob', label: 'DOB' },
  { key: 'skillset', label: 'Skillset' },
  { key: 'bowling_arm', label: 'Bowling Arm' },
  { key: 'batting_style', label: 'Batting Style' },
  { key: 'jersey_name', label: 'Jersey Name' },
  { key: 'jersey_number', label: 'Jersey Number' },
  { key: 'jersey_size', label: 'Jersey Size' },
  { key: 'cricheroes_link', label: 'Cric Heroes Link' },
  { key: 'payment_id', label: 'Payment ID' },
  { key: 'payment_id_auto_detected', label: 'OCR Auto-Detected' },
  { key: 'qr_label', label: 'QR / Payment Method' },
  { key: 'fee_paid', label: 'Fee' },
  { key: 'status', label: 'Status' },
  { key: 'category', label: 'Category' },
  { key: 'payment_collection_status', label: 'Payment Collection Status' },
  { key: 'photo_path', label: 'Photo Path' },
  { key: 'screenshot_path', label: 'Screenshot Path' },
];

function csvEscape(value) {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) return '"' + str.replace(/"/g, '""') + '"';
  return str;
}

function exportValue(row, key) {
  if (key === 'created_at') return fmtDate(row.created_at);
  if (key === 'payment_collection_status') return row.payment_collection_status || 'Pending';
  return row[key];
}

function renderExportColumns() {
  const grid = document.getElementById('exportColumnsGrid');
  grid.innerHTML = EXPORT_COLUMNS.map((c) => `
    <label>
      <input type="checkbox" value="${c.key}" ${c.key === 'photo_path' || c.key === 'screenshot_path' ? '' : 'checked'} />
      ${escapeHtml(c.label)}
    </label>
  `).join('');
}

function toggleExportPanel(show) {
  document.getElementById('exportPanel').hidden = !show;
}

function handleDownloadExport() {
  const statusFilter = document.getElementById('exportStatusFilter').value;
  const search = document.getElementById('exportSearchFilter').value.trim().toLowerCase();
  const checkedKeys = Array.from(document.querySelectorAll('#exportColumnsGrid input[type="checkbox"]:checked')).map((cb) => cb.value);

  if (!checkedKeys.length) {
    alert('Select at least one column to export.');
    return;
  }

  let rows = allEntries.slice();
  if (statusFilter !== 'all') rows = rows.filter((e) => e.status === statusFilter);
  if (search) {
    rows = rows.filter((e) =>
      [e.full_name, e.mobile_number, e.jersey_name, e.qr_label].some((f) => String(f || '').toLowerCase().includes(search))
    );
  }
  rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (!rows.length) {
    alert('No registrations match these filters.');
    return;
  }

  const columns = EXPORT_COLUMNS.filter((c) => checkedKeys.includes(c.key));
  const lines = [columns.map((c) => csvEscape(c.label)).join(',')];
  rows.forEach((row) => {
    lines.push(columns.map((c) => csvEscape(exportValue(row, c.key))).join(','));
  });

  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'clbpl-registrations.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------- tabs ----------

function switchTab(name) {
  document.querySelectorAll('.tab-panel').forEach((el) => {
    el.hidden = el.id !== `tab-${name}`;
  });
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === name);
  });
}

// ---------- QR code management ----------

async function loadQrAdmin() {
  const res = await fetch('/api/admin/qr-codes', { headers: authHeaders() });
  if (res.status === 401) return handleLogout();
  const codes = await res.json();
  const grid = document.getElementById('qrAdminGrid');

  if (!codes.length) {
    grid.innerHTML = '<div class="empty-state" style="padding:12px 0;">No QR codes uploaded yet.</div>';
    return;
  }

  grid.innerHTML = codes
    .map(
      (q) => `
      <div class="qr-admin-card ${q.active ? 'active' : ''}">
        <img src="${q.url}" alt="${escapeHtml(q.label || 'QR code')}" />
        <div class="qr-admin-label">${escapeHtml(q.label || 'Untitled')}</div>
        <div class="qr-admin-actions">
          <button class="btn small ${q.active ? 'gold' : ''}" data-toggle="${q.id}" data-active="${q.active}">
            ${q.active ? 'Shown ✓' : 'Show on page'}
          </button>
          <button class="btn small danger" data-delete="${q.id}">Delete</button>
        </div>
      </div>
    `
    )
    .join('');

  grid.querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.toggle;
      const newVal = btn.dataset.active !== 'true';
      await fetch(`/api/admin/qr-codes/${id}`, {
        method: 'PATCH',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ active: newVal }),
      });
      await loadQrAdmin();
    });
  });

  grid.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this QR code?')) return;
      await fetch(`/api/admin/qr-codes/${btn.dataset.delete}`, { method: 'DELETE', headers: authHeaders() });
      await loadQrAdmin();
    });
  });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handleQrUpload(e) {
  e.preventDefault();
  const fileInput = document.getElementById('qrFile');
  if (!fileInput.files.length) return;
  const file = fileInput.files[0];

  const label = document.getElementById('qrLabel').value.trim();
  if (!label) {
    alert('Please enter a label for this QR code (e.g. the bank/account name) — it is how registrations get tracked back to it.');
    return;
  }

  const imageBase64 = await fileToBase64(file);
  const res = await fetch('/api/admin/qr-codes', {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ label, imageBase64, mimeType: file.type }),
  });

  if (res.ok) {
    document.getElementById('qrUploadForm').reset();
    await loadQrAdmin();
  } else {
    const result = await res.json().catch(() => ({}));
    alert(result.error || 'Upload failed.');
  }
}

// ---------- team names ----------

async function loadTeamNames() {
  const grid = document.getElementById('teamNamesGrid');
  const res = await fetch('/api/admin/team-names', { headers: authHeaders() });
  if (res.status === 401) return handleLogout();
  const rows = await res.json();

  grid.innerHTML = rows
    .map(
      (r) => `
      <div class="team-name-field">
        <label for="team-${r.placeholder}">${escapeHtml(r.placeholder)}</label>
        <input type="text" id="team-${r.placeholder}" data-placeholder="${r.placeholder}"
               value="${escapeHtml(r.teamName)}" placeholder="Actual team name" />
      </div>
    `
    )
    .join('');
}

async function handleSaveTeamNames() {
  const btn = document.getElementById('saveTeamNamesBtn');
  const msg = document.getElementById('teamNamesMsg');
  const inputs = document.querySelectorAll('#teamNamesGrid input[data-placeholder]');

  const teams = Array.from(inputs).map((input) => ({
    placeholder: input.dataset.placeholder,
    teamName: input.value,
  }));

  btn.disabled = true;
  msg.textContent = 'Saving…';
  try {
    const res = await fetch('/api/admin/team-names', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ teams }),
    });
    if (res.status === 401) return handleLogout();
    if (!res.ok) {
      const result = await res.json().catch(() => ({}));
      msg.textContent = result.error || 'Could not save team names.';
      return;
    }
    msg.textContent = 'Saved ✓';
    setTimeout(() => { msg.textContent = ''; }, 3000);
  } catch (err) {
    msg.textContent = 'Could not save team names — please try again.';
  } finally {
    btn.disabled = false;
  }
}

// ---------- init ----------

async function loadPhotoBase() {
  try {
    const res = await fetch('/api/config');
    const cfg = await res.json();
    window.__CLBPL_PHOTO_BASE__ = '';
  } catch (err) {
    window.__CLBPL_PHOTO_BASE__ = '';
  }
}

let registrationOpenState = true;

function renderRegistrationStatus() {
  const pill = document.getElementById('registrationStatusPill');
  const btn = document.getElementById('toggleRegistrationBtn');
  if (!pill || !btn) return;

  if (registrationOpenState) {
    pill.textContent = 'Registrations OPEN';
    pill.className = 'pill pill-green';
    btn.textContent = '⏹ Stop Registrations';
    btn.className = 'btn small danger';
  } else {
    pill.textContent = 'Registrations STOPPED';
    pill.className = 'pill pill-red';
    btn.textContent = '▶ Start Registrations';
    btn.className = 'btn small gold';
  }
  btn.disabled = false;
}

async function loadRegistrationStatus() {
  try {
    const res = await fetch('/api/admin/registration-status', { headers: authHeaders() });
    if (res.status === 401) return handleLogout();
    const data = await res.json();
    registrationOpenState = data.registrationOpen !== false;
  } catch (err) {
    console.error(err);
    registrationOpenState = true;
  }
  renderRegistrationStatus();
}

async function toggleRegistrationStatus() {
  const btn = document.getElementById('toggleRegistrationBtn');
  const next = !registrationOpenState;
  const confirmMsg = next
    ? 'Start accepting registrations again?'
    : 'Stop accepting registrations? Visitors to /register will see a "Registration is full" message instead of the form.';
  if (!confirm(confirmMsg)) return;

  btn.disabled = true;
  try {
    const res = await fetch('/api/admin/registration-status', {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ registrationOpen: next }),
    });
    if (res.status === 401) return handleLogout();
    const result = await res.json();
    if (!res.ok) {
      alert(result.error || 'Could not update registration status.');
      btn.disabled = false;
      return;
    }
    registrationOpenState = next;
    renderRegistrationStatus();
  } catch (err) {
    console.error(err);
    alert('Could not update registration status. Please try again.');
    btn.disabled = false;
  }
}

function initDashboard() {
  loadPhotoBase();
  loadRegistrations();
  loadQrAdmin();
  loadTeamNames();
  renderExportColumns();
  loadRegistrationStatus();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);
  document.getElementById('searchBox').addEventListener('input', applyFilter);
  document.getElementById('refreshConfirmBtn').addEventListener('click', loadRegistrations);
  document.getElementById('toggleRegistrationBtn').addEventListener('click', toggleRegistrationStatus);
  document.getElementById('columnsBtn').addEventListener('click', (ev) => {
    ev.stopPropagation();
    const menu = document.getElementById('columnsMenu');
    const opening = menu.hidden;
    if (opening) renderColumnsMenu();
    menu.hidden = !opening;
  });
  document.addEventListener('click', (ev) => {
    const menu = document.getElementById('columnsMenu');
    const btn = document.getElementById('columnsBtn');
    if (menu && !menu.hidden && !menu.contains(ev.target) && ev.target !== btn) {
      menu.hidden = true;
    }
  });
  document.getElementById('saveEditBtn').addEventListener('click', handleSaveEdit);
  document.getElementById('cancelEditBtn').addEventListener('click', closeEditModal);
  const paymentFilter = document.getElementById('paymentFilter');
  if (paymentFilter) paymentFilter.addEventListener('change', applyFilter);
  document.getElementById('qrUploadForm').addEventListener('submit', handleQrUpload);
  document.getElementById('saveTeamNamesBtn').addEventListener('click', handleSaveTeamNames);
  document.getElementById('openExportBtn').addEventListener('click', () => toggleExportPanel(true));
  document.getElementById('cancelExportBtn').addEventListener('click', () => toggleExportPanel(false));
  document.getElementById('downloadExportBtn').addEventListener('click', handleDownloadExport);
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  const saved = sessionStorage.getItem('sbkym_admin_token');
  if (saved) {
    authToken = saved;
    showDashboard();
    initDashboard();
  } else {
    showLogin();
  }
});