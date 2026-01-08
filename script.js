// Improved frontend script: debounced search, pagination, selection, bulk update, inline errors and formatted report/match

let state = {
  page: 1,
  page_size: 10,
  sort: '',
  q: '',
  jd: '',
  total: 0,
  selected: new Set(),
  loading: false,
};

function setSpinner(el, on) {
  if (!el) return;
  el.style.opacity = on ? '0.6' : '1';
  el.style.pointerEvents = on ? 'none' : 'auto';
}

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

  // wire search debounce
  const searchBox = document.getElementById('searchBox');
  let t = null;
  searchBox.addEventListener('input', (ev) => {
    clearTimeout(t);
    t = setTimeout(() => {
      state.q = (ev.target.value || '').trim();
      state.page = 1;
      loadCandidates();
    }, 300); // 300ms debounce
  });

  // wire sort and page size
  document.getElementById('sortBy').addEventListener('change', (e) => { state.sort = e.target.value; state.page = 1; loadCandidates(); });
  document.getElementById('pageSize').addEventListener('change', (e) => { state.page_size = Number(e.target.value); state.page = 1; loadCandidates(); });
});

async function importExcel() {
  const f = document.getElementById('excelFile').files[0];
  if (!f) {
    document.getElementById('importResult').textContent = 'Please choose an .xlsx file';
    return;
  }
  const fd = new FormData();
  fd.append('excel', f);
  const btn = document.querySelector('button[onclick="importExcel()"]');
  btn.disabled = true; setSpinner(btn, true);
  try {
    const res = await fetch('/api/import', { method: 'POST', body: fd });
    const j = await res.json();
    document.getElementById('importResult').textContent = res.ok
      ? `Imported JDs=${j.imported_jds}, Candidates=${j.imported_candidates}`
      : `Error: ${j.detail || JSON.stringify(j)}`;

    if (res.ok) await loadCandidates();
  } catch (err) {
    document.getElementById('importResult').textContent = 'Upload failed.';
  } finally {
    btn.disabled = false; setSpinner(btn, false);
  }
}

async function loadCandidates() {
  if (state.loading) return;
  state.loading = true;
  const tbody = document.querySelector('#candTable tbody');
  tbody.innerHTML = '<tr><td colspan="6" class="muted">Loading…</td></tr>';

  const jd = document.getElementById('jdFilter').value.trim();
  state.jd = jd;
  const params = new URLSearchParams();
  if (jd) params.set('jd', jd);
  if (state.q) params.set('q', state.q);
  if (state.sort) params.set('sort', state.sort);
  params.set('page', String(state.page));
  params.set('page_size', String(state.page_size));

  try {
    const url = '/api/candidates?' + params.toString();
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load candidates');
    const j = await res.json();
    state.total = j.total || 0;

    // render rows
    if (!j.items || j.items.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="muted">No candidates found.</td></tr>';
      document.getElementById('pageInfo').textContent = `Page ${state.page} of 1`;
      document.getElementById('selectedCount').textContent = `${state.selected.size} selected`;
      state.loading = false; return;
    }

    tbody.innerHTML = '';
    j.items.forEach(r => {
      const tr = document.createElement('tr');
      const checked = state.selected.has(r.candidate_id) ? 'checked' : '';
      const dateText = r.submission_date ? formatDateNice(r.submission_date) : '';
      const statusClass = 'pill status-' + (r.current_status || 'Submitted');
      tr.innerHTML = `
        <td style="width:1%;"><input type="checkbox" data-cid="${r.candidate_id}" ${checked} onchange="onRowToggle(event)"/></td>
        <td><div><b>${r.candidate_id}</b> ${escapeHtml(r.name)}</div><div class="muted">${escapeHtml(r.email)}</div></td>
        <td><span class="pill">${escapeHtml(r.jd_id)}</span></td>
        <td>${escapeHtml(dateText)}</td>
        <td><span class="${statusClass}">${escapeHtml(r.current_status || '')}</span></td>
        <td class="actions">
          <button onclick="quickMatch('${r.candidate_id}')">Match</button>
          <button onclick="prefillUpdate('${r.candidate_id}','${r.current_status || ''}')">Update</button>
        </td>`;
      tbody.appendChild(tr);
    });

    const pages = Math.max(1, Math.ceil((j.total || j.count || 0) / state.page_size));
    document.getElementById('pageInfo').textContent = `Page ${state.page} of ${pages}`;
    document.getElementById('selectedCount').textContent = `${state.selected.size} selected`;
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">Error loading candidates.</td></tr>`;
    console.error(err);
  } finally {
    state.loading = false;
  }
}

function onRowToggle(ev) {
  const cb = ev.target;
  const cid = cb.getAttribute('data-cid');
  if (cb.checked) state.selected.add(cid); else state.selected.delete(cid);
  document.getElementById('selectedCount').textContent = `${state.selected.size} selected`;
}

function selectAll() {
  // select all visible on current page
  document.querySelectorAll('#candTable tbody input[type=checkbox]').forEach(cb => { cb.checked = true; state.selected.add(cb.getAttribute('data-cid')); });
  document.getElementById('selectedCount').textContent = `${state.selected.size} selected`;
}

function deselectAll() {
  document.querySelectorAll('#candTable tbody input[type=checkbox]').forEach(cb => { cb.checked = false; state.selected.delete(cb.getAttribute('data-cid')); });
  document.getElementById('selectedCount').textContent = `${state.selected.size} selected`;
}

function toggleSelectAll() {
  const checkbox = document.getElementById('selectAllCheckbox');
  if (checkbox.checked) selectAll(); else deselectAll();
}

async function bulkUpdate() {
  if (state.selected.size === 0) {
    document.getElementById('importResult').textContent = 'No candidates selected for bulk update.'; return;
  }
  const status = prompt('Bulk update status to (Submitted, Interviewing, Rejected, Accepted):', 'Interviewing');
  if (!status) return;
  const reason = status === 'Rejected' ? prompt('Reason for rejection (will be saved):', '') || '' : '';

  const btn = document.querySelector('button[onclick="bulkUpdate()"]'); btn.disabled = true; setSpinner(btn, true);
  try {
    const res = await fetch('/api/bulk_update_status', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidate_ids: Array.from(state.selected), status: status, reason: reason })
    });
    const j = await res.json();
    if (!res.ok) {
      document.getElementById('importResult').textContent = `Bulk update failed: ${j.detail || JSON.stringify(j)}`;
    } else {
      document.getElementById('importResult').textContent = `Bulk update applied to ${j.count} candidates.`;
      state.selected.clear();
      await loadCandidates();
      await loadReport();
    }
  } catch (err) {
    document.getElementById('importResult').textContent = 'Bulk update error.';
  } finally { btn.disabled = false; setSpinner(btn, false); }
}

function prevPage() { if (state.page > 1) { state.page -= 1; loadCandidates(); } }
function nextPage() { const pages = Math.max(1, Math.ceil((state.total || 0) / state.page_size)); if (state.page < pages) { state.page += 1; loadCandidates(); } }

async function loadReport() {
  const jd = document.getElementById('jdReport').value.trim();
  const url = jd ? `/api/report?jd=${encodeURIComponent(jd)}` : '/api/report';
  const res = await fetch(url);
  if (!res.ok) { document.getElementById('reportBox').textContent = 'Failed to load report.'; return; }
  const j = await res.json();

  document.getElementById('reportMeta').textContent = `Generated: ${formatDateNice(j.generated_at || '')}`;

  const summary = document.getElementById('statusSummary');
  summary.innerHTML = '';
  if (!j.status_summary || j.status_summary.length === 0) {
    summary.innerHTML = '<div class="muted">No status data to show.</div>';
  } else {
    j.status_summary.forEach(s => {
      const span = document.createElement('div');
      span.innerHTML = `<span class="pill status-${s.current_status}">${escapeHtml(s.current_status)}</span> <strong style="margin-left:8px">${s.count}</strong>`;
      summary.appendChild(span);
    });
  }

  const trend = document.getElementById('submissionTrend');
  if (!j.submission_trend || j.submission_trend.length === 0) {
    trend.textContent = '';
  } else {
    trend.textContent = 'Submissions over time: ' + j.submission_trend.map(t => `${formatDateNice(t.submission_date)} (${t.submissions})`).join(' · ');
  }
}

async function doMatch() {
  const cid = document.getElementById('matchCandidate').value.trim();
  if (!cid) { document.getElementById('matchMsg').textContent = 'Enter Candidate_ID'; return; }
  await quickMatch(cid);
}

async function quickMatch(cid) {
  const res = await fetch(`/api/match/${encodeURIComponent(cid)}`);
  if (!res.ok) { document.getElementById('matchBox').textContent = 'Match failed or candidate not found.'; return; }
  const j = await res.json();
  const box = document.getElementById('matchBox');
  box.innerHTML = '';
  const title = document.createElement('div'); title.innerHTML = `<strong>${escapeHtml(j.candidate_id)}</strong> — ${escapeHtml(j.jd_title)} <span class="muted" style="margin-left:8px">${j.match_label}</span>`;
  box.appendChild(title);
  const score = document.createElement('div'); score.innerHTML = `<div style="margin-top:8px">Score: <strong>${j.match_score}</strong></div>`;
  const prog = document.createElement('div'); prog.className = 'progress'; prog.innerHTML = `<div class="fill" style="width:${Math.max(0,Math.min(100,j.match_score))}%"></div>`;
  box.appendChild(score); box.appendChild(prog);

  const explain = document.createElement('div'); explain.style.marginTop = '8px';
  explain.innerHTML = `Must-have hits: ${j.explain.must_have_hit}/${j.explain.must_have_total} · Nice hits: ${j.explain.nice_to_have_hit}/${j.explain.nice_to_have_total} · Exp OK: ${j.explain.exp_ok ? 'Yes' : 'No'}`;
  box.appendChild(explain);
  const meta = document.createElement('div'); meta.className = 'muted'; meta.style.marginTop = '8px'; meta.textContent = `JD version ${j.explain.jd_version} (updated ${formatDateNice(j.explain.jd_last_updated)})`;
  box.appendChild(meta);
}

async function updateStatus() {
  const cid = document.getElementById('updCandidate').value.trim();
  const status = document.getElementById('updStatus').value;
  const reason = document.getElementById('updReason').value.trim();
  const resultEl = document.getElementById('updResult');
  const spinner = document.getElementById('updSpinner');
  resultEl.textContent = '';
  if (!cid) { resultEl.textContent = 'Enter Candidate_ID'; return; }
  const btn = document.querySelector('button[onclick="updateStatus()"]'); btn.disabled = true; spinner.style.display = 'inline';
  try {
    const res = await fetch('/api/update_status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ candidate_id: cid, status: status, reason: reason }) });
    const j = await res.json();
    if (!res.ok) {
      resultEl.textContent = `Error: ${j.detail || JSON.stringify(j)}`;
    } else {
      resultEl.textContent = 'Updated.';
      await loadCandidates(); await loadReport();
    }
  } catch (err) {
    resultEl.textContent = 'Update failed.';
  } finally { btn.disabled = false; spinner.style.display = 'none'; }
}

function escapeHtml(s) { return (s || '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }

function formatDateNice(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (e) { return iso; }
}

