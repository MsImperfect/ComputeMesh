const dgram = require("dgram");

const HEARTBEAT_INTERVAL = 3000;
const HEARTBEAT_TIMEOUT = 9000;

const HEARTBEAT_PORT_OFFSET = 1000;

function startHeartbeat(
    peerInfo,
    peerTable,
    offlineHandler = null
) {
    let currentSocket = null;
    let heartbeatInterval = null;
    let timeoutInterval = null;

    const initialHeartbeatPort =
        peerInfo.heartbeatPort || (peerInfo.udpPort + HEARTBEAT_PORT_OFFSET);

    const tryBindHeartbeat = (port) => {
        const socket = dgram.createSocket("udp4");
        currentSocket = socket;

        socket.once("error", (error) => {
            try {
                socket.close();
            } catch (_) {}

            if (error.code === "EADDRINUSE" && port < initialHeartbeatPort + 50) {
                tryBindHeartbeat(port + 1);
            } else {
                console.error(
                    `[HEARTBEAT] Socket error: ${error.message}`
                );
            }
        });

        socket.once("listening", () => {
            peerInfo.heartbeatPort = port;
            if (peerTable) {
                peerTable.addPeer(peerInfo, true);
            }

            console.log(
                `[HEARTBEAT] Service started on UDP ${port}`
            );

            socket.on("error", (error) => {
                console.error(
                    `[HEARTBEAT] Runtime error: ${error.message}`
                );
            });

            socket.on("message", (data, remoteInfo) => {
                try {
                    const message = JSON.parse(
                        data.toString()
                    );

                    if (message.type !== "HEARTBEAT") {
                        return;
                    }

                    if (!message.peer) {
                        return;
                    }

                    if (
                        message.peer.peerId ===
                        peerInfo.peerId
                    ) {
                        return;
                    }

                    const receivedPeer = {
                        ...message.peer,
                        ipAddress: remoteInfo.address,
                        heartbeatPort: message.peer.heartbeatPort || (message.peer.udpPort + HEARTBEAT_PORT_OFFSET)
                    };

                    peerTable.addPeer(
                        receivedPeer
                    );

                    console.log(
                        `[HEARTBEAT] Received from ` +
                        `${receivedPeer.peerId}`
                    );

                } catch (error) {
                    console.log(
                        `[HEARTBEAT] Invalid message: ` +
                        `${error.message}`
                    );
                }
            });

            heartbeatInterval = setInterval(() => {
                sendHeartbeats(
                    socket,
                    peerInfo,
                    peerTable
                );
            }, HEARTBEAT_INTERVAL);

            timeoutInterval = setInterval(() => {
                checkPeerTimeouts(
                    peerTable,
                    offlineHandler
                );
            }, HEARTBEAT_INTERVAL);
        });

        socket.bind(port, "0.0.0.0");
    };

    tryBindHeartbeat(initialHeartbeatPort);

    return {
        getSocket: () => currentSocket,
        stop: () => {
            if (heartbeatInterval) clearInterval(heartbeatInterval);
            if (timeoutInterval) clearInterval(timeoutInterval);
            if (currentSocket) {
                try { currentSocket.close(); } catch (_) {}
            }
        }
    };
}


// ========================================
// Send Heartbeats
// ========================================

function sendHeartbeats(
    socket,
    peerInfo,
    peerTable
) {
    const peers =
        peerTable.getAllPeers();

    if (peers.length === 0) {
        return;
    }

    const message = {
        type: "HEARTBEAT",
        peer: {
            ...peerInfo
        }
    };

    const data = Buffer.from(
        JSON.stringify(message)
    );

    for (const peer of peers) {

        if (peer.peerId === peerInfo.peerId) {
            continue;
        }

        // Don't send heartbeats to peers
        // already known to be offline.
        if (peer.status !== "ONLINE") {
            continue;
        }

        const targetHeartbeatPort =
            peer.heartbeatPort ||
            (peer.udpPort + HEARTBEAT_PORT_OFFSET);

        socket.send(
            data,
            0,
            data.length,
            targetHeartbeatPort,
            peer.ipAddress,
            (error) => {
                if (error) {
                    console.log(
                        `[HEARTBEAT] Failed to send to ` +
                        `${peer.peerId}: ` +
                        `${error.message}`
                    );
                }
            }
        );
    }
}


// ========================================
// Check Peer Timeouts
// ========================================

function checkPeerTimeouts(
    peerTable,
    offlineHandler
) {
    const now = Date.now();

    const peers =
        peerTable.getAllPeers();

    for (const peer of peers) {
        if (peer.peerId === peerTable.localPeerId) {
            continue;
        }

        const timeSinceLastSeen =
            now - peer.lastSeen;

        if (
            timeSinceLastSeen >
            HEARTBEAT_TIMEOUT
        ) {
            if (
                peer.status !== "OFFLINE"
            ) {

                peer.status =
                    "OFFLINE";

                console.log("");
                console.log(
                    "========================================"
                );
                console.log(
                    `[HEARTBEAT] ${peer.peerId} ` +
                    `marked OFFLINE`
                );
                console.log(
                    "========================================"
                );

                peerTable.printTable();

                // ====================================
                // Trigger recovery
                // ====================================

                if (
                    typeof offlineHandler ===
                    "function"
                ) {
                    offlineHandler(
                        peer.peerId
                    );
                }

                // Remove disconnected peer from active table
                peerTable.removePeer(peer.peerId);
            }
        }
    }
}


module.exports = {
    startHeartbeat
};