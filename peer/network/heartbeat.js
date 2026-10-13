const dgram = require("dgram");

const HEARTBEAT_INTERVAL = 3000;
const HEARTBEAT_TIMEOUT = 9000;

const HEARTBEAT_PORT_OFFSET = 1000;

function startHeartbeat(
    peerInfo,
    peerTable,
    offlineHandler = null
) {
    const socket = dgram.createSocket("udp4");

    const heartbeatPort =
        peerInfo.udpPort + HEARTBEAT_PORT_OFFSET;

    socket.on("error", (error) => {
        console.error(
            `[HEARTBEAT] Socket error: ${error.message}`
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
                ipAddress: remoteInfo.address
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

    socket.bind(
        heartbeatPort,
        "0.0.0.0",
        () => {
            console.log(
                `[HEARTBEAT] Service started ` +
                `on UDP ${heartbeatPort}`
            );

            setInterval(() => {
                sendHeartbeats(
                    socket,
                    peerInfo,
                    peerTable
                );
            }, HEARTBEAT_INTERVAL);

            setInterval(() => {
                checkPeerTimeouts(
                    peerTable,
                    offlineHandler
                );
            }, HEARTBEAT_INTERVAL);
        }
    );

    return socket;
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

        // Don't send heartbeats to peers
        // already known to be offline.
        if (peer.status !== "ONLINE") {
            continue;
        }

        const targetHeartbeatPort =
            peer.udpPort +
            HEARTBEAT_PORT_OFFSET;

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
            }
        }
    }
}


module.exports = {
    startHeartbeat
};