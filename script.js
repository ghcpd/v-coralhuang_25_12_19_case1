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
    alert('Please choose an .xlsx file');
    return;
  }
  const fd = new FormData();
  fd.append('excel', f);
  const res = await fetch('/api/import', { method: 'POST', body: fd });
  const j = await res.json();
  document.getElementById('importResult').textContent = res.ok
    ? `Imported JDs=${j.imported_jds}, Candidates=${j.imported_candidates}`
    : `Error: ${j.detail || JSON.stringify(j)}`;
  
  // Auto-reload candidates after import
  if (res.ok) {
    await loadCandidates();
  }
}

async function loadCandidates() {
  const jd = document.getElementById('jdFilter').value.trim();
  const url = jd ? `/api/candidates?jd=${encodeURIComponent(jd)}` : '/api/candidates';
  const res = await fetch(url);
  const j = await res.json();
  const tbody = document.querySelector('#candTable tbody');
  tbody.innerHTML = '';
  (j.items || []).forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><div><b>${r.candidate_id}</b> ${escapeHtml(r.name)}</div><div class="muted">${escapeHtml(r.email)}</div></td>
      <td><span class="pill">${escapeHtml(r.jd_id)}</span></td>
      <td>${escapeHtml(r.submission_date || '')}</td>
      <td>${escapeHtml(r.current_status || '')}</td>
      <td class="actions">
        <button onclick="quickMatch('${r.candidate_id}')">Match</button>
        <button onclick="prefillUpdate('${r.candidate_id}','${r.current_status || ''}')">Update</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

async function loadReport() {
  const jd = document.getElementById('jdReport').value.trim();
  const url = jd ? `/api/report?jd=${encodeURIComponent(jd)}` : '/api/report';
  const res = await fetch(url);
  const j = await res.json();
  document.getElementById('reportBox').textContent = JSON.stringify(j, null, 2);
}

async function doMatch() {
  const cid = document.getElementById('matchCandidate').value.trim();
  if (!cid) {
    alert('Enter Candidate_ID');
    return;
  }
  await quickMatch(cid);
}

async function quickMatch(cid) {
  const res = await fetch(`/api/match/${encodeURIComponent(cid)}`);
  const j = await res.json();
  document.getElementById('matchBox').textContent = JSON.stringify(j, null, 2);
}

function prefillUpdate(cid, status) {
  document.getElementById('updCandidate').value = cid;
  if (status) {
    document.getElementById('updStatus').value = status;
  }
  document.getElementById('updReason').value = '';
  document.getElementById('updResult').textContent = '';
  window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
}

async function updateStatus() {
  const cid = document.getElementById('updCandidate').value.trim();
  const status = document.getElementById('updStatus').value;
  const reason = document.getElementById('updReason').value.trim();
  if (!cid) {
    alert('Enter Candidate_ID');
    return;
  }

  const res = await fetch('/api/update_status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidate_id: cid, status: status, reason: reason })
  });
  const j = await res.json();
  document.getElementById('updResult').textContent = res.ok
    ? 'Updated.'
    : `Error: ${j.detail || JSON.stringify(j)}`;

  // refresh list/report if user loaded them
  loadCandidates().catch(() => {});
  loadReport().catch(() => {});
}

function escapeHtml(s) {
  return (s || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
