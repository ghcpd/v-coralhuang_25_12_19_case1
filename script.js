// Auto-check import status on page load
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('/api/auto_import_status');
    const status = await res.json();
    if (status.has_data) {
      document.getElementById('importResult').textContent =
        `Data loaded: ${status.jd_count} JDs, ${status.candidate_count} Candidates`;
      // Auto-load candidates
      await loadCandidates();
    }
  } catch (e) {
    console.error('Failed to check import status:', e);
  }
});

async function importExcel() {
  const f = document.getElementById('excelFile').files[0];
  if (!f) {
    showInlineError('importResult', 'Please choose an .xlsx file');
    return;
  }
  const btn = document.getElementById('importButton');
  btn.disabled = true;
  const fd = new FormData();
  fd.append('excel', f);
  try {
    const res = await fetch('/api/import', { method: 'POST', body: fd });
    const j = await res.json();
    document.getElementById('importResult').textContent = res.ok
      ? `Imported JDs=${j.imported_jds}, Candidates=${j.imported_candidates}`
      : `Error: ${j.detail || JSON.stringify(j)}`;

    // Auto-reload candidates after import
    if (res.ok) {
      await loadCandidates();
    }
  } catch (e) {
    showInlineError('importResult', 'Import failed');
    console.error(e);
  } finally {
    btn.disabled = false;
  }
}

async function checkAutoImport() {
  try {
    const res = await fetch('/api/auto_import_status');
    const status = await res.json();
    document.getElementById('importResult').textContent = status.has_data
      ? `Data loaded: ${status.jd_count} JDs, ${status.candidate_count} Candidates`
      : 'No data imported yet.';
    if (status.has_data) await loadCandidates();
  } catch (e) {
    showInlineError('importResult', 'Failed to get status');
  }
}

// Frontend state
let loadingCandidates = false;
let debounceTimer = null;
let currentPage = 1;
let pageSize = parseInt(document.getElementById('pageSize').value, 10) || 10;
let pageCount = 1;
let totalCount = 0;
let selected = new Set();
let lastRequestId = 0;

// Wire up search input with debouncing (300ms)
document.getElementById('searchBox').addEventListener('input', (e) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    currentPage = 1;
    loadCandidates();
  }, 300);
});

// Wire other controls
document.getElementById('pageSize').addEventListener('change', (e) => {
  pageSize = parseInt(e.target.value, 10);
  currentPage = 1;
  loadCandidates();
});
document.getElementById('sortBy').addEventListener('change', () => { currentPage = 1; loadCandidates(); });

async function loadCandidates() {
  const reqId = ++lastRequestId;
  if (loadingCandidates) return;
  loadingCandidates = true;
  document.getElementById('searchSpinner').style.display = '';

  const jd = document.getElementById('jdFilter').value.trim();
  const search = document.getElementById('searchBox').value.trim();
  const sort = document.getElementById('sortBy').value;

  const params = new URLSearchParams();
  if (jd) params.set('jd', jd);
  if (search) params.set('search', search);
  if (sort) params.set('sort', sort);
  params.set('page', String(currentPage));
  params.set('page_size', String(pageSize));

  try {
    const res = await fetch('/api/candidates?' + params.toString());
    if (reqId !== lastRequestId) return; // stale response
    const j = await res.json();

    totalCount = j.count || 0;
    pageCount = j.page_count || 1;
    document.getElementById('pageInfo').textContent = `Page ${j.page} of ${pageCount} — ${totalCount} total`;

    const tbody = document.querySelector('#candTable tbody');
    tbody.innerHTML = '';

    selected = new Set([...selected].filter(id => false)); // reset selection per page; preserve globally if needed

    (j.items || []).forEach(r => {
      const tr = document.createElement('tr');

      const checked = selected.has(r.candidate_id) ? 'checked' : '';
      const submission = r.submission_date ? formatDate(r.submission_date) : '';
      const statusHtml = renderStatusBadge(r.current_status || '');

      tr.innerHTML = `
        <td><input type="checkbox" class="rowCheck" data-cid="${r.candidate_id}" ${checked}></td>
        <td><div><b>${escapeHtml(r.candidate_id)}</b> ${escapeHtml(r.name)}</div><div class="muted">${escapeHtml(r.email)}</div></td>
        <td>${escapeHtml(r.jd_id)}</td>
        <td>${escapeHtml(submission)}</td>
        <td class="statusCell">${statusHtml}</td>
        <td class="actions">
          <button onclick="quickMatch('${r.candidate_id}')" class="secondary">Match</button>
          <button onclick="prefillUpdate('${r.candidate_id}','${r.current_status || ''}')">Update</button>
        </td>`;
      tbody.appendChild(tr);
    });

    // attach row checkbox handlers
    document.querySelectorAll('.rowCheck').forEach(cb => cb.addEventListener('change', (e) => {
      const cid = e.target.dataset.cid;
      if (e.target.checked) selected.add(cid); else selected.delete(cid);
      updateSelectedCount();
    }));

    updateSelectedCount();
  } catch (e) {
    console.error('Failed to load candidates', e);
  } finally {
    loadingCandidates = false;
    document.getElementById('searchSpinner').style.display = 'none';
  }
}

function renderStatusBadge(status) {
  const s = (status || '').trim();
  let cls = 'status-badge ';
  if (s === 'Submitted') cls += 'status-submitted';
  else if (s === 'Interviewing') cls += 'status-interviewing';
  else if (s === 'Rejected') cls += 'status-rejected';
  else if (s === 'Accepted') cls += 'status-accepted';
  else cls += 'status-submitted';
  return `<span class="${cls}">${escapeHtml(s)}</span>`;
}

function updateSelectedCount() {
  document.getElementById('selectedCount').textContent = `${selected.size} selected`;
  const checks = Array.from(document.querySelectorAll('.rowCheck'));
  const master = document.getElementById('selectAllCheckbox');
  if (checks.length === 0) { master.checked = false; master.indeterminate = false; return; }
  const checkedCount = checks.filter(c => c.checked).length;
  master.checked = checkedCount === checks.length;
  master.indeterminate = checkedCount > 0 && checkedCount < checks.length;
}

function selectAll() {
  document.querySelectorAll('.rowCheck').forEach(cb => { cb.checked = true; selected.add(cb.dataset.cid); });
  updateSelectedCount();
}

function deselectAll() {
  document.querySelectorAll('.rowCheck').forEach(cb => { cb.checked = false; selected.delete(cb.dataset.cid); });
  updateSelectedCount();
}

function toggleSelectAll() {
  const master = document.getElementById('selectAllCheckbox');
  if (master.checked) selectAll(); else deselectAll();
}

async function bulkUpdate() {
  const ids = Array.from(selected);
  if (!ids.length) {
    showInlineError('selectedCount', 'No candidates selected');
    return;
  }
  const status = document.getElementById('bulkStatus').value;
  const reason = document.getElementById('bulkReason').value.trim();
  if (!status) { showInlineError('selectedCount', 'Choose a status to apply'); return; }

  const btn = document.getElementById('bulkApply');
  const spinner = document.getElementById('bulkSpinner');
  btn.disabled = true; spinner.style.display = '';
  try {
    const res = await fetch('/api/bulk_update_status', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidate_ids: ids, status: status, reason: reason })
    });
    if (!res.ok) {
      const j = await res.json();
      showInlineError('selectedCount', j.detail || 'Bulk update failed');
    } else {
      // success
      selected.clear();
      loadCandidates();
      loadReport();
    }
  } catch (e) {
    showInlineError('selectedCount', 'Bulk update failed');
  } finally {
    btn.disabled = false; spinner.style.display = 'none';
  }
}

function prevPage() {
  if (currentPage > 1) { currentPage--; loadCandidates(); }
}

function nextPage() {
  if (currentPage < pageCount) { currentPage++; loadCandidates(); }
}

async function loadReport() {
  const jd = document.getElementById('jdReport').value.trim();
  const url = jd ? `/api/report?jd=${encodeURIComponent(jd)}` : '/api/report';
  try {
    const res = await fetch(url);
    const j = await res.json();
    renderReport(j);
  } catch (e) {
    console.error('Failed to load report', e);
  }
}

function renderReport(data) {
  const container = document.getElementById('reportCharts');
  container.innerHTML = '';
  const summary = data.status_summary || [];
  const total = summary.reduce((s, x) => s + x.count, 0) || 0;

  const dist = document.createElement('div');
  dist.innerHTML = '<h3>Status Distribution</h3>';
  if (!total) {
    const empty = document.createElement('div');
    empty.className = 'muted';
    empty.textContent = 'No candidates to report.';
    dist.appendChild(empty);
  } else {
    summary.forEach(s => {
      const pct = total ? Math.round((s.count / total) * 100) : 0;
      const row = document.createElement('div');
      row.style.marginBottom = '8px';
      row.innerHTML = `<div style="display:flex;justify-content:space-between"><div>${escapeHtml(s.current_status)}</div><div>${s.count} (${pct}%)</div></div><div class="progress" style="margin-top:6px"><i style="width:${pct}%"></i></div>`;
      dist.appendChild(row);
    });
  }

  // trend chart (simple bars)
  const trend = document.createElement('div');
  trend.innerHTML = '<h3>Submission Trend</h3>';
  const trendList = data.submission_trend || [];
  const max = Math.max(1, ...trendList.map(t => t.submissions));
  const barWrap = document.createElement('div');
  trendList.forEach(t => {
    const bar = document.createElement('div');
    bar.style.display = 'flex';
    bar.style.alignItems = 'center';
    const label = document.createElement('div');
    label.style.width = '120px';
    label.textContent = formatDate(t.submission_date);
    const b = document.createElement('div');
    b.style.height = '14px';
    b.style.width = `${Math.round((t.submissions / max) * 100)}%`;
    b.style.background = '#cfe3ff';
    b.style.borderRadius = '6px';
    b.style.marginLeft = '8px';
    bar.appendChild(label); bar.appendChild(b);
    barWrap.appendChild(bar);
  });
  trend.appendChild(barWrap);

  container.appendChild(dist); container.appendChild(trend);
}

async function doMatch() {
  const cid = document.getElementById('matchCandidate').value.trim();
  if (!cid) {
    showInlineError('matchBox', 'Enter Candidate_ID');
    return;
  }
  await quickMatch(cid);
}

async function quickMatch(cid) {
  const container = document.getElementById('matchBox');
  container.innerHTML = '<div class="muted">Loading...</div>';
  try {
    const res = await fetch(`/api/match/${encodeURIComponent(cid)}`);
    if (!res.ok) {
      const j = await res.json(); container.innerHTML = `<div class="error">${j.detail || 'Match failed'}</div>`; return;
    }
    const j = await res.json();
    renderMatch(j);
  } catch (e) {
    container.innerHTML = '<div class="error">Match failed</div>';
  }
}

function renderMatch(m) {
  const cskills = (m.candidate_skills || []).join(', ');
  const jdMust = (m.jd_must_skills || []).join(', ');
  const jdNice = (m.jd_nice_skills || []).join(', ');
  const container = document.getElementById('matchBox');
  container.innerHTML = `
    <h3>${escapeHtml(m.candidate_id)} — ${escapeHtml(m.jd_title || m.jd_id || '')}</h3>
    <div style="display:flex;gap:12px;align-items:center;margin-bottom:8px">
      <div style="flex:1">
        <div style="font-size:13px;color:#444">Match: <strong>${escapeHtml(m.match_label)}</strong></div>
        <div class="progress" style="margin-top:6px"><i style="width:${m.match_score}%"></i></div>
      </div>
      <div style="font-size:12px;color:#666">Score: ${m.match_score}%</div>
    </div>
    <div style="font-size:13px;color:#333"><strong>Candidate skills:</strong> ${escapeHtml(cskills)}</div>
    <div style="font-size:13px;color:#333;margin-top:6px"><strong>Required (must):</strong> ${escapeHtml(jdMust)}</div>
    <div style="font-size:13px;color:#333;margin-top:6px"><strong>Nice to have:</strong> ${escapeHtml(jdNice)}</div>
  `;
}

function prefillUpdate(cid, status) {
  document.getElementById('updCandidate').value = cid;
  if (status) {
    document.getElementById('updStatus').value = status;
  }
  document.getElementById('updReason').value = '';
  document.getElementById('updResult').textContent = '';
  document.getElementById('updateError').style.display = 'none';
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}

async function updateStatus() {
  const cid = document.getElementById('updCandidate').value.trim();
  const status = document.getElementById('updStatus').value;
  const reason = document.getElementById('updReason').value.trim();
  const btn = document.getElementById('updateButton');
  const spinner = document.getElementById('updSpinner');
  document.getElementById('updateError').style.display = 'none';
  if (!cid) {
    showInlineError('updateError', 'Enter Candidate_ID');
    return;
  }
  btn.disabled = true; spinner.style.display = '';
  try {
    const res = await fetch('/api/update_status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candidate_id: cid, status: status, reason: reason }) });
    const j = await res.json();
    if (!res.ok) {
      showInlineError('updateError', j.detail || 'Update failed');
    } else {
      document.getElementById('updResult').textContent = 'Updated.';
      loadCandidates(); loadReport();
    }
  } catch (e) {
    showInlineError('updateError', 'Update failed');
  } finally {
    btn.disabled = false; spinner.style.display = 'none';
  }
}

function escapeHtml(s) {
  return (s || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function showInlineError(elementId, message) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message;
  el.style.display = '';
  setTimeout(() => { if (el.textContent === message) el.style.display = 'none'; }, 5000);
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' });
  } catch (e) { return iso; }
}
