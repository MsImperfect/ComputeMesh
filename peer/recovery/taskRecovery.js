// ========================================
// ComputeMesh Task Recovery
// ========================================

const MAX_TASK_RETRIES = 3;

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

        const recoverableTasks = [];

        for (const task of failedTasks) {
            if ((task.retryCount || 0) >= MAX_TASK_RETRIES) {
                this.taskManager.updateTask(
                    task.taskId,
                    {
                        status: "FAILED",
                        assignedPeerId: null,
                        startedAt: null,
                        error: `Exceeded max retries (${MAX_TASK_RETRIES}) after worker ${peerId} went offline`
                    }
                );

                console.error(
                    `[RECOVERY] ${task.taskId} marked FAILED (exceeded ${MAX_TASK_RETRIES} retries)`
                );
            } else {
                const newRetryCount = (task.retryCount || 0) + 1;
                task.retryCount = newRetryCount;

                this.taskManager.updateTask(
                    task.taskId,
                    {
                        status: "PENDING",
                        assignedPeerId: null,
                        startedAt: null,
                        retryCount: newRetryCount,
                        error: `Worker ${peerId} went offline`
                    }
                );

                console.log(
                    `[RECOVERY] ${task.taskId} ` +
                    `reset to PENDING ` +
                    `(retry ${newRetryCount}/${MAX_TASK_RETRIES})`
                );

                recoverableTasks.push(task);
            }
        }

        return recoverableTasks;
    }

    async redistributeTasks(tasks) {
        if (!tasks || tasks.length === 0) {
            return [];
        }

        const pendingTasks = tasks.filter(t => t.status === "PENDING");
        if (pendingTasks.length === 0) {
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
                pendingTasks
            );

        if (assignments.length === 0) {
            console.log(
                "[RECOVERY] No replacement workers available right now; tasks remain PENDING"
            );

            return [];
        }

        this.scheduler.printAssignments(
            assignments
        );

        const results =
            await this.distributor.distributeTasks(
                pendingTasks,
                assignments
            );

        return results;
    }
}

module.exports = {
    TaskRecovery,
    MAX_TASK_RETRIES
};

