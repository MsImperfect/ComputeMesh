class PeerTable {
    constructor(localPeerId) {
        this.localPeerId = localPeerId;
        this.peers = new Map();
    }

    addPeer(peerInfo, allowSelf = false) {
        if (
            !peerInfo ||
            (!allowSelf && peerInfo.peerId === this.localPeerId)
        ) {
            return;
        }

        // If a node restarted on the same ip + tcpPort with a new peerId, remove the stale peer record
        for (const [id, existing] of this.peers.entries()) {
            if (id !== peerInfo.peerId && existing.ipAddress === peerInfo.ipAddress && Number(existing.tcpPort) === Number(peerInfo.tcpPort)) {
                this.peers.delete(id);
                console.log(`[PEER TABLE] Replaced stale peer ${id} with updated ${peerInfo.peerId} on ${peerInfo.ipAddress}:${peerInfo.tcpPort}`);
            }
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

    getActivePeers(timeoutMs = 9000) {
        const now = Date.now();
        return Array.from(this.peers.values()).filter((peer) => {
            if (!peer) return false;
            const isOnline = (peer.status || "").toUpperCase() === "ONLINE";
            if (!isOnline) return false;
            if (peer.lastSeen && (now - peer.lastSeen) > timeoutMs) return false;
            return true;
        });
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