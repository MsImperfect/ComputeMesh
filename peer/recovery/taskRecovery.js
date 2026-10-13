// ========================================
// ComputeMesh Task Recovery
// ========================================

class TaskRecovery {
    constructor(
        peerTable,
        taskManager,
        scheduler,
        distributor
    ) {
        this.peerTable = peerTable;
        this.taskManager = taskManager;
        this.scheduler = scheduler;
        this.distributor = distributor;
    }

    recoverTasksFromPeer(peerId) {
        console.log("");
        console.log(
            "========================================"
        );
        console.log(
            `[RECOVERY] Checking tasks from ${peerId}`
        );
        console.log(
            "========================================"
        );

        const tasks =
            this.taskManager.getAllTasks();

        const failedTasks = tasks.filter(
            (task) => {
                return (
                    task.assignedPeerId === peerId &&
                    (
                        task.status === "RUNNING" ||
                        task.status === "ASSIGNED"
                    )
                );
            }
        );

        if (failedTasks.length === 0) {
            console.log(
                `[RECOVERY] No unfinished tasks ` +
                `found for ${peerId}`
            );

            return [];
        }

        console.log(
            `[RECOVERY] Found ` +
            `${failedTasks.length} unfinished task(s)`
        );

        for (const task of failedTasks) {

            task.retryCount++;

            this.taskManager.updateTask(
                task.taskId,
                {
                    status: "PENDING",
                    assignedPeerId: null,
                    startedAt: null,
                    error:
                        `Worker ${peerId} went offline`
                }
            );

            console.log(
                `[RECOVERY] ${task.taskId} ` +
                `reset to PENDING ` +
                `(retry ${task.retryCount})`
            );
        }

        return failedTasks;
    }

    async redistributeTasks(tasks) {
        if (!tasks || tasks.length === 0) {
            return [];
        }

        console.log("");
        console.log(
            "========================================"
        );
        console.log(
            "[RECOVERY] Redistributing tasks"
        );
        console.log(
            "========================================"
        );

        const assignments =
            this.scheduler.scheduleTasks(
                tasks
            );

        if (assignments.length === 0) {
            console.log(
                "[RECOVERY] No replacement workers available"
            );

            return [];
        }

        this.scheduler.printAssignments(
            assignments
        );

        const results =
            await this.distributor.distributeTasks(
                tasks,
                assignments
            );

        return results;
    }
}

module.exports = {
    TaskRecovery
};