// ============================================================================
// Recruitment Dashboard - Enhanced Frontend
// ============================================================================

// State management
const STATE = {
  candidates: [],
  currentPage: 1,
  pageSize: 10,
  totalPages: 1,
  totalCount: 0,
  selectedCandidates: new Set(),
  searchTimeout: null,
  isLoading: false,
  sortBy: '',
  searchTerm: '',
};

// ============================================================================
// Utility Functions
// ============================================================================

function escapeHtml(s) {
  return (s || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDate(isoString) {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return isoString;
  }
}

function formatSkills(skillsStr) {
  if (!skillsStr) return '';
  return skillsStr.split(';').map(s => s.trim()).filter(s => s).join(', ');
}

function getStatusColor(status) {
  const colors = {
    'Submitted': '#0066cc',
    'Interviewing': '#ffb81c',
    'Rejected': '#cc0000',
    'Accepted': '#009900',
  };
  return colors[status] || '#666';
}

function showError(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = `❌ ${message}`;
    el.style.color = '#cc0000';
  }
  console.error(message);
}

function showSuccess(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = `✓ ${message}`;
    el.style.color = '#009900';
  }
}

function showInfo(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) {
    el.textContent = `ℹ ${message}`;
    el.style.color = '#0066cc';
  }
}

function setButtonState(buttonElement, enabled) {
  if (buttonElement) {
    buttonElement.disabled = !enabled;
    buttonElement.style.opacity = enabled ? '1' : '0.6';
  }
}

function createLoadingSpinner() {
  const spinner = document.createElement('span');
  spinner.className = 'spinner';
  spinner.title = 'Loading...';
  return spinner;
}

// ============================================================================
// Page Load
// ============================================================================

window.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('/api/auto_import_status');
    const status = await res.json();
    if (status.has_data) {
      showSuccess('importResult', `Data ready: ${status.jd_count} JDs, ${status.candidate_count} candidates`);
      await loadCandidates();
    } else {
      showInfo('importResult', 'No data loaded yet. Please import an Excel file.');
    }
  } catch (e) {
    console.error('Failed to check import status:', e);
  }
});

// ============================================================================
// Import Functionality
// ============================================================================

async function importExcel() {
  const fileInput = document.getElementById('excelFile');
  const f = fileInput.files[0];
  if (!f) {
    showError('importResult', 'Please select an .xlsx file');
    return;
  }

  const importBtn = event.target;
  setButtonState(importBtn, false);
  importBtn.appendChild(createLoadingSpinner());

  try {
    const fd = new FormData();
    fd.append('excel', f);
    const res = await fetch('/api/import', { method: 'POST', body: fd });
    const j = await res.json();
    
    if (res.ok) {
      showSuccess('importResult', `Imported: ${j.imported_jds} JDs, ${j.imported_candidates} candidates`);
      fileInput.value = '';
      STATE.currentPage = 1;
      await loadCandidates();
    } else {
      showError('importResult', j.detail || JSON.stringify(j));
    }
  } catch (e) {
    showError('importResult', e.message);
  } finally {
    setButtonState(importBtn, true);
    const spinner = importBtn.querySelector('.spinner');
    if (spinner) spinner.remove();
  }
}

// ============================================================================
// Search with Debouncing
// ============================================================================

function onSearchInput(event) {
  STATE.searchTerm = event.target.value.trim();
  STATE.currentPage = 1;

  if (STATE.searchTimeout) {
    clearTimeout(STATE.searchTimeout);
  }

  STATE.searchTimeout = setTimeout(() => {
    loadCandidates();
  }, 300);
}

// ============================================================================
// Pagination State
// ============================================================================

function onPageSizeChange(event) {
  STATE.pageSize = parseInt(event.target.value);
  STATE.currentPage = 1;
  loadCandidates();
}

function prevPage() {
  if (STATE.currentPage > 1) {
    STATE.currentPage--;
    loadCandidates();
  }
}

function nextPage() {
  if (STATE.currentPage < STATE.totalPages) {
    STATE.currentPage++;
    loadCandidates();
  }
}

// ============================================================================
// Load Candidates with Filtering & Sorting
// ============================================================================

async function loadCandidates() {
  if (STATE.isLoading) return;
  STATE.isLoading = true;

  const jdFilter = document.getElementById('jdFilter').value.trim();
  const sortBy = document.getElementById('sortBy').value;
  STATE.sortBy = sortBy;

  const params = new URLSearchParams();
  if (jdFilter) params.append('jd', jdFilter);
  if (STATE.searchTerm) params.append('search', STATE.searchTerm);
  if (sortBy) params.append('sort_by', sortBy);
  params.append('page', STATE.currentPage);
  params.append('page_size', STATE.pageSize);

  try {
    const res = await fetch(`/api/candidates?${params.toString()}`);
    if (!res.ok) {
      showError('candTable', `Failed to load candidates (HTTP ${res.status})`);
      STATE.isLoading = false;
      return;
    }

    const j = await res.json();
    STATE.candidates = j.items || [];
    STATE.totalPages = j.total_pages || 1;
    STATE.totalCount = j.total_count || 0;

    renderCandidateTable();
    updatePaginationInfo();
    updateSelectedCount();
  } catch (e) {
    showError('candTable', e.message);
  } finally {
    STATE.isLoading = false;
  }
}

function renderCandidateTable() {
  const tbody = document.querySelector('#candTable tbody');
  tbody.innerHTML = '';

  if (STATE.candidates.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="6" style="text-align:center; padding:20px; color:#999;">📭 No candidates found</td>';
    tbody.appendChild(tr);
    return;
  }

  STATE.candidates.forEach(cand => {
    const tr = document.createElement('tr');
    const isSelected = STATE.selectedCandidates.has(cand.candidate_id);
    const statusColor = getStatusColor(cand.current_status);

    tr.innerHTML = `
      <td>
        <input type="checkbox" 
          class="candidate-checkbox" 
          value="${escapeHtml(cand.candidate_id)}"
          ${isSelected ? 'checked' : ''}
          onchange="toggleCandidate(this)"/>
      </td>
      <td>
        <div><b>${escapeHtml(cand.candidate_id)}</b> ${escapeHtml(cand.name)}</div>
        <div class="muted">${escapeHtml(cand.email)}</div>
        ${cand.skills ? `<div class="muted small-text">${escapeHtml(formatSkills(cand.skills))}</div>` : ''}
      </td>
      <td><span class="pill">${escapeHtml(cand.jd_id)}</span></td>
      <td>${formatDate(cand.submission_date)}</td>
      <td>
        <span class="status-badge" style="background-color:${statusColor}; color:white;">
          ${escapeHtml(cand.current_status || 'Unknown')}
        </span>
      </td>
      <td class="actions">
        <button class="btn-small" onclick="quickMatch('${escapeHtml(cand.candidate_id)}')">Match</button>
        <button class="btn-small" onclick="prefillUpdate('${escapeHtml(cand.candidate_id)}','${escapeHtml(cand.current_status || '')}')">Update</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

function updatePaginationInfo() {
  const pageInfo = document.getElementById('pageInfo');
  pageInfo.textContent = `Page ${STATE.currentPage} of ${STATE.totalPages} (${STATE.totalCount} total)`;

  const prevBtn = document.querySelector('button[onclick="prevPage()"]');
  const nextBtn = document.querySelector('button[onclick="nextPage()"]');

  if (prevBtn) setButtonState(prevBtn, STATE.currentPage > 1);
  if (nextBtn) setButtonState(nextBtn, STATE.currentPage < STATE.totalPages);
}

// ============================================================================
// Row Selection & Bulk Actions
// ============================================================================

function toggleCandidate(checkbox) {
  const candId = checkbox.value;
  if (checkbox.checked) {
    STATE.selectedCandidates.add(candId);
  } else {
    STATE.selectedCandidates.delete(candId);
  }
  updateSelectedCount();
  updateSelectAllCheckbox();
}

function toggleSelectAll() {
  const checkbox = document.getElementById('selectAllCheckbox');
  STATE.candidates.forEach(cand => {
    if (checkbox.checked) {
      STATE.selectedCandidates.add(cand.candidate_id);
    } else {
      STATE.selectedCandidates.delete(cand.candidate_id);
    }
  });
  
  document.querySelectorAll('.candidate-checkbox').forEach(cb => {
    cb.checked = checkbox.checked;
  });

  updateSelectedCount();
}

function selectAll() {
  document.getElementById('selectAllCheckbox').checked = true;
  STATE.candidates.forEach(cand => STATE.selectedCandidates.add(cand.candidate_id));
  document.querySelectorAll('.candidate-checkbox').forEach(cb => cb.checked = true);
  updateSelectedCount();
}

function deselectAll() {
  document.getElementById('selectAllCheckbox').checked = false;
  STATE.selectedCandidates.clear();
  document.querySelectorAll('.candidate-checkbox').forEach(cb => cb.checked = false);
  updateSelectedCount();
}

function updateSelectAllCheckbox() {
  const checkbox = document.getElementById('selectAllCheckbox');
  const allChecked = STATE.candidates.every(c => STATE.selectedCandidates.has(c.candidate_id));
  const someChecked = STATE.candidates.some(c => STATE.selectedCandidates.has(c.candidate_id));
  checkbox.checked = allChecked;
  checkbox.indeterminate = someChecked && !allChecked;
}

function updateSelectedCount() {
  const count = STATE.selectedCandidates.size;
  document.getElementById('selectedCount').textContent = `${count} selected`;
  
  const bulkBtn = document.querySelector('button[onclick="bulkUpdate()"]');
  if (bulkBtn) {
    setButtonState(bulkBtn, count > 0);
  }
}

async function bulkUpdate() {
  if (STATE.selectedCandidates.size === 0) {
    showError('updResult', 'Please select at least one candidate');
    return;
  }

  const statusSelect = document.getElementById('bulkStatus');
  const status = statusSelect.value;
  const reason = document.getElementById('bulkReason').value.trim();

  const bulkBtn = event.target;
  setButtonState(bulkBtn, false);
  bulkBtn.appendChild(createLoadingSpinner());

  try {
    const res = await fetch('/api/bulk_update_status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidate_ids: Array.from(STATE.selectedCandidates),
        status: status,
        reason: reason
      })
    });

    const j = await res.json();
    
    if (res.ok) {
      showSuccess('updResult', `Updated ${j.total} candidates to ${status}`);
      STATE.selectedCandidates.clear();
      await loadCandidates();
      document.getElementById('bulkReason').value = '';
    } else {
      showError('updResult', j.detail || JSON.stringify(j));
    }
  } catch (e) {
    showError('updResult', e.message);
  } finally {
    setButtonState(bulkBtn, true);
    const spinner = bulkBtn.querySelector('.spinner');
    if (spinner) spinner.remove();
  }
}

// ============================================================================
// Individual Status Update
// ============================================================================

function prefillUpdate(candId, status) {
  document.getElementById('updCandidate').value = candId;
  if (status) {
    document.getElementById('updStatus').value = status;
  }
  document.getElementById('updReason').value = '';
  document.getElementById('updResult').textContent = '';
  
  const updateSection = document.querySelector('input[id="updCandidate"]').parentElement.parentElement;
  updateSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function updateStatus() {
  const candId = document.getElementById('updCandidate').value.trim();
  const status = document.getElementById('updStatus').value;
  const reason = document.getElementById('updReason').value.trim();

  if (!candId) {
    showError('updResult', 'Please enter a Candidate ID');
    return;
  }

  const updateBtn = event.target;
  setButtonState(updateBtn, false);
  updateBtn.appendChild(createLoadingSpinner());

  try {
    const res = await fetch('/api/update_status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidate_id: candId, status: status, reason: reason })
    });

    const j = await res.json();

    if (res.ok) {
      showSuccess('updResult', `Status updated: ${j.old_status} → ${j.new_status}`);
      document.getElementById('updCandidate').value = '';
      document.getElementById('updReason').value = '';
      
      await loadCandidates();
      await loadReport();
    } else {
      showError('updResult', j.detail || JSON.stringify(j));
    }
  } catch (e) {
    showError('updResult', e.message);
  } finally {
    setButtonState(updateBtn, true);
    const spinner = updateBtn.querySelector('.spinner');
    if (spinner) spinner.remove();
  }
}

// ============================================================================
// Match Functionality
// ============================================================================

async function doMatch() {
  const candId = document.getElementById('matchCandidate').value.trim();
  if (!candId) {
    showError('matchBox', 'Please enter a Candidate ID');
    return;
  }
  await quickMatch(candId);
}

async function quickMatch(candId) {
  const matchBox = document.getElementById('matchBox');
  matchBox.innerHTML = createLoadingSpinner().outerHTML;

  try {
    const res = await fetch(`/api/match/${encodeURIComponent(candId)}`);
    const j = await res.json();

    if (!res.ok) {
      showError('matchBox', j.detail || 'Match failed');
      return;
    }

    const score = j.match_score || 0;
    const scorePercent = Math.min(100, Math.max(0, score));
    const explain = j.explain || {};

    matchBox.innerHTML = `
      <div class="match-result">
        <h3>${escapeHtml(j.jd_title)}</h3>
        <p><b>Candidate:</b> ${escapeHtml(j.candidate_id)} | <b>JD:</b> ${escapeHtml(j.jd_id)}</p>
        
        <div class="score-section">
          <b>Match Score: ${score}/100</b>
          <div class="progress-bar">
            <div class="progress-fill" style="width:${scorePercent}%; background-color:${scorePercent >= 80 ? '#009900' : scorePercent >= 55 ? '#ffb81c' : '#cc0000'};"></div>
          </div>
          <p style="text-align:center; margin-top:8px; font-weight:bold; color:${scorePercent >= 80 ? '#009900' : scorePercent >= 55 ? '#ffb81c' : '#cc0000'};">
            ${escapeHtml(j.match_label)}
          </p>
        </div>

        <div class="explain-section">
          <b>Breakdown:</b>
          <ul>
            <li>Must-Have Skills: ${explain.must_have_hit || 0}/${explain.must_have_total || 0}</li>
            <li>Nice-to-Have Skills: ${explain.nice_to_have_hit || 0}/${explain.nice_to_have_total || 0}</li>
            <li>Experience: ${explain.exp_ok ? '✓ Met' : '✗ Not met'}</li>
            <li>Location: ${explain.loc_ok ? '✓ Match' : '✗ No match'}</li>
          </ul>
        </div>

        <div class="explain-section">
          <b>Score Breakdown:</b>
          <ul>
            <li>Must-Have Component: ${explain.score_breakdown?.must_have_component || 0} pts</li>
            <li>Nice-to-Have Component: ${explain.score_breakdown?.nice_to_have_component || 0} pts</li>
            <li>Experience Bonus: ${explain.score_breakdown?.experience_bonus || 0} pts</li>
            <li>Location Bonus: ${explain.score_breakdown?.location_bonus || 0} pts</li>
          </ul>
        </div>
      </div>
    `;
  } catch (e) {
    showError('matchBox', e.message);
  }
}

// ============================================================================
// Reports with Visualization
// ============================================================================

async function loadReport() {
  const jdReport = document.getElementById('jdReport').value.trim();
  const reportBox = document.getElementById('reportBox');
  reportBox.innerHTML = createLoadingSpinner().outerHTML;

  try {
    const params = jdReport ? `?jd=${encodeURIComponent(jdReport)}` : '';
    const res = await fetch(`/api/report${params}`);
    const j = await res.json();

    if (!res.ok) {
      showError('reportBox', j.detail || 'Report failed');
      return;
    }

    renderReport(j);
  } catch (e) {
    showError('reportBox', e.message);
  }
}

function renderReport(data) {
  const reportBox = document.getElementById('reportBox');
  const statusSummary = data.status_summary || [];
  const submissionTrend = data.submission_trend || [];

  const totalCandidates = statusSummary.reduce((sum, s) => sum + (s.count || 0), 0);

  let html = `<div class="report-container">`;
  
  html += `<h3>Report${data.filter_jd ? ` for ${escapeHtml(data.filter_jd)}` : ''}</h3>`;

  if (statusSummary.length > 0) {
    html += `<div class="chart-section">
      <b>Status Distribution</b>
      <div class="status-chart">`;
    
    statusSummary.forEach(stat => {
      const pct = totalCandidates > 0 ? Math.round((stat.count / totalCandidates) * 100) : 0;
      const color = getStatusColor(stat.current_status);
      html += `
        <div class="chart-item">
          <div class="chart-bar" style="background-color:${color}; width:${Math.max(5, pct)}%"></div>
          <span class="chart-label">${escapeHtml(stat.current_status)}: ${stat.count} (${pct}%)</span>
        </div>`;
    });

    html += `</div></div>`;
  }

  if (submissionTrend.length > 0) {
    html += `<div class="chart-section">
      <b>Submission Trend</b>
      <div class="trend-table">`;
    
    submissionTrend.forEach(trend => {
      html += `<div class="trend-row">
        <span class="trend-date">${formatDate(trend.submission_date)}</span>
        <span class="trend-count">${trend.submissions} submission${trend.submissions !== 1 ? 's' : ''}</span>
      </div>`;
    });

    html += `</div></div>`;
  }

  html += `<p class="muted small-text">Generated: ${formatDate(data.generated_at)}</p>`;
  html += `</div>`;

  reportBox.innerHTML = html;
}

// ============================================================================
// Utilities
// ============================================================================

function applyFilters() {
  STATE.currentPage = 1;
  loadCandidates();
}
