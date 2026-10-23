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

    selectPeer(peerBatchCounts = new Map()) {
        const eligiblePeers =
            this.getEligiblePeers();

        if (eligiblePeers.length === 0) {
            return null;
        }

        // Count existing active tasks across the system for each peer
        const activeTasksByPeer = new Map();
        if (this.taskManager) {
            const allTasks = this.taskManager.getAllTasks();
            for (const task of allTasks) {
                if (
                    (task.status === "ASSIGNED" || task.status === "RUNNING") &&
                    task.assignedPeerId
                ) {
                    activeTasksByPeer.set(
                        task.assignedPeerId,
                        (activeTasksByPeer.get(task.assignedPeerId) || 0) + 1
                    );
                }
            }
        }

        // Sort candidates by total load (existing active tasks + current batch assignments),
        // breaking ties with free memory (higher free memory first).
        const candidates = [...eligiblePeers].sort((a, b) => {
            const loadA =
                (activeTasksByPeer.get(a.peerId) || 0) +
                (peerBatchCounts.get(a.peerId) || 0);

            const loadB =
                (activeTasksByPeer.get(b.peerId) || 0) +
                (peerBatchCounts.get(b.peerId) || 0);

            if (loadA !== loadB) {
                return loadA - loadB; // least loaded first
            }

            return (
                Number(b.freeMemoryGB || 0) -
                Number(a.freeMemoryGB || 0)
            );
        });

        const selected = candidates[0];
        if (selected) {
            peerBatchCounts.set(
                selected.peerId,
                (peerBatchCounts.get(selected.peerId) || 0) + 1
            );
        }

        return selected;
    }

    // ====================================
    // Schedule Tasks
    // ====================================

    scheduleTasks(tasks) {
        const assignments = [];
        const peerBatchCounts = new Map();

        for (const task of tasks) {

            if (task.status !== "PENDING") {
                continue;
            }

            const peer =
                this.selectPeer(
                    peerBatchCounts
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