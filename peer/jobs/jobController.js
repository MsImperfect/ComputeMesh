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

    async runPrimeJob(
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

        console.log(
            `[JOB] ${job.jobId} is still ` +
            `waiting for task recovery`
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
    // Check Active Jobs
    // ========================================

    checkActiveJobs() {
        for (
            const jobId
            of this.activeJobs
        ) {
            const finalResult =
                this.resultAggregator.getJobResult(
                    jobId
                );

            if (!finalResult) {
                continue;
            }

            this.activeJobs.delete(
                jobId
            );

            this.printFinalResult(
                finalResult
            );
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

        console.log(
            `Prime Count:        ` +
            `${finalResult.primeCount}`
        );

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