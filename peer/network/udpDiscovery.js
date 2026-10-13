const dgram = require("dgram");

// UDP ports used by peers during local/LAN discovery
const DISCOVERY_PORT_START = 6001;
const DISCOVERY_PORT_END = 6010;

function startUDPDiscovery(peerInfo, peerTable) {
    const socket = dgram.createSocket("udp4");

    socket.on("error", (error) => {
        console.error(
            `[UDP] Socket error: ${error.message}`
        );
    });

    socket.on("message", (data, remoteInfo) => {
        try {
            const message = JSON.parse(data.toString());

            console.log(
                `[UDP] Received ${message.type} ` +
                `from ${remoteInfo.address}:${remoteInfo.port}`
            );

            if (message.type === "DISCOVERY") {
                handleDiscovery(
                    socket,
                    peerInfo,
                    peerTable,
                    message,
                    remoteInfo
                );
            }

            if (message.type === "PEER_INFO") {
                handlePeerInfo(
                    message,
                    peerTable
                );
            }

        } catch (error) {
            console.log(
                `[UDP] Invalid message: ${error.message}`
            );
        }
    });

    // Attempt to bind to the desired UDP port; if it's already in use, try subsequent ports in the range.
    const tryBind = (port) => {
        socket.once('error', (err) => {
            if (err.code === 'EADDRINUSE' && port < DISCOVERY_PORT_END) {
                // Try next port
                tryBind(port + 1);
            } else {
                console.error(`[UDP] Failed to bind UDP socket: ${err.message}`);
            }
        });
        socket.once('listening', () => {
            socket.setBroadcast(true);
            peerInfo.udpPort = port; // Update to actual bound port
            console.log(`[UDP] Discovery service listening on port ${port}`);
            setTimeout(() => {
                broadcastDiscovery(socket, peerInfo);
            }, 500);
        });
        socket.bind(port, "0.0.0.0");
    };
    tryBind(peerInfo.udpPort);

    return socket;
}


// ========================================
// Broadcast Discovery
// ========================================

function broadcastDiscovery(socket, peerInfo) {
    const message = {
        type: "DISCOVERY",
        peer: peerInfo
    };

    const data = Buffer.from(
        JSON.stringify(message)
    );

    console.log(
        `[UDP] Starting discovery broadcast from ${peerInfo.peerId}`
    );

    for (
        let port = DISCOVERY_PORT_START;
        port <= DISCOVERY_PORT_END;
        port++
    ) {
        socket.send(
            data,
            0,
            data.length,
            port,
            "255.255.255.255",
            (error) => {
                if (error) {
                    console.error(
                        `[UDP] Broadcast to port ${port} failed: ${error.message}`
                    );
                }
            }
        );
    }

    console.log(
        `[UDP] Discovery broadcast sent by ${peerInfo.peerId}`
    );
}


// ========================================
// Handle Discovery
// ========================================

function handleDiscovery(
    socket,
    peerInfo,
    peerTable,
    message,
    remoteInfo
) {
    if (!message.peer) {
        return;
    }

    // Ignore our own discovery packet
    if (
        message.peer.peerId === peerInfo.peerId
    ) {
        return;
    }

    const discoveredPeer = {
        ...message.peer,
        ipAddress: remoteInfo.address
    };

    peerTable.addPeer(discoveredPeer);

    console.log(
        `[UDP] Discovered peer ${discoveredPeer.peerId}`
    );

    // Send our information directly back
    const response = {
        type: "PEER_INFO",
        peer: {
            ...peerInfo
        }
    };

    const data = Buffer.from(
        JSON.stringify(response)
    );

    socket.send(
        data,
        0,
        data.length,
        discoveredPeer.udpPort,
        discoveredPeer.ipAddress,
        (error) => {
            if (error) {
                console.error(
                    `[UDP] Failed to send PEER_INFO to ` +
                    `${discoveredPeer.peerId}: ${error.message}`
                );
            } else {
                console.log(
                    `[UDP] Sent PEER_INFO to ${discoveredPeer.peerId}`
                );
            }
        }
    );

    peerTable.printTable();
}


// ========================================
// Handle Peer Information
// ========================================

function handlePeerInfo(
    message,
    peerTable
) {
    if (!message.peer) {
        return;
    }

    peerTable.addPeer(message.peer);

    peerTable.printTable();
}


module.exports = {
    startUDPDiscovery
};