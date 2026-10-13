// ComputeMesh Dynamic Dashboard Controller
let previousPeerCount = 0;
let previousJobCount = 0;

const peerTableBody = document.getElementById('peer-table-body');
const jobsContainer = document.getElementById('jobs-container');
const terminalStream = document.getElementById('terminal-stream');

const statPeerCount = document.getElementById('stat-peer-count');
const statPeerSub = document.getElementById('stat-peer-sub');
const statJobCount = document.getElementById('stat-job-count');
const statJobSub = document.getElementById('stat-job-sub');
const statCpuCores = document.getElementById('stat-cpu-cores');
const statRamTotal = document.getElementById('stat-ram-total');
const badgePeerCount = document.getElementById('badge-peer-count');
const badgeJobCount = document.getElementById('badge-job-count');

// Modal controls
const jobModal = document.getElementById('job-modal');
const btnQuickJob = document.getElementById('btn-quick-job');
const btnCloseModal = document.getElementById('btn-close-modal');
const btnCancelModal = document.getElementById('btn-cancel-modal');
const jobForm = document.getElementById('job-form');
const btnClearLogs = document.getElementById('btn-clear-logs');

btnQuickJob.addEventListener('click', () => {
  jobModal.classList.remove('hidden');
});

[btnCloseModal, btnCancelModal].forEach(b => {
  b.addEventListener('click', () => {
    jobModal.classList.add('hidden');
  });
});

btnClearLogs.addEventListener('click', () => {
  terminalStream.innerHTML = '';
});

function logMessage(text, type = 'info') {
  const line = document.createElement('div');
  line.className = `log-line ${type}`;
  const now = new Date().toLocaleTimeString();
  line.innerHTML = `<span class="log-time">[${now}]</span> <span>${text}</span>`;
  terminalStream.appendChild(line);
  terminalStream.scrollTop = terminalStream.scrollHeight;
}

// Submit job via API
jobForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const rangeStart = parseInt(document.getElementById('input-range-start').value, 10);
  const rangeEnd = parseInt(document.getElementById('input-range-end').value, 10);
  const tasksCount = parseInt(document.getElementById('input-tasks-count').value, 10);

  jobModal.classList.add('hidden');
  logMessage(`Submitting Prime job (range ${rangeStart} - ${rangeEnd}, ${tasksCount} tasks)...`, 'info');

  try {
    const res = await fetch('/api/submit-job', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rangeStart, rangeEnd, tasksCount })
    });
    const data = await res.json();
    if (data.success) {
      logMessage(`Job initiated successfully: ${data.jobId || 'Active'}`, 'success');
    } else {
      logMessage(`Job submission failed: ${data.error || 'Unknown error'}`, 'error');
    }
  } catch (err) {
    logMessage(`Network error submitting job: ${err.message}`, 'error');
  }
});

// Periodic fetch status
async function updateClusterStatus() {
  try {
    const res = await fetch('/status');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const peers = data.peers || [];
    const jobs = data.jobs || [];

    // Log peer events
    if (peers.length !== previousPeerCount) {
      if (peers.length > previousPeerCount) {
        logMessage(`Peer membership change: ${peers.length} active node(s) detected.`, 'info');
      }
      previousPeerCount = peers.length;
    }

    if (jobs.length > previousJobCount) {
      logMessage(`New job registered: ${jobs[jobs.length - 1].jobId}`, 'info');
      previousJobCount = jobs.length;
    }

    renderStats(peers, jobs);
    renderPeers(peers);
    renderJobs(jobs);

  } catch (err) {
    console.error('Error polling /status:', err);
  }
}

function renderStats(peers, jobs) {
  statPeerCount.textContent = peers.length;
  badgePeerCount.textContent = `${peers.length} Nodes`;

  const totalCores = peers.reduce((sum, p) => sum + (p.cpuCores || 0), 0);
  const totalRam = peers.reduce((sum, p) => sum + (p.totalMemoryGB || 0), 0);

  statCpuCores.innerHTML = `${totalCores} <span class="stat-unit">Cores</span>`;
  statRamTotal.textContent = `${totalRam.toFixed(1)} GB Aggregated Memory`;

  statPeerSub.textContent = peers.length > 0 
    ? `${peers.map(p => p.peerId).join(', ')} online`
    : 'Waiting for node broadcast';

  statJobCount.textContent = jobs.length;
  badgeJobCount.textContent = `${jobs.length} Jobs`;

  const completed = jobs.filter(j => j.status === 'COMPLETED').length;
  const running = jobs.filter(j => j.status === 'RUNNING' || j.status === 'IN_PROGRESS').length;
  statJobSub.textContent = `Completed: ${completed} | In Flight: ${running}`;
}

function renderPeers(peers) {
  if (peers.length === 0) {
    peerTableBody.innerHTML = `
      <tr>
        <td colspan="5" class="empty-state">
          <div class="loading-spinner"></div>
          <span>Discovering peer nodes via UDP broadcast...</span>
        </td>
      </tr>
    `;
    return;
  }

  peerTableBody.innerHTML = peers.map(p => {
    const statusClass = (p.status || 'ACTIVE').toLowerCase();
    const lastSeenFormatted = p.lastSeen ? new Date(p.lastSeen).toLocaleTimeString() : 'Just now';

    return `
      <tr>
        <td>
          <span class="node-pill">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="2" width="20" height="20" rx="3"></rect>
            </svg>
            ${escapeHtml(p.peerId || 'Unknown')}
          </span>
        </td>
        <td>
          <span class="endpoint-tag">${escapeHtml(p.ipAddress || '127.0.0.1')}:${p.tcpPort || '-'}</span>
          <span style="font-size: 11px; color: var(--text-sub);"> (UDP:${p.udpPort || '-'})</span>
        </td>
        <td>
          <span class="hardware-tag">${p.cpuCores || 1} Cores &bull; ${p.freeMemoryGB || '-'}GB free / ${p.totalMemoryGB || '-'}GB</span>
        </td>
        <td>
          <span class="status-badge ${statusClass}">
            <span class="pulse-dot" style="width: 6px; height: 6px;"></span>
            ${escapeHtml(p.status || 'ACTIVE')}
          </span>
        </td>
        <td style="color: var(--text-muted); font-size: 12px;">
          ${lastSeenFormatted}
        </td>
      </tr>
    `;
  }).join('');
}

function renderJobs(jobs) {
  if (jobs.length === 0) {
    jobsContainer.innerHTML = `
      <div class="empty-state">
        <span>No jobs submitted yet. Click <strong>Dispatch Compute Job</strong> to run work across the mesh.</span>
      </div>
    `;
    return;
  }

  // Reverse so newest jobs show up first
  jobsContainer.innerHTML = [...jobs].reverse().map(j => {
    const totalTasks = (j.taskIds && j.taskIds.length) || (j.totalTasks) || 1;
    const completedTasks = (j.completedTasks && j.completedTasks.length) || (j.completedCount) || (j.status === 'COMPLETED' ? totalTasks : 0);
    const pct = Math.round((completedTasks / totalTasks) * 100);

    const isDone = j.status === 'COMPLETED';

    return `
      <div class="job-card">
        <div class="job-card-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span class="job-id">${escapeHtml(j.jobId)}</span>
            <span class="badge">${escapeHtml(j.type || 'COMPUTE')}</span>
          </div>
          <span class="status-badge ${isDone ? 'active' : 'busy'}">${escapeHtml(j.status)}</span>
        </div>

        <div class="job-meta">
          <span>Tasks: <strong>${completedTasks} / ${totalTasks}</strong></span>
          ${j.range ? `<span>Range: <strong>${j.range.start} – ${j.range.end}</strong></span>` : ''}
          ${j.executionTimeMs ? `<span>Time: <strong>${j.executionTimeMs} ms</strong></span>` : ''}
        </div>

        <div class="job-progress-bar">
          <div class="job-progress-fill" style="width: ${pct}%"></div>
        </div>

        ${isDone && j.result ? `
          <div class="job-result-banner">
            Result: Prime Count = ${JSON.stringify(j.result.primeCount !== undefined ? j.result.primeCount : j.result)}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Initial poll and recurring poll
updateClusterStatus();
setInterval(updateClusterStatus, 1500);
