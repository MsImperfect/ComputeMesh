// ========================================
// Task Manager
// ========================================

class TaskManager {
    constructor(jobManager) {
        this.jobManager = jobManager;

        this.tasks = new Map();

        this.nextTaskNumber = 1;
    }

    // ====================================
    // Create Task
    // ====================================

    createTask(jobId, type, parameters) {
        const taskId =
            `TASK-${String(this.nextTaskNumber).padStart(3, "0")}`;

        this.nextTaskNumber++;

        const task = {
            taskId,
            jobId,
            type,

            ...parameters,

            status: "PENDING",

            assignedPeerId: null,

            createdAt: Date.now(),

            startedAt: null,

            completedAt: null,

            result: null,

            error: null,

            retryCount: 0
        };

        this.tasks.set(
            taskId,
            task
        );

        this.jobManager.addTask(
            jobId,
            taskId
        );

        console.log(
            `[TASK MANAGER] Created ${taskId}`
        );

        return task;
    }

    // ====================================
    // Split Prime Job
    // ====================================

    splitPrimeJob(job) {
        const start =
            Number(job.parameters.start);

        const end =
            Number(job.parameters.end);

        const taskCount =
            Number(job.parameters.taskCount) || 1;

        if (
            !Number.isInteger(start) ||
            !Number.isInteger(end)
        ) {
            throw new Error(
                "Prime job requires integer start and end"
            );
        }

        if (start > end) {
            throw new Error(
                "Prime job start cannot be greater than end"
            );
        }

        if (taskCount < 1) {
            throw new Error(
                "Task count must be at least 1"
            );
        }

        const totalNumbers =
            end - start + 1;

        const actualTaskCount =
            Math.min(
                taskCount,
                totalNumbers
            );

        const baseSize =
            Math.floor(
                totalNumbers /
                actualTaskCount
            );

        const remainder =
            totalNumbers %
            actualTaskCount;

        const tasks = [];

        let currentStart = start;

        for (
            let i = 0;
            i < actualTaskCount;
            i++
        ) {
            const extra =
                i < remainder ? 1 : 0;

            const currentSize =
                baseSize + extra;

            const currentEnd =
                currentStart +
                currentSize -
                1;

            const task =
                this.createTask(
                    job.jobId,
                    "PRIME",
                    {
                        start: currentStart,
                        end: currentEnd
                    }
                );

            tasks.push(task);

            currentStart =
                currentEnd + 1;
        }

        return tasks;
    }

    // ====================================
    // Get Task
    // ====================================

    getTask(taskId) {
        return this.tasks.get(taskId);
    }

    // ====================================
    // Get All Tasks
    // ====================================

    getAllTasks() {
        return Array.from(
            this.tasks.values()
        );
    }

    // ====================================
    // Update Task
    // ====================================

    updateTask(taskId, updates) {
        const task =
            this.tasks.get(taskId);

        if (!task) {
            return false;
        }

        Object.assign(
            task,
            updates
        );

        return true;
    }

    // ====================================
    // Print Tasks
    // ====================================

    printTasks() {
        console.log("");
        console.log(
            "========================================"
        );
        console.log(
            "             TASK MANAGER"
        );
        console.log(
            "========================================"
        );

        if (this.tasks.size === 0) {
            console.log(
                "No tasks created."
            );
        }

        for (const task of this.tasks.values()) {
            console.log(
                `${task.taskId} | ` +
                `${task.type} | ` +
                `${task.start}-${task.end} | ` +
                `Status:${task.status} | ` +
                `Peer:${task.assignedPeerId || "NONE"}`
            );
        }

        console.log(
            "========================================"
        );
        console.log("");
    }
}

module.exports = {
    TaskManager
};