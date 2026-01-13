// Small utility helpers and global state
const state = {
  q: '',
  jd: '',
  sort: '',
  page: 1,
  page_size: 10,
  total: 0,
  loading: false,
  selected: new Set(),
  debounceTimer: null,
};

function setLoading(on, target = null) {
  state.loading = on;
  document.querySelectorAll('button, input, select').forEach(el => {
    // Keep file input enabled
    if (el.id === 'excelFile') return;
    if (on) el.setAttribute('disabled', 'disabled'); else el.removeAttribute('disabled');
  });
  const tbody = document.querySelector('#candTable tbody');
  if (on) {
    tbody.innerHTML = '<tr><td colspan="6" class="muted">Loading…</td></tr>';
  }
}

function formatDate(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (e) {
    return iso;
  }
}

function statusBadge(status) {
  const s = escapeHtml(status || '');
  const cls = { Submitted: 'status-submitted', Interviewing: 'status-interviewing', Rejected: 'status-rejected', Accepted: 'status-accepted' }[status] || '';
  return `<span class="pill status-badge ${cls}">${s}</span>`;
}

function escapeHtml(s) {
  return (s || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// --- Initialization ---
window.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('searchBox').addEventListener('input', (e) => {
    // Debounce 300ms
    clearTimeout(state.debounceTimer);
    state.debounceTimer = setTimeout(() => {
      state.q = e.target.value.trim();
      state.page = 1;
      loadCandidates();
    }, 300);
  });

  document.getElementById('pageSize').addEventListener('change', (e) => {
    state.page_size = parseInt(e.target.value, 10) || 10;
    state.page = 1;
    loadCandidates();
  });

  document.getElementById('sortBy').addEventListener('change', (e) => {
    state.sort = e.target.value;
    state.page = 1;
    loadCandidates();
  });

  document.getElementById('selectAllCheckbox').addEventListener('change', (e) => toggleSelectAll(e.target.checked));

  try {
    const res = await fetch('/api/auto_import_status');
    const status = await res.json();
    if (status.has_data) {
      document.getElementById('importResult').textContent = `Data loaded: ${status.jd_count} JDs, ${status.candidate_count} Candidates`;
    }
  } catch (e) {
    console.error('Failed to check import status:', e);
  }

  // initial load
  await loadCandidates();
  await loadReport();
});

// --- Candidate list ---
async function loadCandidates() {
  setLoading(true);
  state.selected.clear();
  document.getElementById('selectedCount').textContent = '0 selected';

  const jd = document.getElementById('jdFilter').value.trim();
  const params = new URLSearchParams();
  if (jd) params.append('jd', jd);
  if (state.q) params.append('q', state.q);
  if (state.sort) params.append('sort', state.sort);
  params.append('page', String(state.page));
  params.append('page_size', String(state.page_size));

  try {
    const res = await fetch(`/api/candidates?${params.toString()}`);
    const j = await res.json();
    const tbody = document.querySelector('#candTable tbody');
    tbody.innerHTML = '';

    const items = j.items || [];
    state.total = j.total || 0;

    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="muted">No candidates found.</td></tr>`;
      document.getElementById('pageInfo').textContent = 'Page 0 of 0';
      setLoading(false);
      return;
    }

    for (const r of items) {
      const tr = document.createElement('tr');
      tr.dataset.cid = r.candidate_id;
      tr.setAttribute('data-last-updated', r.last_updated || '');
      tr.innerHTML = `
        <td><input type="checkbox" class="row-checkbox" data-cid="${escapeHtml(r.candidate_id)}"></td>
        <td>
          <div><b>${escapeHtml(r.candidate_id)}</b> ${escapeHtml(r.name)}</div>
          <div class="muted">${escapeHtml(r.email)}</div>
        </td>
        <td><span class="pill">${escapeHtml(r.jd_id)}</span></td>
        <td>${formatDate(r.submission_date)}</td>
        <td>${statusBadge(r.current_status)}</td>
        <td class="actions">
          <button class="btn-small" data-cid="${escapeHtml(r.candidate_id)}" onclick="quickMatch('${r.candidate_id}')">Match</button>
          <button class="btn-small" data-cid="${escapeHtml(r.candidate_id)}" onclick="prefillUpdate('${r.candidate_id}','${r.current_status || ''}')">Update</button>
        </td>
      `;
      tbody.appendChild(tr);
    }

    // Hook up row checkbox events
    document.querySelectorAll('.row-checkbox').forEach(cb => cb.addEventListener('change', (e) => {
      const id = e.target.dataset.cid;
      if (e.target.checked) state.selected.add(id); else state.selected.delete(id);
      document.getElementById('selectedCount').textContent = `${state.selected.size} selected`;
    }));

    // Pagination info
    const totalPages = Math.max(1, Math.ceil((state.total || 0) / state.page_size));
    document.getElementById('pageInfo').textContent = `Page ${state.page} of ${totalPages}`;

  } catch (e) {
    console.error('Failed to load candidates', e);
    document.querySelector('#candTable tbody').innerHTML = `<tr><td colspan="6" class="muted">Failed to load candidates.</td></tr>`;
  } finally {
    setLoading(false);
  }
}

// --- Pagination actions ---
function prevPage() {
  if (state.page > 1) {
    state.page -= 1;
    loadCandidates();
  }
}
function nextPage() {
  const totalPages = Math.max(1, Math.ceil((state.total || 0) / state.page_size));
  if (state.page < totalPages) {
    state.page += 1;
    loadCandidates();
  }
}

// --- Selection / bulk ---
function toggleSelectAll(checked) {
  document.querySelectorAll('.row-checkbox').forEach(cb => {
    cb.checked = checked;
    const id = cb.dataset.cid;
    if (checked) state.selected.add(id); else state.selected.delete(id);
  });
  document.getElementById('selectedCount').textContent = `${state.selected.size} selected`;
}

function selectAll() {
  toggleSelectAll(true);
}
function deselectAll() {
  toggleSelectAll(false);
}

async function bulkUpdate() {
  const ids = Array.from(state.selected);
  if (!ids.length) {
    document.getElementById('updResult').textContent = 'Select candidates first.';
    return;
  }
  const status = document.getElementById('updStatus').value;
  const reason = document.getElementById('updReason').value.trim();
  setLoading(true);
  try {
    const res = await fetch('/api/bulk_update_status', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidate_ids: ids, status, reason })
    });
    if (!res.ok) {
      const err = await res.json();
      document.getElementById('updResult').textContent = `Error: ${err.detail || JSON.stringify(err)}`;
      return;
    }
    const j = await res.json();
    document.getElementById('updResult').textContent = `Bulk update applied to ${j.total} candidates.`;
    await loadCandidates();
    await loadReport();
  } catch (e) {
    console.error('Bulk update failed', e);
    document.getElementById('updResult').textContent = 'Bulk update failed.';
  } finally {
    setLoading(false);
  }
}

// --- Update single status ---
async function updateStatus() {
  const cid = document.getElementById('updCandidate').value.trim();
  const status = document.getElementById('updStatus').value;
  const reason = document.getElementById('updReason').value.trim();
  if (!cid) {
    document.getElementById('updResult').textContent = 'Enter Candidate_ID';
    return;
  }
  setLoading(true);
  try {
    // optimistic: include last_updated if available in table row
    const row = document.querySelector(`tr[data-cid="${cid}"]`);
    const expected_last_updated = row ? row.dataset.lastUpdated : undefined;
    const payload = { candidate_id: cid, status, reason };
    if (expected_last_updated) payload.expected_last_updated = expected_last_updated;

    const res = await fetch('/api/update_status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const j = await res.json();
    if (!res.ok) {
      document.getElementById('updResult').textContent = `Error: ${j.detail || JSON.stringify(j)}`;
      return;
    }
    document.getElementById('updResult').textContent = 'Updated.';
    await loadCandidates();
    await loadReport();
  } catch (e) {
    console.error('Update failed', e);
    document.getElementById('updResult').textContent = 'Update failed.';
  } finally {
    setLoading(false);
  }
}

function prefillUpdate(cid, status) {
  document.getElementById('updCandidate').value = cid;
  if (status) document.getElementById('updStatus').value = status;
  document.getElementById('updReason').value = '';
  document.getElementById('updResult').textContent = '';
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}

// --- Match display ---
async function doMatch() {
  const cid = document.getElementById('matchCandidate').value.trim();
  if (!cid) {
    document.getElementById('matchBox').textContent = 'Enter Candidate_ID';
    return;
  }
  await quickMatch(cid);
}

async function quickMatch(cid) {
  const box = document.getElementById('matchBox');
  box.innerHTML = 'Loading…';
  try {
    const res = await fetch(`/api/match/${encodeURIComponent(cid)}`);
    const j = await res.json();
    if (!res.ok) {
      box.textContent = `Error: ${j.detail || JSON.stringify(j)}`;
      return;
    }
    // Format match result: Score bar, label, formatted skills in explain
    const score = j.match_score;
    const label = escapeHtml(j.match_label);
    const explain = j.explain || {};
    const human = `
      <div><b>Candidate</b>: ${escapeHtml(j.candidate_id)}</div>
      <div><b>JD</b>: ${escapeHtml(j.jd_id)} — ${escapeHtml(j.jd_title)}</div>
      <div style="margin-top:8px"><b>Match</b>: ${label} — <b>${score}%</b></div>
      <div class="progress" style="margin-top:6px"><div class="progress-bar" style="width:${score}%"></div></div>
      <div style="margin-top:8px"><b>Details:</b></div>
      <div class="muted" style="font-size:13px">Must-hit: ${explain.must_have_hit}/${explain.must_have_total} — Nice-hit: ${explain.nice_to_have_hit}/${explain.nice_to_have_total}</div>
    `;
    box.innerHTML = human;
  } catch (e) {
    console.error('Match failed', e);
    box.textContent = 'Match failed.';
  }
}

// --- Report ---
async function loadReport() {
  const jd = document.getElementById('jdReport').value.trim();
  const url = jd ? `/api/report?jd=${encodeURIComponent(jd)}` : '/api/report';
  const box = document.getElementById('reportBox');
  box.innerHTML = 'Loading…';
  try {
    const res = await fetch(url);
    const j = await res.json();
    // Build a small status distribution bar chart and trend sparkline
    const statusSummary = j.status_summary || [];
    const total = statusSummary.reduce((a,b)=>a+b.count, 0) || 0;
    let bars = '';
    const color = { Submitted: '#2b7bff', Interviewing: '#f6c945', Rejected: '#ff5a5f', Accepted: '#33cc66' };
    for (const s of statusSummary) {
      const pct = total ? Math.round((s.count/total)*100) : 0;
      bars += `<div style="display:flex;align-items:center;margin-bottom:6px"><div style="width:110px">${escapeHtml(s.current_status)}</div><div style="flex:1;background:#f1f4f8;border-radius:6px;margin-left:8px;height:14px;overflow:hidden"><div style="height:14px;background:${color[s.current_status]||'#ccc'};width:${pct}%"></div></div><div style="width:48px;text-align:right;margin-left:8px">${s.count}</div></div>`;
    }

    // Trend sparklines using simple inline SVG
    const trend = j.submission_trend || [];
    let spark = '';
    if (trend.length) {
      const values = trend.map(t=>t.submissions);
      const max = Math.max(...values);
      const points = values.map((v,i)=>`${(i/(values.length-1))*100},${100 - (v/max*100)}`).join(' ');
      spark = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="height:64px;width:100%;background:#fff;border-radius:6px"><polyline fill="none" stroke="#2b7bff" stroke-width="2" points="${points}"/></svg>`;
    }

    box.innerHTML = `<div style="display:flex;gap:12px;align-items:flex-start"><div style="flex:1">${bars || '<div class="muted">No status data available.</div>'}</div><div style="min-width:220px">${spark || '<div class="muted">No trend data.</div>'}</div></div>`;
  } catch (e) {
    console.error('Failed to load report', e);
    box.textContent = 'Failed to load report.';
  }
}

// Expose functions to global scope for inline onclick handlers
window.importExcel = async function() {
  const f = document.getElementById('excelFile').files[0];
  if (!f) {
    document.getElementById('importResult').textContent = 'Please choose an .xlsx file';
    return;
  }
  setLoading(true);
  const fd = new FormData();
  fd.append('excel', f);
  try {
    const res = await fetch('/api/import', { method: 'POST', body: fd });
    const j = await res.json();
    if (!res.ok) {
      document.getElementById('importResult').textContent = `Error: ${j.detail || JSON.stringify(j)}`;
      return;
    }
    document.getElementById('importResult').textContent = `Imported JDs=${j.imported_jds}, Candidates=${j.imported_candidates}`;
    await loadCandidates();
    await loadReport();
  } catch (e) {
    console.error('Import failed', e);
    document.getElementById('importResult').textContent = 'Import failed';
  } finally {
    setLoading(false);
  }
};

window.prefillUpdate = prefillUpdate;
window.quickMatch = quickMatch;
window.updateStatus = updateStatus;
window.selectAll = selectAll;
window.deselectAll = deselectAll;
window.toggleSelectAll = (checked) => toggleSelectAll(checked);
window.bulkUpdate = bulkUpdate;
window.prevPage = prevPage;
window.nextPage = nextPage;
window.doMatch = doMatch;
