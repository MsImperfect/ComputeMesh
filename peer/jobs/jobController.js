const {
    JobManager
} = require("./jobManager");

const {
    TaskManager
} = require("./taskManager");

const {
    ResultAggregator
} = require("./resultAggregator");

const {
    Scheduler
} = require("../scheduler/scheduler");

const {
    TaskDistributor
} = require("./taskDistributor");

const {
    TaskRecovery
} = require("../recovery/taskRecovery");

class JobController {
    constructor(peerTable) {
        this.peerTable = peerTable;

        this.jobManager =
            new JobManager();

        this.taskManager =
            new TaskManager(
                this.jobManager
            );

        this.resultAggregator =
            new ResultAggregator(
                this.jobManager,
                this.taskManager
            );

        this.scheduler =
            new Scheduler(
                this.peerTable,
                this.taskManager
            );

        this.distributor =
            new TaskDistributor(
                this.peerTable,
                this.taskManager,
                this.resultAggregator
            );

        this.recovery =
            new TaskRecovery(
                this.peerTable,
                this.taskManager,
                this.scheduler,
                this.distributor
            );

        this.activeJobs = new Set();
    }

    // ========================================
    // Run Prime Job
    // ========================================

    createAndRunPrimeJob(
        start,
        end,
        taskCount
    ) {
        console.log("");
        console.log(
            "========================================"
        );
        console.log(
            "          COMPUTEMESH JOB"
        );
        console.log(
            "========================================"
        );

        const job =
            this.jobManager.createJob(
                "PRIME",
                {
                    start,
                    end,
                    taskCount
                }
            );

        const promise = this.dispatchPrimeJob(job);
        return { job, promise };
    }

    async runPrimeJob(
        start,
        end,
        taskCount
    ) {
        const { promise } = this.createAndRunPrimeJob(start, end, taskCount);
        return await promise;
    }

    // ========================================
    // Run Script & Data File Job
    // ========================================

    createAndRunScriptJob({
        scriptName = "model.py",
        scriptContent = "",
        files = [],
        args = [],
        taskCount = 1,
        runtime = null,
        splitCsv = true
    }) {
        console.log("");
        console.log(
            "========================================"
        );
        console.log(
            "       COMPUTEMESH SCRIPT JOB           "
        );
        console.log(
            "========================================"
        );

        const job = this.jobManager.createJob(
            "SCRIPT",
            {
                scriptName,
                scriptContent,
                files,
                args,
                taskCount,
                runtime,
                splitCsv
            }
        );

        const promise = this.dispatchScriptJob(job);
        return { job, promise };
    }

    async runScriptJob(options) {
        const { promise } = this.createAndRunScriptJob(options);
        return await promise;
    }

    async dispatchScriptJob(job) {
        this.activeJobs.add(job.jobId);

        this.jobManager.updateJobStatus(
            job.jobId,
            "SPLITTING"
        );

        const tasks = this.taskManager.splitScriptJob(job);

        console.log(
            `[JOB] ${job.jobId} partitioned into ${tasks.length} script tasks across mesh`
        );

        this.jobManager.updateJobStatus(
            job.jobId,
            "SCHEDULING"
        );

        const assignments = this.scheduler.scheduleTasks(tasks);
        this.scheduler.printAssignments(assignments);

        if (assignments.length === 0) {
            this.jobManager.updateJobStatus(job.jobId, "FAILED");
            this.activeJobs.delete(job.jobId);
            throw new Error("No available workers found");
        }

        if (assignments.length < tasks.length) {
            console.warn(
                `[JOB] Warning: Only ${assignments.length} of ${tasks.length} tasks assigned; ` +
                `remaining tasks will be scheduled as workers become available.`
            );
        }

        this.jobManager.updateJobStatus(job.jobId, "RUNNING");
        await this.distributor.distributeTasks(tasks, assignments);

        const finalResult = this.resultAggregator.getJobResult(job.jobId);
        if (finalResult) {
            this.activeJobs.delete(job.jobId);
            this.printFinalResult(finalResult);
            return finalResult;
        }

        this.checkActiveJobs();

        console.log(
            `[JOB] ${job.jobId} is in progress or waiting for task completion/recovery`
        );

        return null;
    }

    async dispatchPrimeJob(job) {
        this.activeJobs.add(
            job.jobId
        );

        this.jobManager.updateJobStatus(
            job.jobId,
            "SPLITTING"
        );

        // ====================================
        // Split
        // ====================================

        const tasks =
            this.taskManager.splitPrimeJob(
                job
            );

        console.log(
            `[JOB] ${job.jobId} split into ` +
            `${tasks.length} tasks`
        );

        // ====================================
        // Schedule
        // ====================================

        this.jobManager.updateJobStatus(
            job.jobId,
            "SCHEDULING"
        );

        const assignments =
            this.scheduler.scheduleTasks(
                tasks
            );

        this.scheduler.printAssignments(
            assignments
        );

        if (
            assignments.length === 0
        ) {
            this.jobManager.updateJobStatus(
                job.jobId,
                "FAILED"
            );

            this.activeJobs.delete(
                job.jobId
            );

            throw new Error(
                "No available workers found"
            );
        }

        if (assignments.length < tasks.length) {
            console.warn(
                `[JOB] Warning: Only ${assignments.length} of ${tasks.length} tasks assigned; ` +
                `remaining tasks will be scheduled as workers become available.`
            );
        }

        // ====================================
        // Distribute
        // ====================================

        this.jobManager.updateJobStatus(
            job.jobId,
            "RUNNING"
        );

        await this.distributor.distributeTasks(
            tasks,
            assignments
        );

        // ====================================
        // Check Final Result
        // ====================================

        const finalResult =
            this.resultAggregator.getJobResult(
                job.jobId
            );

        if (finalResult) {

            this.activeJobs.delete(
                job.jobId
            );

            this.printFinalResult(
                finalResult
            );

            return finalResult;
        }

        this.checkActiveJobs();

        console.log(
            `[JOB] ${job.jobId} is in progress ` +
            `or waiting for task completion/recovery`
        );

        return null;
    }

    // ========================================
    // Handle Worker Failure
    // ========================================

    async handlePeerOffline(
        peerId
    ) {
        console.log("");
        console.log(
            "========================================"
        );
        console.log(
            `[RECOVERY] Worker failure detected: ${peerId}`
        );
        console.log(
            "========================================"
        );

        const recoveredTasks =
            this.recovery.recoverTasksFromPeer(
                peerId
            );

        if (
            recoveredTasks.length === 0
        ) {
            return;
        }

        console.log(
            `[RECOVERY] Attempting to redistribute ` +
            `${recoveredTasks.length} task(s)`
        );

        try {

            await this.recovery.redistributeTasks(
                recoveredTasks
            );

            this.checkActiveJobs();

        } catch (error) {

            console.error(
                `[RECOVERY] Redistribution failed: ` +
                `${error.message}`
            );
        }
    }

    // ========================================
    // Retry Pending Tasks (e.g. on peer join)
    // ========================================

    async retryPendingTasks() {
        for (const jobId of Array.from(this.activeJobs)) {
            const job = this.jobManager.getJob(jobId);
            if (!job || job.status === "COMPLETED" || job.status === "FAILED") {
                continue;
            }

            const pendingTasks = job.taskIds
                .map((tid) => this.taskManager.getTask(tid))
                .filter((t) => t && t.status === "PENDING");

            if (pendingTasks.length > 0) {
                console.log(
                    `[JOB] Retrying ${pendingTasks.length} pending task(s) for ${jobId}`
                );

                const assignments = this.scheduler.scheduleTasks(pendingTasks);
                if (assignments.length > 0) {
                    await this.distributor.distributeTasks(
                        pendingTasks,
                        assignments
                    );
                    this.checkActiveJobs();
                }
            }
        }
    }

    // ========================================
    // Check Active Jobs
    // ========================================

    checkActiveJobs() {
        for (
            const jobId
            of Array.from(this.activeJobs)
        ) {
            const finalResult =
                this.resultAggregator.getJobResult(
                    jobId
                );

            if (finalResult) {
                this.activeJobs.delete(
                    jobId
                );

                this.printFinalResult(
                    finalResult
                );
                continue;
            }

            const job = this.jobManager.getJob(jobId);
            if (!job) continue;

            const allTasks = job.taskIds.map(tid => this.taskManager.getTask(tid));
            const hasFailed = allTasks.some(t => t && t.status === "FAILED");
            const allFinished = allTasks.every(t => t && (t.status === "COMPLETED" || t.status === "FAILED"));

            if (allFinished && hasFailed) {
                this.jobManager.updateJobStatus(jobId, "FAILED");
                this.activeJobs.delete(jobId);
                console.error(`[JOB] ${jobId} failed: one or more tasks failed permanently.`);
            }
        }
    }

    // ========================================
    // Print Final Result
    // ========================================

    printFinalResult(
        finalResult
    ) {
        console.log("");
        console.log(
            "========================================"
        );
        console.log(
            "          JOB COMPLETED"
        );
        console.log(
            "========================================"
        );

        console.log(
            `Job ID:             ${finalResult.jobId}`
        );

        console.log(
            `Type:               ${finalResult.type}`
        );

        console.log(
            `Tasks:              ${finalResult.taskCount}`
        );

        console.log(
            `Completed Tasks:    ` +
            `${finalResult.completedTaskCount}`
        );

        if (finalResult.type === "PRIME") {
            console.log(
                `Prime Count:        ` +
                `${finalResult.primeCount}`
            );
        } else if (finalResult.type === "SCRIPT") {
            console.log(
                `Script:             ` +
                `${finalResult.scriptName || "-"}`
            );
            const outStr = JSON.stringify(finalResult.combinedOutput);
            console.log(
                `Result:             ` +
                `${outStr && outStr.length > 80 ? outStr.substring(0, 80) + '...' : outStr}`
            );
        }

        console.log(
            `Execution Time:     ` +
            `${finalResult.totalExecutionTimeMs} ms`
        );

        console.log(
            "========================================"
        );
    }

    getJob(jobId) {
        return this.jobManager.getJob(
            jobId
        );
    }

    getAllJobs() {
        return this.jobManager.getAllJobs();
    }
}

module.exports = {
    JobController
};