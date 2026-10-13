// ========================================
// ComputeMesh Scheduler
// ========================================

class Scheduler {
    constructor(peerTable, taskManager) {
        this.peerTable = peerTable;
        this.taskManager = taskManager;
    }

    // ====================================
    // Get Eligible Peers
    // ====================================

    getEligiblePeers() {
        return this.peerTable
            .getAllPeers()
            .filter((peer) => {
                return peer.status === "ONLINE";
            });
    }

    // ====================================
    // Select Peer
    // ====================================

    selectPeer(assignedPeerIds = []) {
        const eligiblePeers =
            this.getEligiblePeers();

        if (eligiblePeers.length === 0) {
            return null;
        }

        // Prefer peers that do not already have
        // a task assigned in this scheduling round.
        const unusedPeers =
            eligiblePeers.filter((peer) => {
                return !assignedPeerIds.includes(
                    peer.peerId
                );
            });

        const candidates =
            unusedPeers.length > 0
                ? unusedPeers
                : eligiblePeers;

        // Select the peer with the most free memory.
        candidates.sort((a, b) => {
            return (
                Number(b.freeMemoryGB || 0) -
                Number(a.freeMemoryGB || 0)
            );
        });

        return candidates[0];
    }

    // ====================================
    // Schedule Tasks
    // ====================================

    scheduleTasks(tasks) {
        const assignments = [];

        const assignedPeerIds = [];

        for (const task of tasks) {

            if (task.status !== "PENDING") {
                continue;
            }

            const peer =
                this.selectPeer(
                    assignedPeerIds
                );

            if (!peer) {
                console.log(
                    `[SCHEDULER] No eligible peer ` +
                    `available for ${task.taskId}`
                );

                continue;
            }

            this.taskManager.updateTask(
                task.taskId,
                {
                    status: "ASSIGNED",
                    assignedPeerId:
                        peer.peerId
                }
            );

            assignedPeerIds.push(
                peer.peerId
            );

            assignments.push({
                taskId: task.taskId,
                peerId: peer.peerId
            });

            console.log(
                `[SCHEDULER] ${task.taskId} ` +
                `assigned to ${peer.peerId}`
            );
        }

        return assignments;
    }

    // ====================================
    // Print Assignments
    // ====================================

    printAssignments(assignments) {
        console.log("");
        console.log(
            "========================================"
        );
        console.log(
            "             SCHEDULER"
        );
        console.log(
            "========================================"
        );

        if (assignments.length === 0) {
            console.log(
                "No tasks were assigned."
            );
        }

        for (const assignment of assignments) {
            console.log(
                `${assignment.taskId} → ` +
                `${assignment.peerId}`
            );
        }

        console.log(
            "========================================"
        );
        console.log("");
    }
}

module.exports = {
    Scheduler
};