// ====================================================
// runTwoPeers.js – integration test script for ComputeMesh
// ====================================================
// This script launches two peer processes with distinct IDs and ports,
// then triggers a prime-number job on the first peer after both are ready.
// It demonstrates peer discovery, task scheduling, distribution, and
// result aggregation across multiple nodes.

const { spawn } = require('child_process');
const path = require('path');

// Helper to launch a peer with custom environment variables
function launchPeer(env) {
  const child = spawn('node', [path.join('peer', 'index.js')], {
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'], // capture output for monitoring
  });
  return child;
}

// Peer configurations – ensure ports do not conflict
const peerA = {
  PEER_ID: 'P-A',
  TCP_PORT: '5001',
  UDP_PORT: '6001',
  ALLOW_SAME_HOST_PEERS: 'true',
  RUN_JOB: 'true', // trigger job on this peer after delay
};

const peerB = {
  PEER_ID: 'P-B',
  TCP_PORT: '5002',
  UDP_PORT: '6002',
  ALLOW_SAME_HOST_PEERS: 'true',
};

console.log('Launching Peer A...');
const procA = launchPeer(peerA);

let jobCompleted = false;

function attachOutput(proc, name) {
  proc.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach((line) => {
      if (line) console.log(`[${name}] ${line}`);
      if (line.includes('JOB COMPLETED')) jobCompleted = true;
    });
  });
  proc.stderr.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach((line) => {
      if (line) console.error(`[${name} ERR] ${line}`);
    });
  });
}
attachOutput(procA, 'PeerA');

// Give Peer A a moment to start its UDP listener before Peer B joins
setTimeout(() => {
  console.log('Launching Peer B...');
  const procB = launchPeer(peerB);
  attachOutput(procB, 'PeerB');

  const cleanup = () => {
    console.log('Cleaning up peers...');
    procA.kill();
    procB.kill();
    process.exit(0);
  };

  const timeout = setTimeout(() => {
    console.log('Timeout reached, terminating peers.');
    cleanup();
  }, 30000);

  const interval = setInterval(() => {
    if (jobCompleted) {
      console.log('Job completed, terminating peers.');
      clearTimeout(timeout);
      clearInterval(interval);
      cleanup();
    }
  }, 1000);

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}, 2000);
