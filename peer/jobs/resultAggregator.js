// ========================================
// Result Aggregator
// ========================================

class ResultAggregator {
    constructor(jobManager, taskManager) {
        this.jobManager = jobManager;
        this.taskManager = taskManager;
    }

    // ====================================
    // Add Task Result
    // ====================================

    addTaskResult(taskId, result) {
        const task =
            this.taskManager.getTask(taskId);

        if (!task) {
            throw new Error(
                `Task ${taskId} not found`
            );
        }

        this.taskManager.updateTask(
            taskId,
            {
                status: "COMPLETED",
                completedAt: Date.now(),
                result
            }
        );

        this.jobManager.addResult(
            task.jobId,
            result
        );

        console.log(
            `[AGGREGATOR] Result received for ${taskId}`
        );

        return this.checkJobCompletion(
            task.jobId
        );
    }

    // ====================================
    // Check Job Completion
    // ====================================

    checkJobCompletion(jobId) {
        const job =
            this.jobManager.getJob(jobId);

        if (!job) {
            return null;
        }

        const allTasksCompleted =
            job.taskIds.every(
                (taskId) => {
                    const task =
                        this.taskManager.getTask(
                            taskId
                        );

                    return (
                        task &&
                        task.status === "COMPLETED"
                    );
                }
            );

        if (!allTasksCompleted) {
            return null;
        }

        const finalResult =
            this.aggregateJobResults(job);

        this.jobManager.updateJobStatus(
            jobId,
            "COMPLETED"
        );

        console.log(
            `[AGGREGATOR] ${jobId} completed`
        );

        return finalResult;
    }

    // ====================================
    // Aggregate Prime Results
    // ====================================

    aggregateJobResults(job) {
        if (job.type !== "PRIME") {
            throw new Error(
                `Unsupported aggregation type: ${job.type}`
            );
        }

        const allPrimes = [];

        for (const result of job.results) {
            if (
                result &&
                Array.isArray(result.primes)
            ) {
                allPrimes.push(
                    ...result.primes
                );
            }
        }

        // Remove duplicates and sort.
        const uniquePrimes =
            [...new Set(allPrimes)].sort(
                (a, b) => a - b
            );

        const totalExecutionTimeMs =
            job.results.reduce(
                (total, result) => {
                    return (
                        total +
                        Number(
                            result.executionTimeMs || 0
                        )
                    );
                },
                0
            );

        return {
            jobId: job.jobId,
            type: job.type,

            primeCount:
                uniquePrimes.length,

            primes:
                uniquePrimes,

            taskCount:
                job.taskIds.length,

            completedTaskCount:
                job.results.length,

            totalExecutionTimeMs,

            completedAt:
                Date.now()
        };
    }

    // ====================================
    // Get Job Result
    // ====================================

    getJobResult(jobId) {
        const job =
            this.jobManager.getJob(jobId);

        if (!job) {
            return null;
        }

        if (job.status !== "COMPLETED") {
            return null;
        }

        return this.aggregateJobResults(
            job
        );
    }
}

module.exports = {
    ResultAggregator
};