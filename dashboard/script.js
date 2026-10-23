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

const inputJobType = document.getElementById('input-job-type');
const sectionScriptJob = document.getElementById('section-script-job');
const sectionPrimeJob = document.getElementById('section-prime-job');

const inputScriptName = document.getElementById('input-script-name');
const inputScriptContent = document.getElementById('input-script-content');
const inputScriptFile = document.getElementById('input-script-file');

const inputDataName = document.getElementById('input-data-name');
const inputDataContent = document.getElementById('input-data-content');
const inputDataFile = document.getElementById('input-data-file');

const inputScriptSlices = document.getElementById('input-script-slices');
const inputSplitCsv = document.getElementById('input-split-csv');

const btnSamplePython = document.getElementById('btn-sample-python');
const btnSampleNode = document.getElementById('btn-sample-node');

// Open / Close Modal
btnQuickJob.addEventListener('click', () => {
  jobModal.classList.remove('hidden');
});

[btnCloseModal, btnCancelModal].forEach(b => {
  if (b) {
    b.addEventListener('click', () => {
      jobModal.classList.add('hidden');
    });
  }
});

btnClearLogs.addEventListener('click', () => {
  terminalStream.innerHTML = '';
});

// Mode switch: SCRIPT vs PRIME
if (inputJobType) {
  inputJobType.addEventListener('change', () => {
    if (inputJobType.value === 'SCRIPT') {
      sectionScriptJob.classList.remove('hidden');
      sectionPrimeJob.classList.add('hidden');
    } else {
      sectionScriptJob.classList.add('hidden');
      sectionPrimeJob.classList.remove('hidden');
    }
  });
}

// Preset: Python ML / Data Analytics
const SAMPLE_PYTHON_SCRIPT = `# model.py - Distributed Feature Analysis & Linear Regression
import csv
import json
import os
import sys

print("[PYTHON WORKER] Running distributed ML model on input dataset...")

data_file = "data.csv"
if not os.path.exists(data_file):
    print(f"Error: {data_file} not found!", file=sys.stderr)
    sys.exit(1)

rows = []
with open(data_file, "r", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        rows.append(row)

count = len(rows)
print(f"[PYTHON WORKER] Read {count} samples from assigned dataset slice.")

if count == 0:
    summary = {"samples": 0, "status": "empty"}
else:
    # Compute statistical metrics
    xs = [float(r.get("x", 0)) for r in rows if "x" in r]
    ys = [float(r.get("y", 0)) for r in rows if "y" in r]
    mean_x = sum(xs) / len(xs) if xs else 0.0
    mean_y = sum(ys) / len(ys) if ys else 0.0
    
    # Calculate simple linear regression slope
    var_x = sum((x - mean_x) ** 2 for x in xs)
    cov_xy = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
    slope = (cov_xy / var_x) if var_x != 0 else 0.0
    intercept = mean_y - (slope * mean_x)

    summary = {
        "samples": count,
        "mean_x": round(mean_x, 4),
        "mean_y": round(mean_y, 4),
        "regression_slope": round(slope, 4),
        "regression_intercept": round(intercept, 4)
    }

print("[PYTHON WORKER] Model computed:", json.dumps(summary))

# Save output to result.json for automated collection
with open("result.json", "w", encoding="utf-8") as out:
    json.dump(summary, out, indent=2)

print("[PYTHON WORKER] Successfully saved result.json")
`;

const SAMPLE_CSV_DATA = `id,x,y,category
1,1.0,2.1,A
2,2.0,3.9,A
3,3.0,6.2,A
4,4.0,7.9,A
5,5.0,10.1,B
6,6.0,11.8,B
7,7.0,14.2,B
8,8.0,16.0,B
9,9.0,18.1,C
10,10.0,20.0,C
11,11.0,22.2,C
12,12.0,24.1,C
13,13.0,26.0,D
14,14.0,28.3,D
15,15.0,30.1,D
16,16.0,32.4,D`;

const SAMPLE_NODE_SCRIPT = `// model.js - Distributed Node.js Dataset Processor
const fs = require('fs');

console.log('[NODE WORKER] Starting dataset slice processing...');
const raw = fs.readFileSync('data.csv', 'utf8');
const lines = raw.trim().split('\\n');
const headers = lines[0].split(',');
const rows = lines.slice(1).map(l => l.split(','));

console.log(\`[NODE WORKER] Processed \${rows.length} rows with headers: \${headers.join(', ')}\`);

let sumX = 0, sumY = 0;
rows.forEach(r => {
    sumX += parseFloat(r[1]) || 0;
    sumY += parseFloat(r[2]) || 0;
});

const result = {
    rowCount: rows.length,
    avgX: rows.length ? +(sumX / rows.length).toFixed(3) : 0,
    avgY: rows.length ? +(sumY / rows.length).toFixed(3) : 0,
    workerNode: process.platform + '-' + process.arch
};

fs.writeFileSync('result.json', JSON.stringify(result, null, 2));
console.log('[NODE WORKER] Output generated:', JSON.stringify(result));
`;

if (btnSamplePython) {
  btnSamplePython.addEventListener('click', () => {
    inputScriptName.value = 'model.py';
    inputScriptContent.value = SAMPLE_PYTHON_SCRIPT;
    inputDataName.value = 'data.csv';
    inputDataContent.value = SAMPLE_CSV_DATA;
    inputScriptSlices.value = '2';
    logMessage('Loaded Python ML + data.csv sample into dispatcher form.', 'info');
  });
}

if (btnSampleNode) {
  btnSampleNode.addEventListener('click', () => {
    inputScriptName.value = 'model.js';
    inputScriptContent.value = SAMPLE_NODE_SCRIPT;
    inputDataName.value = 'data.csv';
    inputDataContent.value = SAMPLE_CSV_DATA;
    inputScriptSlices.value = '2';
    logMessage('Loaded Node.js data slicer sample into dispatcher form.', 'info');
  });
}

// File Upload Handlers (read local disk files directly into inputs)
function setupFileReader(fileInput, nameInput, contentTextarea) {
  if (!fileInput) return;
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (nameInput) nameInput.value = file.name;
    const reader = new FileReader();
    reader.onload = (ev) => {
      contentTextarea.value = ev.target.result;
      logMessage(`Loaded file "${file.name}" (${file.size} bytes) into form.`, 'info');
    };
    reader.onerror = () => {
      logMessage(`Failed to read file "${file.name}"`, 'error');
    };
    reader.readAsText(file);
  });
}

setupFileReader(inputScriptFile, inputScriptName, inputScriptContent);
setupFileReader(inputDataFile, inputDataName, inputDataContent);

// Initialize with Python Sample pre-loaded by default
if (inputScriptContent && !inputScriptContent.value) {
  inputScriptName.value = 'model.py';
  inputScriptContent.value = SAMPLE_PYTHON_SCRIPT;
  inputDataName.value = 'data.csv';
  inputDataContent.value = SAMPLE_CSV_DATA;
}

function logMessage(text, type = 'info') {
  const line = document.createElement('div');
  line.className = `log-line ${type}`;
  const now = new Date().toLocaleTimeString();
  line.innerHTML = `<span class="log-time">[${now}]</span> <span>${escapeHtml(text)}</span>`;
  terminalStream.appendChild(line);
  terminalStream.scrollTop = terminalStream.scrollHeight;
}

// Submit job via API
jobForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const jobType = inputJobType ? inputJobType.value : 'SCRIPT';
  jobModal.classList.add('hidden');

  if (jobType === 'SCRIPT') {
    const scriptName = (inputScriptName.value || 'model.py').trim();
    const scriptContent = inputScriptContent.value;
    const dataName = (inputDataName.value || 'data.csv').trim();
    const dataContent = inputDataContent.value;
    const taskCount = Math.max(1, parseInt(inputScriptSlices.value, 10) || 1);
    const splitCsv = inputSplitCsv ? inputSplitCsv.checked : true;

    if (!scriptContent.trim()) {
      logMessage('Cannot submit empty script content.', 'error');
      return;
    }

    const files = [];
    if (dataContent.trim()) {
      files.push({
        filename: dataName,
        content: dataContent
      });
    }

    logMessage(`Dispatching Script Job "${scriptName}" with ${files.length} data file(s) across ${taskCount} worker(s)...`, 'info');

    try {
      const res = await fetch('/api/submit-script-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptName,
          scriptContent,
          files,
          taskCount,
          splitCsv
        })
      });
      const data = await res.json();
      if (data.success) {
        logMessage(`Script job dispatched successfully: ${data.jobId} (${taskCount} slices)`, 'success');
      } else {
        logMessage(`Job submission error: ${data.error || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      logMessage(`Network error submitting script job: ${err.message}`, 'error');
    }

  } else {
    // PRIME BENCHMARK
    const rangeStart = parseInt(document.getElementById('input-range-start').value, 10);
    const rangeEnd = parseInt(document.getElementById('input-range-end').value, 10);
    const tasksCount = parseInt(document.getElementById('input-tasks-count').value, 10);

    logMessage(`Submitting Prime job (range ${rangeStart} - ${rangeEnd}, ${tasksCount} tasks)...`, 'info');

    try {
      const res = await fetch('/api/submit-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rangeStart, rangeEnd, tasksCount })
      });
      const data = await res.json();
      if (data.success) {
        logMessage(`Prime job initiated successfully: ${data.jobId || 'Active'}`, 'success');
      } else {
        logMessage(`Job submission failed: ${data.error || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      logMessage(`Network error submitting job: ${err.message}`, 'error');
    }
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
  const activePeers = (peers || []).filter(p => {
    const s = (p.status || '').toUpperCase();
    return s === 'ONLINE' || s === 'ACTIVE';
  });

  statPeerCount.textContent = activePeers.length;
  badgePeerCount.textContent = `${activePeers.length} Active Nodes`;

  const totalCores = activePeers.reduce((sum, p) => sum + (Number(p.cpuCores) || 0), 0);
  const totalRam = activePeers.reduce((sum, p) => sum + (parseFloat(p.totalMemoryGB) || 0), 0);

  statCpuCores.innerHTML = `${totalCores} <span class="stat-unit">Cores</span>`;
  statRamTotal.textContent = `${totalRam.toFixed(1)} GB Active Cluster Memory`;

  if (activePeers.length > 0) {
    statPeerSub.textContent = activePeers.map(p => p.peerId).join(', ') + ' connected';
  } else {
    statPeerSub.textContent = 'Waiting for node broadcast';
  }

  statJobCount.textContent = jobs.length;
  badgeJobCount.textContent = `${jobs.length} Jobs`;

  const completed = jobs.filter(j => j.status === 'COMPLETED').length;
  const running = jobs.filter(j => j.status === 'RUNNING' || j.status === 'IN_PROGRESS' || j.status === 'DISPATCHED').length;
  statJobSub.textContent = `Completed: ${completed} | In Flight: ${running}`;
}

function renderPeers(peers) {
  const activePeers = (peers || []).filter(p => {
    const s = (p.status || '').toUpperCase();
    return s === 'ONLINE' || s === 'ACTIVE';
  });

  if (activePeers.length === 0) {
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

  peerTableBody.innerHTML = activePeers.map(p => {
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
    const totalTasks = (j.taskIds && j.taskIds.length) || (j.parameters && j.parameters.taskCount) || (j.totalTasks) || 1;
    const completedTasks = (j.completedTasks && j.completedTasks.length) || (j.completedCount) || (j.results && j.results.length) || (j.status === 'COMPLETED' ? totalTasks : 0);
    const pct = Math.min(100, Math.round((completedTasks / totalTasks) * 100));

    const isDone = j.status === 'COMPLETED';
    const isScript = j.type === 'SCRIPT';
    const scriptName = (j.parameters && j.parameters.scriptName) || 'Script Task';

    let resultHtml = '';
    if (isDone && j.result) {
      if (isScript) {
        const tasks = j.result.tasks || [];
        const taskCards = tasks.map((t, idx) => {
          const sliceNum = t.sliceIndex !== undefined ? t.sliceIndex + 1 : idx + 1;
          const totalSlices = t.totalSlices || tasks.length;
          const stdoutText = t.stdout ? escapeHtml(t.stdout) : '(No stdout output)';
          const outputDataStr = t.outputData ? `<div style="margin-top: 4px; color: #a5b4fc;">Output Data: <code>${escapeHtml(JSON.stringify(t.outputData))}</code></div>` : '';

          return `
            <div class="script-task-item">
              <div class="script-task-header">
                <span>Slice <strong>${sliceNum}/${totalSlices}</strong> &bull; Worker: <strong>${escapeHtml(t.assignedTo || 'local')}</strong></span>
                <span class="status-badge ${t.exitCode === 0 ? 'active' : 'busy'}">Exit ${t.exitCode !== undefined ? t.exitCode : 0} &bull; ${t.executionTimeMs || 0}ms</span>
              </div>
              ${outputDataStr}
              <div class="task-stdout-view">${stdoutText}</div>
            </div>
          `;
        }).join('');

        resultHtml = `
          <div class="script-summary-banner">
            <div class="script-summary-title">
              <span>Execution Succeeded across ${tasks.length} worker partition(s)</span>
              <span>Total Time: ${j.executionTimeMs || (j.result.executionTimeMs || 0)} ms</span>
            </div>
            <div class="script-task-list">
              ${taskCards}
            </div>
          </div>
        `;
      } else {
        resultHtml = `
          <div class="job-result-banner">
            Result: Prime Count = ${JSON.stringify(j.result.primeCount !== undefined ? j.result.primeCount : j.result)}
          </div>
        `;
      }
    }

    return `
      <div class="job-card">
        <div class="job-card-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span class="job-id">${escapeHtml(j.jobId)}</span>
            <span class="badge" style="${isScript ? 'background: rgba(16, 185, 129, 0.15); color: #6ee7b7;' : ''}">${escapeHtml(isScript ? `SCRIPT: ${scriptName}` : (j.type || 'COMPUTE'))}</span>
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

        ${resultHtml}
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
