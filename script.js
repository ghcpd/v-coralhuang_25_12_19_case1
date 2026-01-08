// Global state
let currentPage = 1;
let currentPageSize = 10;
let selectedCandidates = new Set();
let searchTimeout = null;

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

  // Setup debounced search
  const searchBox = document.getElementById('searchBox');
  searchBox.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      currentPage = 1;
      loadCandidates();
    }, 300);
  });
});

async function importExcel() {
  const f = document.getElementById('excelFile').files[0];
  if (!f) {
    showError('Please choose an .xlsx file');
    return;
  }

  const btn = document.querySelector('button[onclick="importExcel()"]');
  setLoading(btn, true);

  const fd = new FormData();
  fd.append('excel', f);
  const res = await fetch('/api/import', { method: 'POST', body: fd });
  const j = await res.json();
  
  setLoading(btn, false);
  if (res.ok) {
    document.getElementById('importResult').textContent = `Imported JDs=${j.imported_jds}, Candidates=${j.imported_candidates}`;
    await loadCandidates();
  } else {
    showError(j.detail || 'Import failed');
  }
}

async function loadCandidates() {
  const jd = document.getElementById('jdFilter').value.trim();
  const search = document.getElementById('searchBox').value.trim();
  const sortBy = document.getElementById('sortBy').value;

  const params = new URLSearchParams({
    page: currentPage,
    page_size: currentPageSize
  });
  if (jd) params.append('jd', jd);
  if (search) params.append('search', search);
  if (sortBy) params.append('sort_by', sortBy);

  showLoading(true);
  try {
    const res = await fetch(`/api/candidates?${params}`);
    const j = await res.json();
    
    renderCandidates(j.items);
    renderPagination(j.pagination);
    updateSelectedCount();
  } catch (e) {
    showError('Failed to load candidates');
  } finally {
    showLoading(false);
  }
}

function renderCandidates(items) {
  const tbody = document.querySelector('#candTable tbody');
  tbody.innerHTML = '';

  if (items.length === 0) {
    document.getElementById('emptyState').style.display = 'block';
    document.getElementById('candTable').style.display = 'none';
    return;
  }

  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('candTable').style.display = 'table';

  items.forEach(r => {
    const tr = document.createElement('tr');
    const isSelected = selectedCandidates.has(r.candidate_id);
    const statusClass = `status-${r.current_status.toLowerCase()}`;
    
    tr.innerHTML = `
      <td><input type="checkbox" class="candidate-checkbox" value="${r.candidate_id}" ${isSelected ? 'checked' : ''} onchange="toggleCandidateSelection('${r.candidate_id}')"/></td>
      <td>
        <div><b>${escapeHtml(r.candidate_id)}</b> ${escapeHtml(r.name)}</div>
        <div class="muted">${escapeHtml(r.email)}</div>
        <div class="skill-list">${formatSkills(r.skills)}</div>
      </td>
      <td><span class="pill">${escapeHtml(r.jd_id)}</span></td>
      <td>${formatDate(r.submission_date)}</td>
      <td><span class="pill ${statusClass}">${escapeHtml(r.current_status)}</span></td>
      <td class="actions">
        <button onclick="quickMatch('${r.candidate_id}')">Match</button>
        <button onclick="prefillUpdate('${r.candidate_id}','${r.current_status || ''}')">Update</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

function renderPagination(pagination) {
  const pageInfo = document.getElementById('pageInfo');
  const prevBtn = document.getElementById('prevPageBtn');
  const nextBtn = document.getElementById('nextPageBtn');

  pageInfo.textContent = `Page ${pagination.page} of ${pagination.total_pages} (${pagination.total_count} total)`;
  prevBtn.disabled = !pagination.has_prev;
  nextBtn.disabled = !pagination.has_next;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  } catch {
    return dateStr;
  }
}

function formatSkills(skills) {
  if (!skills) return '';
  return skills.split(';').map(s => `<span class="skill-tag">${escapeHtml(s.trim())}</span>`).join('');
}

function showLoading(show) {
  document.getElementById('loadingIndicator').style.display = show ? 'block' : 'none';
}

function setLoading(button, loading) {
  button.disabled = loading;
  button.textContent = loading ? 'Loading...' : button.dataset.originalText || button.textContent.replace('Loading...', 'Import');
  if (!button.dataset.originalText) button.dataset.originalText = button.textContent;
}

function showError(message) {
  const resultDiv = document.getElementById('updResult');
  resultDiv.textContent = message;
  resultDiv.className = 'result-message error';
  setTimeout(() => resultDiv.textContent = '', 5000);
}

function showSuccess(message) {
  const resultDiv = document.getElementById('updResult');
  resultDiv.textContent = message;
  resultDiv.className = 'result-message success';
  setTimeout(() => resultDiv.textContent = '', 3000);
}

function applyFilters() {
  currentPage = 1;
  loadCandidates();
}

function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    loadCandidates();
  }
}

function nextPage() {
  currentPage++;
  loadCandidates();
}

function changePageSize() {
  currentPageSize = parseInt(document.getElementById('pageSize').value);
  currentPage = 1;
  loadCandidates();
}

function selectAll() {
  const checkboxes = document.querySelectorAll('.candidate-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = true;
    selectedCandidates.add(cb.value);
  });
  updateSelectedCount();
}

function deselectAll() {
  const checkboxes = document.querySelectorAll('.candidate-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = false;
    selectedCandidates.delete(cb.value);
  });
  updateSelectedCount();
}

function toggleSelectAll() {
  const masterCheckbox = document.getElementById('selectAllCheckbox');
  const checkboxes = document.querySelectorAll('.candidate-checkbox');
  
  if (masterCheckbox.checked) {
    selectAll();
  } else {
    deselectAll();
  }
}

function toggleCandidateSelection(candidateId) {
  const checkbox = document.querySelector(`.candidate-checkbox[value="${candidateId}"]`);
  if (checkbox.checked) {
    selectedCandidates.add(candidateId);
  } else {
    selectedCandidates.delete(candidateId);
  }
  updateSelectedCount();
}

function updateSelectedCount() {
  const count = selectedCandidates.size;
  document.getElementById('selectedCount').textContent = `${count} selected`;
  document.getElementById('bulkUpdateBtn').disabled = count === 0;
}

async function bulkUpdate() {
  if (selectedCandidates.size === 0) return;

  const status = prompt('Enter new status for selected candidates (Submitted/Interviewing/Rejected/Accepted):');
  if (!status) return;

  const reason = status.toLowerCase() === 'rejected' ? prompt('Reason for rejection:') : '';

  const btn = document.getElementById('bulkUpdateBtn');
  setLoading(btn, true);

  try {
    const res = await fetch('/api/bulk_update_status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidate_ids: Array.from(selectedCandidates),
        status: status,
        reason: reason
      })
    });
    const j = await res.json();
    
    if (res.ok) {
      showSuccess(`Bulk update completed. ${j.results.filter(r => r.success).length} updated.`);
      selectedCandidates.clear();
      await loadCandidates();
      await loadReport();
    } else {
      showError(j.detail || 'Bulk update failed');
    }
  } catch (e) {
    showError('Bulk update failed');
  } finally {
    setLoading(btn, false);
  }
}

async function loadReport() {
  const jd = document.getElementById('jdReport').value.trim();
  const url = jd ? `/api/report?jd=${encodeURIComponent(jd)}` : '/api/report';
  
  const btn = document.getElementById('loadReportBtn');
  setLoading(btn, true);
  
  try {
    const res = await fetch(url);
    const j = await res.json();
    renderReport(j);
  } catch (e) {
    showError('Failed to load report');
  } finally {
    setLoading(btn, false);
  }
}

function renderReport(data) {
  const container = document.getElementById('reportDisplay');
  
  let html = `<h4>Status Distribution</h4>`;
  
  // Status summary chart
  html += '<div class="chart-container">';
  const maxCount = Math.max(...data.status_summary.map(s => s.count));
  data.status_summary.forEach(status => {
    const percentage = maxCount > 0 ? (status.count / maxCount) * 100 : 0;
    html += `
      <div class="chart-bar">
        <span class="chart-label">${status.current_status}</span>
        <div class="chart-bar-fill" style="width: ${percentage}%">${status.count}</div>
      </div>`;
  });
  html += '</div>';
  
  // Submission trend
  if (data.submission_trend.length > 0) {
    html += `<h4>Submission Trend</h4>`;
    html += '<div class="chart-container">';
    const maxSubs = Math.max(...data.submission_trend.map(s => s.submissions));
    data.submission_trend.forEach(day => {
      const percentage = maxSubs > 0 ? (day.submissions / maxSubs) * 100 : 0;
      html += `
        <div class="chart-bar">
          <span class="chart-label">${formatDate(day.submission_date)}</span>
          <div class="chart-bar-fill" style="width: ${percentage}%">${day.submissions}</div>
        </div>`;
    });
    html += '</div>';
  }
  
  html += `<p class="muted">Generated: ${formatDate(data.generated_at)}</p>`;
  
  container.innerHTML = html;
}

async function doMatch() {
  const cid = document.getElementById('matchCandidate').value.trim();
  if (!cid) {
    showError('Enter Candidate_ID');
    return;
  }
  await quickMatch(cid);
}

async function quickMatch(cid) {
  const btn = document.querySelector(`button[onclick="quickMatch('${cid}')"]`) || document.getElementById('doMatchBtn');
  setLoading(btn, true);
  
  try {
    const res = await fetch(`/api/match/${encodeURIComponent(cid)}`);
    const j = await res.json();
    renderMatch(j);
  } catch (e) {
    showError('Failed to match candidate');
  } finally {
    setLoading(btn, false);
  }
}

function renderMatch(data) {
  const container = document.getElementById('matchResult');
  
  let html = `
    <h4>Match Results for ${escapeHtml(data.candidate_id)}</h4>
    <p><strong>JD:</strong> ${escapeHtml(data.jd_title)} (${escapeHtml(data.jd_id)})</p>
    <p><strong>Match Label:</strong> ${escapeHtml(data.match_label)}</p>
    <div class="match-score">${data.match_score}%</div>
    <div class="progress-bar">
      <div class="progress-fill" style="width: ${data.match_score}%"></div>
    </div>
  `;
  
  if (data.explain) {
    html += `<h5>Score Breakdown</h5>`;
    html += `<p><strong>Must-have skills:</strong> ${data.explain.must_have_hit}/${data.explain.must_have_total}</p>`;
    html += `<p><strong>Nice-to-have skills:</strong> ${data.explain.nice_to_have_hit}/${data.explain.nice_to_have_total}</p>`;
    html += `<p><strong>Experience match:</strong> ${data.explain.exp_ok ? 'Yes' : 'No'}</p>`;
    html += `<p><strong>Location match:</strong> ${data.explain.loc_ok ? 'Yes' : 'No'}</p>`;
  }
  
  container.innerHTML = html;
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
    showError('Enter Candidate_ID');
    return;
  }

  const btn = document.getElementById('updateStatusBtn');
  setLoading(btn, true);

  try {
    const res = await fetch('/api/update_status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidate_id: cid, status: status, reason: reason })
    });
    const j = await res.json();
    
    if (res.ok) {
      showSuccess(`Updated ${j.candidate_id} from ${j.old_status} to ${j.new_status}`);
      document.getElementById('updCandidate').value = '';
      document.getElementById('updReason').value = '';
      await loadCandidates();
      await loadReport();
    } else {
      showError(j.detail || 'Update failed');
    }
  } catch (e) {
    showError('Update failed');
  } finally {
    setLoading(btn, false);
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
