// ========================================
// Job Manager
// ========================================

class JobManager {
    constructor() {
        this.jobs = new Map();
        this.nextJobNumber = 1;
    }

    // ====================================
    // Create Job
    // ====================================

    createJob(type, parameters = {}) {
        const jobId =
            `JOB-${String(this.nextJobNumber).padStart(3, "0")}`;

        this.nextJobNumber++;

        const range = (parameters.start !== undefined && parameters.end !== undefined)
            ? { start: parameters.start, end: parameters.end }
            : null;

        const job = {
            jobId,
            type,
            parameters,
            range,
            status: "CREATED",
            createdAt: Date.now(),
            completedAt: null,
            taskIds: [],
            results: [],
            result: null,
            executionTimeMs: null,
            error: null
        };

        this.jobs.set(jobId, job);

        console.log(
            `[JOB MANAGER] Created ${jobId}`
        );

        return job;
    }

    // ====================================
    // Get Job
    // ====================================

    getJob(jobId) {
        return this.jobs.get(jobId);
    }

    // ====================================
    // Update Job Status
    // ====================================

    updateJobStatus(jobId, status) {
        const job = this.jobs.get(jobId);

        if (!job) {
            return false;
        }

        job.status = status;

        if (status === "COMPLETED") {
            job.completedAt = Date.now();
        }

        return true;
    }

    // ====================================
    // Add Task To Job
    // ====================================

    addTask(jobId, taskId) {
        const job = this.jobs.get(jobId);

        if (!job) {
            return false;
        }

        job.taskIds.push(taskId);

        return true;
    }

    // ====================================
    // Add Result
    // ====================================

    addResult(jobId, result) {
        const job = this.jobs.get(jobId);

        if (!job) {
            return false;
        }

        if (result && result.taskId) {
            const exists = job.results.some(r => r && r.taskId === result.taskId);
            if (!exists) {
                job.results.push(result);
            }
        } else {
            job.results.push(result);
        }

        return true;
    }

    // ====================================
    // Get All Jobs
    // ====================================

    getAllJobs() {
        return Array.from(
            this.jobs.values()
        );
    }

    // ====================================
    // Print Jobs
    // ====================================

    printJobs() {
        console.log("");
        console.log(
            "========================================"
        );
        console.log(
            "              JOB MANAGER"
        );
        console.log(
            "========================================"
        );

        if (this.jobs.size === 0) {
            console.log(
                "No jobs created."
            );
        }

        for (const job of this.jobs.values()) {
            console.log(
                `${job.jobId} | ` +
                `Type:${job.type} | ` +
                `Status:${job.status} | ` +
                `Tasks:${job.taskIds.length}`
            );
        }

        console.log(
            "========================================"
        );
        console.log("");
    }
}

module.exports = {
    JobManager
};