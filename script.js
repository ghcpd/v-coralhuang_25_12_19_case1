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

// Bug: 没有防抖，频繁调用会导致竞态条件
let loadingCandidates = false;
async function loadCandidates() {
  // Bug: 没有正确处理并发请求
  if (loadingCandidates) {
    return; // 简单返回，但不取消之前的请求
  }
  loadingCandidates = true;
  
  const jd = document.getElementById('jdFilter').value.trim();
  const url = jd ? `/api/candidates?jd=${encodeURIComponent(jd)}` : '/api/candidates';
  
  // Bug: 没有显示加载状态
  const res = await fetch(url);
  const j = await res.json();
  const tbody = document.querySelector('#candTable tbody');
  tbody.innerHTML = '';
  
  // Bug: 如果数据量大，一次性插入大量 DOM 会卡顿
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
  
  loadingCandidates = false;
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

// Bug: 没有禁用按钮，用户可能重复点击导致重复提交
async function updateStatus() {
  const cid = document.getElementById('updCandidate').value.trim();
  const status = document.getElementById('updStatus').value;
  const reason = document.getElementById('updReason').value.trim();
  if (!cid) {
    alert('Enter Candidate_ID'); // Bug: 还在用 alert
    return;
  }

  // Bug: 应该在这里禁用按钮，但没有
  const res = await fetch('/api/update_status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ candidate_id: cid, status: status, reason: reason })
  });
  const j = await res.json();
  document.getElementById('updResult').textContent = res.ok
    ? 'Updated.'
    : `Error: ${j.detail || JSON.stringify(j)}`;

  // Bug: 这两个调用是并行的，可能导致竞态条件
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

// Bug: 这些函数声明了但没实现或实现不完整
function selectAll() {
  // Bug: 实现不完整
  alert('Not implemented');
}

function deselectAll() {
  alert('Not implemented');
}

function toggleSelectAll() {
  // Bug: 没有实际逻辑
  const checkbox = document.getElementById('selectAllCheckbox');
  alert('Toggle all: ' + checkbox.checked);
}

function bulkUpdate() {
  // Bug: 调用了不存在的 API endpoint 或实现有问题
  alert('Bulk update not fully implemented');
}

function prevPage() {
  alert('Pagination not implemented');
}

function nextPage() {
  alert('Pagination not implemented');
}
