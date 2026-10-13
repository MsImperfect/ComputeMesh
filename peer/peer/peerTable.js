class PeerTable {
    constructor(localPeerId) {
        this.localPeerId = localPeerId;
        this.peers = new Map();
    }

    addPeer(peerInfo) {
        if (
            !peerInfo ||
            peerInfo.peerId === this.localPeerId
        ) {
            return;
        }

        const existingPeer =
            this.peers.get(peerInfo.peerId);

        this.peers.set(peerInfo.peerId, {
            ...existingPeer,
            ...peerInfo,
            lastSeen: Date.now(),
            status: "ONLINE"
        });

        if (!existingPeer) {
            console.log(
                `[PEER TABLE] Added peer ${peerInfo.peerId}`
            );
        }
    }

    removePeer(peerId) {
        if (this.peers.delete(peerId)) {
            console.log(
                `[PEER TABLE] Removed peer ${peerId}`
            );
        }
    }

    getPeer(peerId) {
        return this.peers.get(peerId);
    }

    getAllPeers() {
        return Array.from(
            this.peers.values()
        );
    }

    getPeerCount() {
        return this.peers.size;
    }

    printTable() {
        console.log("");
        console.log(
            "========================================"
        );
        console.log(
            "             PEER TABLE"
        );
        console.log(
            "========================================"
        );

        if (this.peers.size === 0) {
            console.log(
                "No other peers discovered."
            );
        } else {
            for (const peer of this.peers.values()) {
                console.log(
                    `${peer.peerId} | ` +
                    `${peer.ipAddress}:${peer.tcpPort} | ` +
                    `UDP:${peer.udpPort} | ` +
                    `CPU:${peer.cpuCores} | ` +
                    `Status:${peer.status}`
                );
            }
        }

        console.log(
            "========================================"
        );
        console.log("");
    }
}

module.exports = {
    PeerTable
};