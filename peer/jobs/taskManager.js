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
    // Split Script Job (with CSV partition support)
    // ====================================

    splitScriptJob(job) {
        const scriptName = job.parameters.scriptName || "model.py";
        const scriptContent = job.parameters.scriptContent || "";
        const files = Array.isArray(job.parameters.files) ? job.parameters.files : [];
        const taskCount = Math.max(1, Number(job.parameters.taskCount) || 1);
        const splitCsv = job.parameters.splitCsv !== false;

        // Check if there is a CSV file to partition across workers
        const getFileName = f => (f && (f.filename || f.name)) || "";
        const csvFile = files.find(f => getFileName(f).toLowerCase().endsWith(".csv"));
        const csvFileName = csvFile ? getFileName(csvFile) : "data.csv";

        if (!csvFile || taskCount <= 1 || !splitCsv) {
            // No CSV splitting, create taskCount tasks with full files
            const tasks = [];
            for (let i = 0; i < taskCount; i++) {
                const task = this.createTask(
                    job.jobId,
                    "SCRIPT",
                    {
                        scriptName,
                        scriptContent,
                        entrypoint: job.parameters.entrypoint || scriptName,
                        runtime: job.parameters.runtime,
                        args: job.parameters.args || (files.length > 0 ? [getFileName(files[0])] : []),
                        files,
                        taskIndex: i,
                        sliceIndex: i,
                        taskCount,
                        totalSlices: taskCount
                    }
                );
                tasks.push(task);
            }
            return tasks;
        }

        // Split CSV file rows across tasks while preserving the header on every chunk
        const rawCsv = csvFile.content || "";
        const allLines = rawCsv.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (allLines.length <= 1) {
            // Only header or empty
            const task = this.createTask(job.jobId, "SCRIPT", {
                scriptName,
                scriptContent,
                entrypoint: job.parameters.entrypoint || scriptName,
                runtime: job.parameters.runtime,
                args: job.parameters.args || [csvFileName],
                files,
                taskIndex: 0,
                sliceIndex: 0,
                taskCount: 1,
                totalSlices: 1
            });
            return [task];
        }

        const header = allLines[0];
        const dataRows = allLines.slice(1);
        const actualTaskCount = Math.min(taskCount, dataRows.length);
        const baseSize = Math.floor(dataRows.length / actualTaskCount);
        const remainder = dataRows.length % actualTaskCount;

        const tasks = [];
        let currentRow = 0;

        for (let i = 0; i < actualTaskCount; i++) {
            const extra = i < remainder ? 1 : 0;
            const currentSize = baseSize + extra;
            const chunkRows = dataRows.slice(currentRow, currentRow + currentSize);
            currentRow += currentSize;

            const chunkCsvContent = [header, ...chunkRows].join("\n");

            // Clone files and replace the CSV file with this task's partition
            const taskFiles = files.map(f => {
                if (getFileName(f) === csvFileName) {
                    return { ...f, filename: csvFileName, name: csvFileName, content: chunkCsvContent, rowCount: chunkRows.length };
                }
                return f;
            });

            const task = this.createTask(
                job.jobId,
                "SCRIPT",
                {
                    scriptName,
                    scriptContent,
                    entrypoint: job.parameters.entrypoint || scriptName,
                    runtime: job.parameters.runtime,
                    args: job.parameters.args || [csvFileName],
                    files: taskFiles,
                    taskIndex: i,
                    sliceIndex: i,
                    taskCount: actualTaskCount,
                    totalSlices: actualTaskCount,
                    rowCount: chunkRows.length
                }
            );
            tasks.push(task);
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