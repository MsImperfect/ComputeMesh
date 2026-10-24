const os = require("os");
const path = require('path');

const {
    startTCPServer
} = require("./network/tcpServer");

const {
    startUDPDiscovery
} = require("./network/udpDiscovery");

const {
    startHeartbeat
} = require("./network/heartbeat");

const {
    PeerTable
} = require("./peer/peerTable");

const {
    startResourceMonitor
} = require("./scheduler/resourceMonitor");

const {
    executeTask
} = require("./compute/executor");

const {
    MESSAGE_TYPES
} = require("./network/protocol");

const {
    JobController
} = require("./jobs/jobController");

// ========================================
// Peer Configuration
// ========================================

const PEER_ID =
    process.env.PEER_ID || `P${process.pid}`;

const TCP_PORT =
    Number(process.env.TCP_PORT) || 5001;

const UDP_PORT =
    Number(process.env.UDP_PORT) || 6001;

// ========================================
// Network Information
// ========================================

function getLocalIP() {
    const interfaces =
        os.networkInterfaces();

    for (
        const interfaceName of
        Object.keys(interfaces)
    ) {
        for (
            const network of
            interfaces[interfaceName]
        ) {
            if (
                network.family === "IPv4" &&
                !network.internal
            ) {
                return network.address;
            }
        }
    }

    return "127.0.0.1";
}

// ========================================
// System Information
// ========================================

function getSystemInfo() {
    const cpuCores =
        os.cpus().length;

    const totalMemoryGB = (
        os.totalmem() /
        (1024 ** 3)
    ).toFixed(2);

    const freeMemoryGB = (
        os.freemem() /
        (1024 ** 3)
    ).toFixed(2);

    return {
        cpuCores,
        totalMemoryGB,
        freeMemoryGB
    };
}

// ========================================
// Peer Information
// ========================================

const localIP =
    process.env.PEER_IP ||
    process.env.LOCAL_IP ||
    getLocalIP();

const systemInfo =
    getSystemInfo();

const peerInfo = {
    peerId: PEER_ID,
    ipAddress: localIP,
    tcpPort: TCP_PORT,
    udpPort: UDP_PORT,

    cpuCores:
        systemInfo.cpuCores,

    totalMemoryGB:
        systemInfo.totalMemoryGB,

    freeMemoryGB:
        systemInfo.freeMemoryGB,

    usedMemoryGB: null,

    memoryUsagePercent: null,

    status: "ONLINE"
};

// ========================================
// Peer Table
// ========================================

const peerTable =
    new PeerTable(PEER_ID, localIP);
// Register self in the peer table so we can assign tasks locally
peerTable.addPeer(peerInfo, true);

// ========================================
// Job Controller
// ========================================

const jobController =
    new JobController(
        peerTable
    );

// ========================================
// TCP Message Handler
// ========================================

async function handleTCPMessage(
    message,
    socket
) {
    console.log(
        `[TCP] Message type: ${message.type}`
    );

    // ====================================
    // HELLO
    // ====================================

    if (
        message.type ===
        MESSAGE_TYPES.HELLO
    ) {
        console.log(
            `[TCP] HELLO received ` +
            `from ${message.peerId}`
        );

        const response = {
            type: MESSAGE_TYPES.ACK,
            peerId: PEER_ID
        };

        socket.write(
            JSON.stringify(
                response
            ) + "\n"
        );

        return;
    }

    // ====================================
    // TASK
    // ====================================

    if (
        message.type ===
        MESSAGE_TYPES.TASK
    ) {
        console.log("");
        console.log(
            "========================================"
        );
        console.log(
            "[TCP] TASK RECEIVED"
        );
        console.log(
            "========================================"
        );

        try {

            if (!message.task) {
                throw new Error(
                    "TASK message contains no task"
                );
            }

            console.log(
                `[TCP] Task ID: ` +
                `${message.task.taskId}`
            );

            console.log(
                `[TCP] Task Type: ` +
                `${message.task.type}`
            );

            const result =
                await executeTask(
                    message.task
                );

            const response = {
                type:
                    MESSAGE_TYPES.TASK_RESULT,

                taskId:
                    message.task.taskId,

                peerId:
                    PEER_ID,

                result
            };

            socket.write(
                JSON.stringify(
                    response
                ) + "\n"
            );

            console.log(
                `[TCP] TASK_RESULT sent`
            );

        } catch (error) {

            console.error(
                `[TCP] Task execution failed: ` +
                `${error.message}`
            );

            const response = {
                type:
                    MESSAGE_TYPES.ERROR,

                taskId:
                    message.task
                        ? message.task.taskId
                        : null,

                peerId:
                    PEER_ID,

                message:
                    error.message
            };

            socket.write(
                JSON.stringify(
                    response
                ) + "\n"
            );
        }

        return;
    }

    console.log(
        `[TCP] Unknown message type: ` +
        `${message.type}`
    );
}

// ========================================
// Start TCP
// ========================================

startTCPServer(
    PEER_ID,
    TCP_PORT,
    handleTCPMessage,
    (boundPort) => {
        peerInfo.tcpPort = boundPort;
        peerTable.addPeer(peerInfo, true);
    }
);

// ========================================
// Start Resource Monitor
// ========================================

startResourceMonitor(
    peerInfo,
    peerTable
);

// ========================================
// Start UDP Discovery
// ========================================

startUDPDiscovery(
    peerInfo,
    peerTable,
    () => {
        jobController.retryPendingTasks().catch((err) => {
            console.error(`[JOB] Failed to retry pending tasks: ${err.message}`);
        });
    }
);

// ========================================
// Start Heartbeat
// ========================================

startHeartbeat(
    peerInfo,
    peerTable,
    (offlinePeerId) => {

        console.log(
            `[RECOVERY] Heartbeat reported ` +
            `${offlinePeerId} offline`
        );

        jobController.handlePeerOffline(
            offlinePeerId
        );
    }
);

const express = require('express');
const httpApp = express();
const HTTP_PORT = Number(process.env.HTTP_PORT) || 3000;
const dashboardDir = path.join(__dirname, '..', 'dashboard');

httpApp.use(express.json({ limit: '50mb' }));
httpApp.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Expose status endpoint (only actual active peers connected on the same network)
httpApp.get('/status', (req, res) => {
    const jobs = jobController.getAllJobs();
    const selfNode = {
        ...peerInfo,
        peerId: `${peerInfo.peerId} (Local)`,
        isSelf: true,
        status: "ONLINE",
        lastSeen: Date.now()
    };
    // Only return actual active peers currently connected on network
    const activePeers = peerTable.getActivePeers();
    const otherActivePeers = activePeers.filter(p => p.peerId !== peerInfo.peerId);
    const peers = [selfNode, ...otherActivePeers];
    res.json({ peers, jobs, selfNode });
});

// API endpoint to submit a prime compute job
httpApp.post('/api/submit-job', (req, res) => {
    try {
        const { rangeStart = 1, rangeEnd = 100000, tasksCount = 4 } = req.body || {};
        const { job, promise } = jobController.createAndRunPrimeJob(
            Number(rangeStart),
            Number(rangeEnd),
            Number(tasksCount)
        );
        promise.catch((err) => {
            console.error(`[JOB-ERROR] ${err.message}`);
        });
        res.json({
            success: true,
            jobId: job.jobId,
            message: 'Prime compute job dispatched to mesh'
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// API endpoint to submit an arbitrary script & data file job (e.g. model.py with data.csv)
httpApp.post('/api/submit-script-job', (req, res) => {
    try {
        const {
            scriptName = "model.py",
            scriptContent = "",
            files = [],
            args = [],
            taskCount = 1,
            runtime = null,
            splitCsv = true
        } = req.body || {};

        if (!scriptContent || !scriptContent.trim()) {
            return res.status(400).json({ success: false, error: "scriptContent is required" });
        }

        const { job, promise } = jobController.createAndRunScriptJob({
            scriptName,
            scriptContent,
            files,
            args,
            taskCount: Number(taskCount) || 1,
            runtime,
            splitCsv
        });

        promise.catch((err) => {
            console.error(`[SCRIPT-JOB-ERROR] ${err.message}`);
        });

        res.json({
            success: true,
            jobId: job.jobId,
            message: `Script job ${job.jobId} (${scriptName}) dispatched across mesh`
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Serve dashboard UI at /dashboard and /
httpApp.use('/dashboard', express.static(dashboardDir));
httpApp.use(express.static(dashboardDir));
httpApp.get(['/', '/dashboard'], (req, res) => {
    res.sendFile(path.join(dashboardDir, 'index.html'));
});


console.log("");

console.log(
    "========================================"
);

console.log(
    "          COMPUTEMESH PEER"
);

console.log(
    "========================================"
);

console.log(
    `Peer ID:        ${peerInfo.peerId}`
);

console.log(
    `IP Address:     ${peerInfo.ipAddress}`
);

console.log(
    `TCP Port:       ${peerInfo.tcpPort}`
);

console.log(
    `UDP Port:       ${peerInfo.udpPort}`
);

console.log(
    "----------------------------------------"
);

console.log(
    `CPU Cores:      ${peerInfo.cpuCores}`
);

console.log(
    `Total RAM:      ${peerInfo.totalMemoryGB} GB`
);

console.log(
    `Free RAM:       ${peerInfo.freeMemoryGB} GB`
);

console.log(
    "----------------------------------------"
);

console.log(
    `Status:         ${peerInfo.status}`
);

console.log(
    "========================================"
);

console.log("");
// Start HTTP server with EADDRINUSE resilience
const httpServer = httpApp.listen(HTTP_PORT, () => {
    console.log(`[HTTP] Status server listening on port ${HTTP_PORT}`);
});
httpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.warn(`[HTTP] Port ${HTTP_PORT} is in use; dashboard HTTP skipped for this secondary peer.`);
    } else {
        console.error(`[HTTP] Server error: ${err.message}`);
    }
});

// ========================================
// Optional Job Test
// ========================================

if (
    process.env.RUN_JOB === "true"
) {
    setTimeout(
        async () => {

            try {

                await jobController.runPrimeJob(
                    1,
                    100000,
                    4
                );

            } catch (error) {

                console.error(
                    `[JOB] ${error.message}`
                );
            }

        },
        5000
    );
}